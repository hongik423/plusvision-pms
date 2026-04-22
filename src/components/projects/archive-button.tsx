"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ArchiveButton({ projectId, isArchived }: { projectId: string; isArchived: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    await fetch(`/api/v1/projects/${projectId}/archive`, {
      method: isArchived ? "DELETE" : "POST",
    });
    setLoading(false);
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className={`rounded border px-2 py-1 text-xs font-medium transition-colors disabled:opacity-50 ${
        isArchived
          ? "border-blue-300 text-blue-600 hover:bg-blue-50"
          : "border-slate-300 text-slate-500 hover:bg-slate-50"
      }`}
    >
      {loading ? "..." : isArchived ? "보관 해제" : "보관"}
    </button>
  );
}
