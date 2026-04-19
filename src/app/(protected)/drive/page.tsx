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
  Camera,
  Wrench,
  ClipboardList,
  PenLine,
  Ship,
  MoreHorizontal,
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

/* ─── 문서 유형 카드 (Supabase) ────────── */
type DocTypeCard = {
  type: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  color: string;
};

const DOC_TYPE_CARDS: DocTypeCard[] = [
  { type: "PROPOSAL",          label: "제안서",       description: "고객사 제안 문서",     icon: <PenLine className="h-6 w-6" />,       color: "bg-blue-50 text-blue-600 border-blue-200" },
  { type: "ESTIMATE",          label: "견적서",       description: "프로젝트 견적 문서",   icon: <FileSpreadsheet className="h-6 w-6" />, color: "bg-emerald-50 text-emerald-600 border-emerald-200" },
  { type: "MANUFACTURE_MANUAL",label: "제조 매뉴얼",  description: "제조 관련 매뉴얼",     icon: <Wrench className="h-6 w-6" />,        color: "bg-orange-50 text-orange-600 border-orange-200" },
  { type: "INSTALL_MANUAL",    label: "설치 매뉴얼",  description: "설치 관련 매뉴얼",     icon: <BookOpen className="h-6 w-6" />,      color: "bg-purple-50 text-purple-600 border-purple-200" },
  { type: "PARTS_LIST",        label: "부품 목록",    description: "부품 및 자재 목록",    icon: <ClipboardList className="h-6 w-6" />, color: "bg-cyan-50 text-cyan-600 border-cyan-200" },
  { type: "SITE_PHOTO",        label: "현장 사진",    description: "현장 촬영 사진",       icon: <Camera className="h-6 w-6" />,        color: "bg-pink-50 text-pink-600 border-pink-200" },
  { type: "DRAWING",           label: "도면",         description: "설계 및 도면 파일",    icon: <FileText className="h-6 w-6" />,      color: "bg-indigo-50 text-indigo-600 border-indigo-200" },
  { type: "MEETING_NOTE",      label: "회의록",       description: "회의 기록 문서",       icon: <PenLine className="h-6 w-6" />,       color: "bg-amber-50 text-amber-600 border-amber-200" },
  { type: "EXPORT_RECORD",     label: "수출 서류",    description: "수출 관련 서류",       icon: <Ship className="h-6 w-6" />,          color: "bg-teal-50 text-teal-600 border-teal-200" },
  { type: "OTHER",             label: "기타",         description: "기타 문서",            icon: <MoreHorizontal className="h-6 w-6" />, color: "bg-slate-50 text-slate-600 border-slate-200" },
];

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

type SupabaseDoc = {
  id: string;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  mimeType: string;
  documentType: string;
  version: number;
  description: string | null;
  createdAt: string;
  uploadedBy: { id: string; name: string };
  stageNumber: number;
  projectId: string;
  projectName: string;
  projectNumber: string;
  customerName: string | null;
};

