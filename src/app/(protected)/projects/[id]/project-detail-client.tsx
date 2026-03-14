"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { StagePanel } from "@/components/project/stage-panel";
import { useToastStore } from "@/store/toast-store";

/** Google Drive 폴더 URL 또는 ID에서 순수 폴더 ID를 추출 */
function extractDriveFolderId(input: string): string {
  const trimmed = input.trim();
  // URL 형식: https://drive.google.com/drive/folders/{ID} 또는 /u/0/folders/{ID}
  const urlMatch = trimmed.match(/\/folders\/([A-Za-z0-9_-]{20,})/);
  if (urlMatch) return urlMatch[1];
  // 순수 ID (영숫자+하이픈+언더바, 20자 이상)
  if (/^[A-Za-z0-9_-]{20,}$/.test(trimmed)) return trimmed;
  return trimmed; // 그 외는 그대로 반환 (검증은 API에서)
}

type StageData = {
  id: string;
  stageNumber: number;
  stageName: string;
  status: "INACTIVE" | "ACTIVE" | "COMPLETED" | "SKIPPED";
  assigneeId: string | null;
  assignee: { id: string; name: string } | null;
  startDate: string | null;
  completedDate: string | null;
  notes: string | null;
};

export type DriveStageFile = {
  id: string;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  mimeType: string;
  documentType: string;
  modifiedTime: string | null;
  relativePath: string | null;
  isGoogleNative: boolean;
};

type DriveLink = {
  id: string;
  driveFolderId: string;
  folderName: string | null;
  driveFileCount?: number | null;
  unsyncedCount?: number | null;
};

type Props = {
  projectId: string;
  stages: StageData[];
  canManage: boolean;
  userId: string;
  users: { id: string; name: string }[];
};

