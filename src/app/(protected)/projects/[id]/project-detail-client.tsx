"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { StagePanel } from "@/components/project/stage-panel";

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
  const [stages, setStages] = useState(initialStages);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // ── Drive 파일 (프로젝트 전체, 단계별 분류) ──
  const [driveFiles, setDriveFiles] = useState<Record<string, DriveStageFile[]>>({});
  const [driveLoading, setDriveLoading] = useState(false);
  const [driveFetched, setDriveFetched] = useState(false);
  const [driveFolderName, setDriveFolderName] = useState("");
  const [driveTotalFiles, setDriveTotalFiles] = useState(0);

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

  return (
    <div className="space-y-3">
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
          />
        ))}
      </div>
    </div>
  );
}