/* ─── 메인 컴포넌트 ────────────────────── */
export default function DriveBrowserPage() {
  const [scopes, setScopes] = useState<ScopeItem[]>([]);
  const [currentScope, setCurrentScope] = useState<string | null>(null);
  const [currentPeriod, setCurrentPeriod] = useState<"before" | "after" | null>(null);
  const [browseResult, setBrowseResult] = useState<BrowseResult | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Supabase 섹션 상태
  const [currentDocType, setCurrentDocType] = useState<string | null>(null);
  const [supabaseDocs, setSupabaseDocs] = useState<SupabaseDoc[]>([]);
  const [supabaseLoading, setSupabaseLoading] = useState(false);
  const [supabaseSearch, setSupabaseSearch] = useState("");

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
    async (scope: string, period: "before" | "after", folderId?: string, folderName?: string) => {
      setLoading(true);
      setError("");
      try {
        const scopeKey = scope.toLowerCase();
        let url = `/api/v1/drive/browse?scope=${scopeKey}&period=${period}`;
        if (folderId) url += `&folderId=${encodeURIComponent(folderId)}`;
        if (folderName) url += `&folderName=${encodeURIComponent(folderName)}`;

        const res = await fetch(url);
        const json = await res.json();
        if (!json.success) throw new Error(json.error?.message ?? "탐색 실패");

        setBrowseResult(json.data);
        setCurrentScope(scope);
        setCurrentPeriod(period);

        if (!folderId) {
          setBreadcrumbs([]);
        } else {
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
    browse(scope, currentPeriod!);
  };

  // 전체 루트로 돌아가기
  const goToRoot = () => {
    setCurrentScope(null);
    setCurrentPeriod(null);
    setBrowseResult(null);
    setBreadcrumbs([]);
  };

  // 빵부스러기 이동
  const goToBreadcrumb = (index: number) => {
    if (!currentScope || !currentPeriod) return;
    if (index < 0) {
      goToScopeRoot(currentScope);
    } else {
      const target = breadcrumbs[index];
      browse(currentScope, currentPeriod, target.id, target.name);
    }
  };

  // Supabase 문서 유형별 조회
  const browseSupabase = useCallback(async (docType: string, q = "") => {
    setSupabaseLoading(true);
    setError("");
    try {
      const url = `/api/v1/documents?documentType=${docType}${q ? `&q=${encodeURIComponent(q)}` : ""}`;
      const res = await fetch(url);
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? "조회 실패");
      setSupabaseDocs(json.data);
      setCurrentDocType(docType);
    } catch (e) {
      setError(e instanceof Error ? e.message : "문서 조회 실패");
    } finally {
      setSupabaseLoading(false);
    }
  }, []);

  const goToRootFromSupabase = () => {
    setCurrentDocType(null);
    setSupabaseDocs([]);
    setSupabaseSearch("");
  };

  // Drive 파일 열기
  const openInDrive = (item: DriveItem) => {
    const driveUrl = item.webViewLink ?? `https://drive.google.com/file/d/${item.id}/view`;
    window.open(driveUrl, "_blank");
  };

  // 아이템 클릭 핸들러
  const handleItemClick = (item: DriveItem) => {
    if (item.isFolder) {
      browse(currentScope!, currentPeriod!, item.id, item.name);
    } else {
      openInDrive(item);
    }
  };

  const scopeLabel = scopes.find((s) => s.scope === currentScope)?.label ?? currentScope ?? "";
  const periodLabel = currentPeriod === "before" ? "2026년 3월까지 · 기존 프로젝트" : currentPeriod === "after" ? "2026년 4월부터 · 신규 프로젝트" : "";

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
      {!currentScope && !currentDocType && (
        <div className="space-y-6">
          {/* 구글 드라이브 섹션 */}
          <div>
            <h2 className="mb-3 text-sm font-semibold text-slate-500 tracking-wide">
              2026년 3월까지 · 기존 프로젝트 (구글 드라이브 연동)
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {scopes.map((s) => (
                <button
                  key={s.scope}
                  onClick={() => browse(s.scope, "before")}
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
          </div>

          {/* Supabase Storage 섹션 */}
          <div>
            <h2 className="mt-8 mb-3 text-sm font-semibold text-slate-500 tracking-wide">
              2026년 4월부터 · 신규 프로젝트 (Supabase Storage)
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {DOC_TYPE_CARDS.map((card) => (
                <button
                  key={card.type}
                  onClick={() => browseSupabase(card.type)}
                  className={`flex items-start gap-4 rounded-xl border p-5 text-left transition-all hover:shadow-md ${card.color}`}
                >
                  <div className="mt-0.5 flex-shrink-0">{card.icon}</div>
                  <div>
                    <p className="font-bold text-lg">{card.label}</p>
                    <p className="mt-1 text-sm opacity-70">{card.description}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
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
            <span className="text-slate-400 text-xs font-medium whitespace-nowrap">{periodLabel}</span>
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

      {/* Supabase 문서 목록 */}
      {currentDocType && (
        <>
          {/* 경로 표시 */}
          <div className="flex items-center gap-1.5 rounded-xl border bg-white px-4 py-3 text-sm overflow-x-auto">
            <button onClick={goToRootFromSupabase} className="flex items-center gap-1 text-blue-600 hover:underline font-medium whitespace-nowrap">
              <HardDrive className="h-4 w-4" />
              자료실
            </button>
            <ChevronRight className="h-4 w-4 text-slate-300 flex-shrink-0" />
            <span className="text-slate-400 text-xs font-medium whitespace-nowrap">2026년 4월부터 · 신규 프로젝트</span>
            <ChevronRight className="h-4 w-4 text-slate-300 flex-shrink-0" />
            <span className="font-medium text-slate-800 whitespace-nowrap">
              {DOC_TYPE_CARDS.find((c) => c.type === currentDocType)?.label ?? currentDocType}
            </span>
          </div>

          {/* 검색 */}
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="파일명 검색..."
              value={supabaseSearch}
              onChange={(e) => setSupabaseSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && browseSupabase(currentDocType, supabaseSearch)}
              className="h-10 flex-1 rounded-lg border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            <button
              onClick={() => browseSupabase(currentDocType, supabaseSearch)}
              className="h-10 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700"
            >
              검색
            </button>
          </div>

          {/* 로딩 */}
          {supabaseLoading && (
            <div className="flex items-center justify-center py-16">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
              <span className="ml-3 text-slate-500">문서를 불러오는 중...</span>
            </div>
          )}

          {/* 목록 */}
          {!supabaseLoading && (
            supabaseDocs.length === 0 ? (
              <div className="rounded-xl border bg-white py-16 text-center">
                <FolderOpen className="mx-auto mb-3 h-16 w-16 text-slate-300" />
                <p className="font-semibold text-slate-600">등록된 문서가 없습니다</p>
              </div>
            ) : (
              <div className="rounded-xl border bg-white overflow-hidden">
                <div className="border-b bg-slate-50 px-4 py-2 text-xs text-slate-500">
                  총 {supabaseDocs.length}건
                </div>
                <table className="w-full text-left text-sm">
                  <thead className="border-b bg-slate-50">
                    <tr>
                      <th className="p-3 font-semibold text-slate-600 w-10"></th>
                      <th className="p-3 font-semibold text-slate-600">파일명</th>
                      <th className="p-3 font-semibold text-slate-600">프로젝트</th>
                      <th className="p-3 font-semibold text-slate-600">고객사</th>
                      <th className="p-3 font-semibold text-slate-600 w-16">단계</th>
                      <th className="p-3 font-semibold text-slate-600 w-24">크기</th>
                      <th className="p-3 font-semibold text-slate-600 w-28">등록일</th>
                      <th className="p-3 font-semibold text-slate-600 w-16">열기</th>
                    </tr>
                  </thead>
                  <tbody>
                    {supabaseDocs.map((doc) => (
                      <tr key={doc.id} className="border-b hover:bg-slate-50 transition-colors">
                        <td className="p-3">{getFileIcon(doc.mimeType, doc.fileName)}</td>
                        <td className="p-3">
                          <p className="font-medium text-slate-800 truncate max-w-xs">{doc.fileName}</p>
                          {doc.description && <p className="text-xs text-slate-400 mt-0.5">{doc.description}</p>}
                        </td>
                        <td className="p-3">
                          <p className="text-slate-700">{doc.projectName}</p>
                          <p className="text-xs text-slate-400">{doc.projectNumber}</p>
                        </td>
                        <td className="p-3 text-slate-600">{doc.customerName ?? "-"}</td>
                        <td className="p-3 text-slate-600 text-center">{doc.stageNumber}단계</td>
                        <td className="p-3 text-slate-500 text-xs">{formatFileSize(doc.fileSize)}</td>
                        <td className="p-3 text-slate-500 text-xs">{formatDate(doc.createdAt)}</td>
                        <td className="p-3">
                          <a
                            href={doc.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-500 hover:text-blue-700"
                            title="파일 열기"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}
        </>
      )}
    </section>
  );
}
