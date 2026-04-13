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
  dueDate: string | null;
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
            dueDate: string | null;
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
            dueDate: s.dueDate,
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

  // Drive 동기화 (매핑된 문서 저장)
  const handleSync = useCallback(async (linkId?: string, stageNumber?: number) => {
    setSyncing(true);
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/drive/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recursive: true,
          ...(linkId ? { linkId } : {}),
          ...(stageNumber ? { stageNumber } : {}),
        }),
      });
      const payload = await res.json();
      if (!payload.success) {
        const msg = payload.error?.message ?? "동기화에 실패했습니다.";
        toast.error(msg);
        if (payload.error?.code === "NO_DRIVE_MAPPING" || res.status === 422) {
          setShowLinkForm(true);
        }
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

  // 단계별 매핑된 문서 저장
  const handleSyncStage = useCallback(
    async (stageNumber: number) => {
      await handleSync(undefined, stageNumber);
    },
    [handleSync],
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-xl font-semibold">10단계 진행 현황</h2>
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
            onSyncStage={canManage ? handleSyncStage : undefined}
            syncing={syncing}
          />
        ))}
      </div>
    </div>
  );
}
