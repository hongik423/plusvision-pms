"use client";

import { useEffect, useState, useCallback } from "react";
import {
  FolderOpen,
  FileText,
  ChevronRight,
  HardDrive,
  Building2,
  ShieldCheck,
  BookOpen,
  Briefcase,
  Users,
  ExternalLink,
  FileSpreadsheet,
  FileImage,
  Presentation,
  File,
} from "lucide-react";

/* ─── 타입 ──────────────────────────────── */
type ScopeItem = {
  scope: string;
  label: string;
  description: string;
  rootFolderId: string;
};

type DriveItem = {
  id: string;
  name: string;
  mimeType: string;
  size?: number;
  modifiedTime?: string;
  webViewLink?: string;
  isFolder: boolean;
  inferredStage?: { stageNumber: number; documentType: string };
};

type BrowseResult = {
  folderId: string;
  folderName: string;
  scope: string;
  items: DriveItem[];
  totalFolders: number;
  totalFiles: number;
  parentPath?: string;
};

/** 스코프별 설명 */
const SCOPE_DESCRIPTIONS: Record<string, string> = {
  PERSONAL: "직원별 개인 폴더",
  PROJECT: "고객사별 프로젝트 자료",
  COMPANY_INTRO: "회사 소개 자료 모음",
  GOVERNMENT: "국책사업 관련 자료",
  OPERATIONS: "회사 운영 관련 문서",
  SOP: "표준 운영 절차서",
};

/* ─── 아이콘 매핑 ──────────────────────── */
const SCOPE_ICONS: Record<string, React.ReactNode> = {
  PERSONAL: <Users className="h-6 w-6" />,
  PROJECT: <Briefcase className="h-6 w-6" />,
  COMPANY_INTRO: <Building2 className="h-6 w-6" />,
  GOVERNMENT: <ShieldCheck className="h-6 w-6" />,
  OPERATIONS: <BookOpen className="h-6 w-6" />,
  SOP: <FileText className="h-6 w-6" />,
};

const SCOPE_COLORS: Record<string, string> = {
  PERSONAL: "bg-blue-50 text-blue-600 border-blue-200",
  PROJECT: "bg-emerald-50 text-emerald-600 border-emerald-200",
  COMPANY_INTRO: "bg-purple-50 text-purple-600 border-purple-200",
  GOVERNMENT: "bg-amber-50 text-amber-600 border-amber-200",
  OPERATIONS: "bg-rose-50 text-rose-600 border-rose-200",
  SOP: "bg-cyan-50 text-cyan-600 border-cyan-200",
};

function getFileIcon(mimeType: string, name: string) {
  if (mimeType.includes("folder")) return <FolderOpen className="h-5 w-5 text-amber-500" />;
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (["xlsx", "xls", "csv"].includes(ext) || mimeType.includes("spreadsheet"))
    return <FileSpreadsheet className="h-5 w-5 text-green-600" />;
  if (["pptx", "ppt"].includes(ext) || mimeType.includes("presentation"))
    return <Presentation className="h-5 w-5 text-orange-500" />;
  if (["jpg", "jpeg", "png", "gif", "svg", "bmp"].includes(ext) || mimeType.includes("image"))
    return <FileImage className="h-5 w-5 text-pink-500" />;
  if (["pdf"].includes(ext) || mimeType.includes("pdf"))
    return <FileText className="h-5 w-5 text-red-500" />;
  if (["doc", "docx"].includes(ext) || mimeType.includes("document"))
    return <FileText className="h-5 w-5 text-blue-500" />;
  return <File className="h-5 w-5 text-slate-400" />;
}

function formatFileSize(size?: number) {
  if (!size && size !== 0) return "";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(dateStr?: string) {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" });
  } catch {
    return "";
  }
}