export function ProjectDetailClient({
  projectId,
  stages: initialStages,
  canManage,
  userId,
  users,
}: Props) {
  const router = useRouter();
  const toast = useToastStore();
  const [stages, setStages] = useState(initialStages);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // ── Drive 링크 (ProjectDriveLink) ──
  const [driveLinks, setDriveLinks] = useState<DriveLink[]>([]);
  const [driveLinksLoading, setDriveLinksLoading] = useState(false);
  const [driveLinksFetched, setDriveLinksFetched] = useState(false);

  // ── Drive 폴더 연결 폼 ──
  const [showLinkForm, setShowLinkForm] = useState(false);
  const [linkForm, setLinkForm] = useState({ driveFolderId: "", folderName: "" });
  const [linkSubmitting, setLinkSubmitting] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  // ── 동기화 ──
  const [syncing, setSyncing] = useState(false);
  const [docsRefreshTrigger, setDocsRefreshTrigger] = useState(0);

  // ── Drive 파일 (프로젝트 전체, 단계별 분류) ──
  const [driveFiles, setDriveFiles] = useState<Record<string, DriveStageFile[]>>({});
  const [driveLoading, setDriveLoading] = useState(false);
  const [driveFetched, setDriveFetched] = useState(false);
  const [driveFolderName, setDriveFolderName] = useState("");
  const [driveTotalFiles, setDriveTotalFiles] = useState(0);

  // Drive 링크 목록 fetch
  const fetchDriveLinks = useCallback(async () => {
    if (!canManage) return;
    setDriveLinksLoading(true);
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/drive`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const payload = await res.json();
      if (payload.success && Array.isArray(payload.data)) {
        setDriveLinks(payload.data);
      }
    } catch (err) {
      console.error("[ProjectDetail] Drive 링크 조회 실패:", err);
    } finally {
      setDriveLinksLoading(false);
      setDriveLinksFetched(true);
    }
  }, [projectId, canManage]);

  useEffect(() => {
    if (canManage && !driveLinksFetched) {
      void fetchDriveLinks();
    }
  }, [canManage, driveLinksFetched, fetchDriveLinks]);

  // Drive 파일 한 번에 fetch
  const fetchDriveFiles = useCallback(async () => {
    setDriveLoading(true);
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/drive/stage-files`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const payload = await res.json();
      if (payload.success && payload.data?.stageFiles) {
        setDriveFiles(payload.data.stageFiles);
        setDriveFolderName(payload.data.folderName ?? "");
        setDriveTotalFiles(payload.data.totalFiles ?? 0);
      }
    } catch (err) {
      console.error("[ProjectDetail] Drive 파일 조회 실패:", err);
    } finally {
      setDriveLoading(false);
      setDriveFetched(true);
    }
  }, [projectId]);

  // 페이지 로드 시 Drive 파일 자동 fetch
  useEffect(() => {
    if (!driveFetched) {
      void fetchDriveFiles();
    }
  }, [driveFetched, fetchDriveFiles]);

  // Drive 폴더 연결
  const handleLinkDrive = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const driveFolderId = extractDriveFolderId(linkForm.driveFolderId);
    if (!driveFolderId) {
      setLinkError("Drive 폴더 URL 또는 ID를 입력해 주세요.");
      return;
    }
    setLinkError(null);
    setLinkSubmitting(true);
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/drive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          driveFolderId,
          folderName: linkForm.folderName.trim() || undefined,
        }),
      });
      const payload = await res.json();
      if (!payload.success) {
        setLinkError(payload.error?.message ?? "Drive 폴더 연결에 실패했습니다.");
        return;
      }
      toast.success("Drive 폴더가 연결되었습니다.");
      setShowLinkForm(false);
      setLinkForm({ driveFolderId: "", folderName: "" });
      setDriveLinksFetched(false);
      void fetchDriveLinks();
      setDriveFetched(false);
      void fetchDriveFiles();
    } catch {
      setLinkError("네트워크 오류가 발생했습니다.");
    } finally {
      setLinkSubmitting(false);
    }
  }, [projectId, linkForm, toast, fetchDriveLinks, fetchDriveFiles]);

  const refresh = useCallback(async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/stages`);
      if (!res.ok) {
        console.error("[ProjectDetail] 스테이지 조회 실패:", res.status);
        router.refresh();
        return;
      }
      const payload = await res.json();
      if (payload.success && Array.isArray(payload.data)) {
        setStages(
          payload.data.map((s: {
            id: string;
            stageNumber: number;
            stageName: string;
            status: string;
            assigneeId: string | null;
            assignee?: { id: string; name: string } | null;
            startDate: string | null;
            completedDate: string | null;
            notes: string | null;
          }) => ({
            id: s.id,
            stageNumber: s.stageNumber,
            stageName: s.stageName,
            status: s.status as StageData["status"],
            assigneeId: s.assigneeId,
            assignee: s.assignee ?? null,
            startDate: s.startDate,
            completedDate: s.completedDate,
            notes: s.notes ?? null,
          })),
        );
      }
      router.refresh();
    } catch {
      router.refresh();
    } finally {
      setIsRefreshing(false);
    }
  }, [projectId, router, isRefreshing]);

  // Drive 동기화 (시스템으로 저장)
  const handleSync = useCallback(async (linkId?: string) => {
    setSyncing(true);
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/drive/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recursive: true, ...(linkId ? { linkId } : {}) }),
      });
      const payload = await res.json();
      if (!payload.success) {
        toast.error(payload.error?.message ?? "동기화에 실패했습니다.");
        return;
      }
      const d = payload.data ?? {};
      const total = (d.success ?? 0) + (d.skipped ?? 0) + (d.failed ?? 0);
      if (total === 0) {
        toast.info("동기화할 새 파일이 없습니다.");
      } else {
        toast.success(
          `시스템에 저장 완료: ${d.success ?? 0}건 성공, ${d.skipped ?? 0}건 건너뜀${(d.failed ?? 0) > 0 ? `, ${d.failed ?? 0}건 실패` : ""}`,
        );
      }
      // 동기화 완료 후 Drive 파일 + 링크 + 문서 전체 갱신
      setDriveFetched(false);
      void fetchDriveFiles();
      setDriveLinksFetched(false);
      void fetchDriveLinks();
      setDocsRefreshTrigger((t) => t + 1);
      await refresh();
    } catch {
      toast.error("동기화 중 오류가 발생했습니다.");
    } finally {
      setSyncing(false);
    }
  }, [projectId, toast, fetchDriveFiles, fetchDriveLinks, refresh]);

  return (
    <div className="space-y-3">
      {/* Drive 폴더 연결 + 동기화 UI (canManage만) */}
      {canManage && driveLinksFetched && (
        <div className="rounded-xl border bg-white p-4 space-y-3">
          {/* ── 연결된 Drive 폴더 목록 ── */}
          {driveLinks.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
                Drive 폴더 {driveLinks.length}개 연결됨
              </p>
              <ul className="space-y-1.5">
                {driveLinks.map((link) => (
                  <li key={link.id} className="flex items-center gap-2 rounded-lg border border-green-100 bg-green-50 px-3 py-2">
                    <span className="text-sm">📁</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-700 truncate">
                        {link.folderName ?? link.driveFolderId}
                      </p>
                      {link.driveFileCount != null && (
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          전체 {link.driveFileCount}개 파일
                          {(link.unsyncedCount ?? 0) > 0 && (
                            <span className="ml-1.5 rounded bg-amber-100 px-1 py-0.5 text-amber-700 font-semibold">
                              미동기화 {link.unsyncedCount}개
                            </span>
                          )}
                          {link.unsyncedCount === 0 && link.driveFileCount > 0 && (
                            <span className="ml-1.5 rounded bg-green-100 px-1 py-0.5 text-green-700 font-semibold">
                              모두 동기화됨 ✓
                            </span>
                          )}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleSync(link.id)}
                      disabled={syncing}
                      className="flex-shrink-0 rounded bg-indigo-600 px-2.5 py-1.5 text-xs font-semibold text-white disabled:opacity-60 hover:bg-indigo-700"
                    >
                      {syncing ? "저장 중..." : "시스템 저장"}
                    </button>
                  </li>
                ))}
              </ul>
              {/* 전체 동기화 버튼 (링크가 2개 이상일 때) */}
              {driveLinks.length > 1 && (
                <button
                  type="button"
                  onClick={() => void handleSync()}
                  disabled={syncing}
                  className="w-full rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60 hover:bg-indigo-700"
                >
                  {syncing ? "전체 시스템 저장 중..." : "전체 폴더 시스템으로 저장"}
                </button>
              )}
            </div>
          )}

          {/* ── Drive 폴더 연결 폼 ── */}
          {showLinkForm ? (
            <form onSubmit={handleLinkDrive} className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-700">
                {driveLinks.length > 0 ? "Drive 폴더 추가 연결" : "Drive 폴더 연결"}
              </h3>
              <p className="text-xs text-slate-500">
                <Link href="/drive" className="text-blue-600 hover:underline">자료실</Link>에서
                폴더를 찾은 뒤, 폴더 URL 또는 ID를 붙여넣으세요.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-sm">
                  <span className="mb-1 block font-medium text-slate-600">폴더 URL 또는 ID</span>
                  <input
                    type="text"
                    value={linkForm.driveFolderId}
                    onChange={(e) => setLinkForm((p) => ({ ...p, driveFolderId: e.target.value }))}
                    placeholder="https://drive.google.com/drive/folders/... 또는 폴더 ID"
                    className="h-10 w-full rounded border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </label>
                <label className="text-sm">
                  <span className="mb-1 block font-medium text-slate-600">폴더명 (선택)</span>
                  <input
                    type="text"
                    value={linkForm.folderName}
                    onChange={(e) => setLinkForm((p) => ({ ...p, folderName: e.target.value }))}
                    placeholder="표시용 이름"
                    className="h-10 w-full rounded border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </label>
              </div>
              {linkError && <p className="text-sm text-red-600">{linkError}</p>}
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={linkSubmitting}
                  className="rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 hover:bg-blue-700"
                >
                  {linkSubmitting ? "연결 중..." : "연결"}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowLinkForm(false); setLinkError(null); }}
                  className="rounded border px-4 py-2 text-sm font-medium hover:bg-slate-50"
                >
                  취소
                </button>
              </div>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setShowLinkForm(true)}
              className="flex items-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm font-medium text-slate-500 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
            >
              <span className="text-base">＋</span>
              {driveLinks.length === 0 ? "Drive 폴더 연결" : "폴더 추가 연결"}
            </button>
          )}

          {driveLinks.length === 0 && !showLinkForm && (
            <p className="text-xs text-slate-400">
              연결 후 &quot;시스템으로 저장&quot;을 누르면 Drive 파일이 프로젝트 문서로 영구 저장됩니다.
            </p>
          )}
        </div>
      )}

      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-xl font-semibold">10단계 진행 현황</h2>
        {driveFetched && driveTotalFiles > 0 && (
          <div className="flex items-center gap-2">
            <span className="rounded-lg bg-green-50 border border-green-200 px-2.5 py-1 text-xs text-green-700">
              📁 <strong>{driveFolderName}</strong> — Google Drive {driveTotalFiles}개 파일 연동
            </span>
            <button
              type="button"
              onClick={() => { setDriveFetched(false); void fetchDriveFiles(); }}
              className="text-xs text-blue-500 hover:underline"
            >
              새로고침
            </button>
          </div>
        )}
        {driveLoading && (
          <span className="flex items-center gap-1.5 text-xs text-slate-400">
            <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-slate-300 border-t-blue-500" />
            Drive 파일 조회 중...
          </span>
        )}
      </div>
      <div className="space-y-2">
        {stages.map((stage) => (
          <StagePanel
            key={stage.id}
            projectId={projectId}
            stage={stage}
            canManage={canManage}
            isAssignee={stage.assigneeId === userId}
            users={users}
            onRefresh={refresh}
            driveFiles={driveFiles[String(stage.stageNumber)] ?? []}
            driveLoading={driveLoading}
            docsRefreshTrigger={docsRefreshTrigger}
          />
        ))}
      </div>
    </div>
  );
}
