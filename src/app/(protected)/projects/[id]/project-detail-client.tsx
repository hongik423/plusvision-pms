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

  const [isRefreshing, setIsRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    if (isRefreshing) return; // 중복 요청 방지
    setIsRefreshing(true);

    try {
      // [수정] 먼저 클라이언트 API로 최신 데이터 fetch 후 Server Component 새로고침
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
      // API 호출 성공 후 Server Component도 새로고침
      router.refresh();
    } catch {
      // 네트워크 오류 시 Server Component 새로고침으로 폴백
      router.refresh();
    } finally {
      setIsRefreshing(false);
    }
  }, [projectId, router, isRefreshing]);

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