/* ─── 메인 컴포넌트 ────────────────────── */
export default function DriveBrowserPage() {
  const [scopes, setScopes] = useState<ScopeItem[]>([]);
  const [currentScope, setCurrentScope] = useState<string | null>(null);
  const [browseResult, setBrowseResult] = useState<BrowseResult | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // 최상위 스코프 목록 로드
  useEffect(() => {
    fetch("/api/v1/drive/browse?scope=all")
      .then((r) => r.json())
      .then((d) => {
        if (d.success && d.data?.scopes) {
          // API 응답: { rootFolderId, scopes: [{scope, label, folderId}] }
          // → ScopeItem[] 변환: description 추가, folderId→rootFolderId 매핑
          const mapped: ScopeItem[] = d.data.scopes.map(
            (s: { scope: string; label: string; folderId: string }) => ({
              scope: s.scope,
              label: s.label,
              description: SCOPE_DESCRIPTIONS[s.scope] ?? "",
              rootFolderId: s.folderId,
            }),
          );
          setScopes(mapped);
        }
      })
      .catch(() => setError("Drive 스코프 목록을 불러올 수 없습니다"));
  }, []);

  // 폴더 탐색 함수
  const browse = useCallback(
    async (scope: string, folderId?: string, folderName?: string) => {
      setLoading(true);
      setError("");
      try {
        const scopeKey = scope.toLowerCase();
        let url = `/api/v1/drive/browse?scope=${scopeKey}`;
        if (folderId) url += `&folderId=${encodeURIComponent(folderId)}`;
        if (folderName) url += `&folderName=${encodeURIComponent(folderName)}`;

        const res = await fetch(url);
        const json = await res.json();
        if (!json.success) throw new Error(json.error?.message ?? "탐색 실패");

        setBrowseResult(json.data);
        setCurrentScope(scope);

        if (!folderId) {
          // 스코프 루트 탐색 — 빵부스러기 초기화
          setBreadcrumbs([]);
        } else {
          // 하위 폴더 탐색 — 빵부스러기 추가
          setBreadcrumbs((prev) => {
            const exists = prev.findIndex((b) => b.id === folderId);
            if (exists >= 0) return prev.slice(0, exists + 1);
            return [...prev, { id: folderId, name: folderName ?? "폴더" }];
          });
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Drive 폴더 탐색 실패");
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  // 스코프 루트로 돌아가기
  const goToScopeRoot = (scope: string) => {
    setBreadcrumbs([]);
    browse(scope);
  };

  // 전체 루트로 돌아가기
  const goToRoot = () => {
    setCurrentScope(null);
    setBrowseResult(null);
    setBreadcrumbs([]);
  };

  // 빵부스러기 이동
  const goToBreadcrumb = (index: number) => {
    if (!currentScope) return;
    if (index < 0) {
      goToScopeRoot(currentScope);
    } else {
      const target = breadcrumbs[index];
      browse(currentScope, target.id, target.name);
    }
  };

  // Drive 파일 열기
  const openInDrive = (item: DriveItem) => {
    const driveUrl = item.webViewLink ?? `https://drive.google.com/file/d/${item.id}/view`;
    window.open(driveUrl, "_blank");
  };

  // 아이템 클릭 핸들러
  const handleItemClick = (item: DriveItem) => {
    if (item.isFolder) {
      browse(currentScope!, item.id, item.name);
    } else {
      openInDrive(item);
    }
  };

  const scopeLabel = scopes.find((s) => s.scope === currentScope)?.label ?? currentScope ?? "";

  return (
    <section className="space-y-5">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-3xl font-bold">
          <HardDrive className="h-8 w-8 text-blue-600" />
          자료실
        </h1>
      </div>

      {/* 에러 표시 */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">
          {error}
        </div>
      )}

      {/* 최상위: 스코프 카드 목록 */}
      {!currentScope && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {scopes.map((s) => (
            <button
              key={s.scope}
              onClick={() => browse(s.scope)}
              className={`flex items-start gap-4 rounded-xl border p-5 text-left transition-all hover:shadow-md ${SCOPE_COLORS[s.scope] ?? "bg-white border-slate-200"}`}
            >
              <div className="mt-0.5 flex-shrink-0">{SCOPE_ICONS[s.scope] ?? <FolderOpen className="h-6 w-6" />}</div>
              <div>
                <p className="font-bold text-lg">{s.label}</p>
                <p className="mt-1 text-sm opacity-70">{s.description}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* 폴더 탐색 중 */}
      {currentScope && (
        <>
          {/* 빵부스러기 네비게이션 */}
          <div className="flex items-center gap-1.5 rounded-xl border bg-white px-4 py-3 text-sm overflow-x-auto">
            <button onClick={goToRoot} className="flex items-center gap-1 text-blue-600 hover:underline font-medium whitespace-nowrap">
              <HardDrive className="h-4 w-4" />
              자료실
            </button>
            <ChevronRight className="h-4 w-4 text-slate-300 flex-shrink-0" />
            <button onClick={() => goToScopeRoot(currentScope)} className={`font-medium whitespace-nowrap ${breadcrumbs.length > 0 ? "text-blue-600 hover:underline" : "text-slate-800"}`}>
              {scopeLabel}
            </button>
            {breadcrumbs.map((bc, i) => (
              <span key={bc.id} className="flex items-center gap-1.5">
                <ChevronRight className="h-4 w-4 text-slate-300 flex-shrink-0" />
                <button
                  onClick={() => goToBreadcrumb(i)}
                  className={`whitespace-nowrap ${i === breadcrumbs.length - 1 ? "font-medium text-slate-800" : "text-blue-600 hover:underline"}`}
                >
                  {bc.name}
                </button>
              </span>
            ))}
          </div>

          {/* 로딩 */}
          {loading && (
            <div className="flex items-center justify-center py-16">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
              <span className="ml-3 text-slate-500">파일 목록을 불러오는 중...</span>
            </div>
          )}

          {/* 파일 목록 */}
          {!loading && browseResult && (
            <>
              {/* 요약 */}
              <div className="flex items-center gap-4 text-sm text-slate-500">
                <span>폴더 {browseResult.totalFolders}개</span>
                <span>·</span>
                <span>파일 {browseResult.totalFiles}개</span>
              </div>

              {browseResult.items.length === 0 ? (
                <div className="rounded-xl border bg-white py-16 text-center">
                  <FolderOpen className="mx-auto mb-3 h-16 w-16 text-slate-300" />
                  <p className="font-semibold text-slate-600">이 폴더에 항목이 없습니다</p>
                </div>
              ) : (
                <div className="rounded-xl border bg-white overflow-hidden">
                  {/* 데스크톱 테이블 */}
                  <table className="hidden md:table w-full text-left">
                    <thead className="border-b bg-slate-50 text-sm">
                      <tr>
                        <th className="p-3 font-semibold text-slate-600 w-12"></th>
                        <th className="p-3 font-semibold text-slate-600">이름</th>
                        <th className="p-3 font-semibold text-slate-600 w-28">크기</th>
                        <th className="p-3 font-semibold text-slate-600 w-32">수정일</th>
                        <th className="p-3 font-semibold text-slate-600 w-20">열기</th>
                      </tr>
                    </thead>
                    <tbody>
                      {browseResult.items.map((item) => (
                          <tr
                            key={item.id}
                            className="h-12 border-b text-sm hover:bg-slate-50 transition-colors cursor-pointer"
                            onClick={() => handleItemClick(item)}
                          >
                            <td className="p-3">{getFileIcon(item.mimeType, item.name)}</td>
                            <td className="p-3">
                              <span className={`font-medium ${item.isFolder ? "text-amber-700" : "text-slate-800 hover:text-blue-600"}`}>
                                {item.name}
                              </span>
                            </td>
                            <td className="p-3 text-slate-500 text-xs">{item.isFolder ? "-" : formatFileSize(item.size)}</td>
                            <td className="p-3 text-slate-500 text-xs">{formatDate(item.modifiedTime)}</td>
                            <td className="p-3">
                              {!item.isFolder && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); openInDrive(item); }}
                                  className="text-blue-500 hover:text-blue-700"
                                  title="Google Drive에서 열기"
                                >
                                  <ExternalLink className="h-4 w-4" />
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>

                  {/* 모바일 리스트 */}
                  <div className="md:hidden divide-y">
                    {browseResult.items.map((item) => (
                        <button
                          key={item.id}
                          className="flex items-center gap-3 w-full p-3 text-left hover:bg-slate-50 transition-colors"
                          onClick={() => handleItemClick(item)}
                        >
                          {getFileIcon(item.mimeType, item.name)}
                          <div className="flex-1 min-w-0">
                            <p className={`font-medium truncate ${item.isFolder ? "text-amber-700" : "text-slate-800"}`}>{item.name}</p>
                            <p className="text-xs text-slate-400 mt-0.5">
                              {item.isFolder ? "폴더" : formatFileSize(item.size)}
                              {item.modifiedTime ? ` · ${formatDate(item.modifiedTime)}` : ""}
                            </p>
                          </div>
                          {item.isFolder && <ChevronRight className="h-4 w-4 text-slate-300" />}
                        </button>
                      ))}
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}
