"use client";

import { FormEvent, useState } from "react";
import { STAGE_NAMES, STAGE_DESCRIPTIONS, STAGE_STATUS_COLORS, PROJECT_STATUS_LABELS } from "@/lib/constants";
import { useToastStore } from "@/store/toast-store";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

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

type UserOption = { id: string; name: string };

type Props = {
  projectId: string;
  stage: StageData;
  canManage: boolean; // ADMIN or MANAGER
  isAssignee: boolean; // 현재 사용자가 담당자
  users: UserOption[];
  onRefresh: () => void;
};

const STATUS_LABEL: Record<StageData["status"], string> = {
  INACTIVE: "대기",
  ACTIVE: "진행중",
  COMPLETED: "완료",
  SKIPPED: "건너뜀",
};

export function StagePanel({
  projectId,
  stage,
  canManage,
  isAssignee,
  users,
  onRefresh,
}: Props) {
  const toast = useToastStore();
  const [open, setOpen] = useState(false);
  const [assigneeId, setAssigneeId] = useState(stage.assigneeId ?? "");
  const [notes, setNotes] = useState(stage.notes ?? "");
  const [saving, setSaving] = useState(false);

  const canComplete = (canManage || isAssignee) && stage.status === "ACTIVE";
  const canAssign = canManage;

  const statusBg =
    stage.status === "COMPLETED"
      ? "bg-green-500 text-white"
      : stage.status === "ACTIVE"
      ? "bg-blue-500 text-white animate-pulse"
      : "bg-gray-200 text-gray-600";

  async function handleAssign() {
    if (!assigneeId) { toast.warning("담당자를 선택해 주세요."); return; }
    setSaving(true);
    const res = await fetch(`/api/v1/projects/${projectId}/stages/${stage.stageNumber}/assign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assigneeId }),
    });
    const payload = await res.json();
    setSaving(false);
    if (!payload.success) { toast.error(payload.error?.message ?? "담당자 지정에 실패했습니다."); return; }
    toast.success(`${stage.stageNumber}단계 담당자를 지정했습니다.`);
    onRefresh();
  }

  async function handleComplete(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch(`/api/v1/projects/${projectId}/stages/${stage.stageNumber}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes: notes || undefined, status: "COMPLETED" }),
    });
    const payload = await res.json();
    setSaving(false);
    if (!payload.success) { toast.error(payload.error?.message ?? "단계 완료 처리에 실패했습니다."); return; }
    toast.success(`${stage.stageNumber}단계를 완료했습니다!`);
    setOpen(false);
    onRefresh();
  }

  async function handleHoldOrCancel(projectStatus: "HOLD" | "CANCELLED") {
    const res = await fetch(`/api/v1/projects/${projectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: projectStatus }),
    });
    const payload = await res.json();
    if (!payload.success) { toast.error("상태 변경에 실패했습니다."); return; }
    toast.success(`프로젝트를 ${PROJECT_STATUS_LABELS[projectStatus]}으로 변경했습니다.`);
    onRefresh();
  }

  return (
    <div className="overflow-hidden rounded-xl border bg-white">
      {/* 단계 헤더 버튼 */}
      <button
        type="button"
        className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50 ${open ? "bg-slate-50" : ""}`}
        onClick={() => setOpen((p) => !p)}
      >
        <span className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold ${statusBg}`}>
          {stage.status === "COMPLETED" ? "✓" : stage.stageNumber}
        </span>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm">
            {stage.stageNumber}단계 — {STAGE_NAMES[stage.stageNumber]}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            담당: {stage.assignee?.name ?? "미지정"} · {STATUS_LABEL[stage.status]}
          </p>
        </div>
        <span className="text-slate-400 text-sm">{open ? "▲" : "▼"}</span>
      </button>

      {/* 상세 패널 */}
      {open && (
        <div className="border-t px-4 py-4 space-y-4 bg-slate-50">
          {/* 설명 */}
          <p className="text-sm text-slate-600">{STAGE_DESCRIPTIONS[stage.stageNumber]}</p>

          {/* 날짜 정보 */}
          <div className="grid grid-cols-2 gap-3 text-xs text-slate-500">
            <div>
              <span className="font-semibold">시작일</span>
              <p>{stage.startDate ? new Date(stage.startDate).toLocaleDateString("ko-KR") : "—"}</p>
            </div>
            <div>
              <span className="font-semibold">완료일</span>
              <p>{stage.completedDate ? new Date(stage.completedDate).toLocaleDateString("ko-KR") : "—"}</p>
            </div>
          </div>

          {/* 메모 */}
          {stage.notes && (
            <div className="rounded bg-white border px-3 py-2 text-sm text-slate-600">
              <span className="text-xs font-semibold text-slate-400 block mb-1">메모</span>
              {stage.notes}
            </div>
          )}

          {/* 담당자 지정 (MANAGER/ADMIN만) */}
          {canAssign && stage.status !== "COMPLETED" && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-500">담당자 지정</p>
              <div className="flex gap-2">
                <select
                  className="h-10 flex-1 rounded border px-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={assigneeId}
                  onChange={(e) => setAssigneeId(e.target.value)}
                >
                  <option value="">담당자 선택</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={saving || !assigneeId}
                  onClick={() => void handleAssign()}
                  className="h-10 rounded bg-indigo-600 px-4 text-sm font-semibold text-white disabled:opacity-60"
                >
                  지정
                </button>
              </div>
            </div>
          )}

          {/* 단계 완료 처리 */}
          {canComplete && (
            <form onSubmit={handleComplete} className="space-y-2">
              <p className="text-xs font-semibold text-slate-500">단계 완료 처리</p>
              <textarea
                className="w-full rounded border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="완료 메모 (선택사항)"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
              <button
                type="submit"
                disabled={saving}
                className="h-10 rounded bg-green-600 px-4 text-sm font-semibold text-white disabled:opacity-60"
              >
                {saving ? "처리 중..." : `${stage.stageNumber}단계 완료`}
              </button>
            </form>
          )}

          {/* 4단계: 보류/취소 옵션 */}
          {stage.stageNumber === 4 && canManage && stage.status === "ACTIVE" && (
            <div className="flex gap-2 pt-1">
              <ConfirmDialog
                trigger={
                  <button type="button" className="h-9 rounded border border-amber-300 px-3 text-sm font-medium text-amber-700 hover:bg-amber-50">
                    보류
                  </button>
                }
                title="프로젝트 보류"
                description="이 프로젝트를 보류 상태로 변경합니다."
                confirmLabel="보류"
                onConfirm={() => handleHoldOrCancel("HOLD")}
              />
              <ConfirmDialog
                trigger={
                  <button type="button" className="h-9 rounded border border-red-300 px-3 text-sm font-medium text-red-700 hover:bg-red-50">
                    취소
                  </button>
                }
                title="프로젝트 취소"
                description="이 프로젝트를 취소합니다. 이 작업은 되돌릴 수 없습니다."
                confirmLabel="취소 확정"
                variant="danger"
                onConfirm={() => handleHoldOrCancel("CANCELLED")}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
