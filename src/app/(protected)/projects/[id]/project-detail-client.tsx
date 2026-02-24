"use client";

import { useCallback, useState } from "react";
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

  const refresh = useCallback(async () => {
    // Server Component 페이지를 새로고침해서 최신 데이터 반영
    router.refresh();
    // 클라이언트 측 stages도 서버에서 최신 데이터 fetch
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/stages`);
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
    } catch {
      // 실패 시 router.refresh()로 폴백
    }
  }, [projectId, router]);

  return (
    <div className="space-y-3">
      <h2 className="text-xl font-semibold">10단계 진행 현황</h2>
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
          />
        ))}
      </div>
    </div>
  );
}
