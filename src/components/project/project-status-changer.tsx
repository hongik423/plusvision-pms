"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  projectId: string;
  currentStatus: string;
};

const STATUS_OPTIONS = [
  { value: "ACTIVE",     label: "진행중" },
  { value: "HOLD",       label: "보류" },
  { value: "CANCELLED",  label: "취소" },
];

export function ProjectStatusChanger({ projectId, currentStatus }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function changeStatus(status: string) {
    if (status === currentStatus) return;
    const label = STATUS_OPTIONS.find((o) => o.value === status)?.label ?? status;
    if (!confirm(`프로젝트 상태를 "${label}"(으)로 변경하시겠습니까?`)) return;

    setLoading(true);
    const res = await fetch(`/api/v1/projects/${projectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const payload = await res.json();
    setLoading(false);

    if (!payload.success) {
      alert(payload.error?.message ?? "상태 변경에 실패했습니다.");
      return;
    }
    router.refresh();
  }

  const others = STATUS_OPTIONS.filter((o) => o.value !== currentStatus && o.value !== "ACTIVE");

  return (
    <div className="flex gap-1.5">
      {currentStatus !== "ACTIVE" && (
        <button
          onClick={() => changeStatus("ACTIVE")}
          disabled={loading}
          className="rounded border border-blue-300 px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 disabled:opacity-60"
        >
          진행중으로 변경
        </button>
      )}
      {others.map((o) => (
        <button
          key={o.value}
          onClick={() => changeStatus(o.value)}
          disabled={loading}
          className={`rounded border px-3 py-1.5 text-xs font-medium disabled:opacity-60 ${
            o.value === "CANCELLED"
              ? "border-red-200 text-red-600 hover:bg-red-50"
              : "border-amber-200 text-amber-600 hover:bg-amber-50"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
