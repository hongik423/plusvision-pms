"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { StagePanel } from "@/components/project/stage-panel";
import { useToastStore } from "@/store/toast-store";

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
    const driveFolderId = linkForm.driveFolderId.trim();
    if (!driveFolderId) {
      setLinkError("Drive 폴더 ID를 입력해 주세요.");
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
  const handleSync = useCallback(async () => {
    setSyncing(true);
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/drive/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recursive: true }),
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
        toast.success(`시스템에 저장 완료: ${d.success ?? 0}건 성공, ${d.skipped ?? 0}건 건너뜀${(d.failed ?? 0) > 0 ? `, ${d.failed ?? 0}건 실패` : ""}`);
      }
      setDriveFetched(false);
      void fetchDriveFiles();
      setDocsRefreshTrigger((t) => t + 1);
      await refresh();
    } catch {
      toast.error("동기화 중 오류가 발생했습니다.");
    } finally {
      setSyncing(false);
    }
  }, [projectId, toast, fetchDriveFiles, refresh]);

  return (
    <div className="space-y-3">
      {/* Drive 폴더 연결 + 동기화 UI (canManage만) */}
      {canManage && driveLinksFetched && (
        <div className="rounded-xl border bg-white p-4">
          {driveLinks.length === 0 ? (
            <div>
              {showLinkForm ? (
                <form onSubmit={handleLinkDrive} className="space-y-3">
                  <h3 className="text-sm font-semibold text-slate-700">Drive 폴더 연결</h3>
                  <p className="text-xs text-slate-500">
                    <Link href="/drive" className="text-blue-600 hover:underline">
                      자료실
                    </Link>
                    에서 폴더를 탐색한 뒤, URL의 폴더 ID를 복사하여 입력하세요.
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="text-sm">
                      <span className="mb-1 block font-medium text-slate-600">폴더 ID</span>
                      <input
                        type="text"
                        value={linkForm.driveFolderId}
                        onChange={(e) => setLinkForm((p) => ({ ...p, driveFolderId: e.target.value }))}
                        placeholder="예: 1jEV7uwUlfTCDrUPTS2S7CCBHXRSWsGov"
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
                  {linkError && (
                    <p className="text-sm text-red-600">{linkError}</p>
                  )}
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
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowLinkForm(true)}
                    className="rounded-lg border border-green-300 bg-green-50 px-3 py-2 text-sm font-medium text-green-700 hover:bg-green-100"
                  >
                    Drive 폴더 연결
                  </button>
                  <span className="text-xs text-slate-500">
                    연결 후 동기화하면 프로젝트를 떠났다가 돌아와도 문서가 그대로 저장됩니다.
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm font-medium text-slate-700">
                Drive 폴더 {driveLinks.length}개 연결됨
                {driveLinks[0]?.folderName && (
                  <span className="ml-1 text-slate-500">— {driveLinks[0].folderName}</span>
                )}
              </span>
              <button
                type="button"
                onClick={() => void handleSync()}
                disabled={syncing}
                className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60 hover:bg-indigo-700"
              >
                {syncing ? "시스템 저장 중..." : "시스템으로 저장"}
              </button>
              <span className="text-xs text-slate-500">
                Drive 파일을 시스템에 저장하면 프로젝트 재방문 시에도 그대로 유지됩니다.
              </span>
            </div>
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
