"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { useToastStore } from "@/store/toast-store";

type NotificationRow = {
  id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  isRead: boolean;
  createdAt: string;
};

const TYPE_ICON: Record<string, string> = {
  STAGE_ASSIGNED: "👤",
  NEXT_STAGE_READY: "▶️",
  PASSWORD_RESET_REQUEST: "🔑",
  PASSWORD_RESET_COMPLETED: "✅",
  DRIVE_SYNC_FAILED: "⚠️",
  DRIVE_WATCH_EXPIRED: "🔔",
};

export default function NotificationsPage() {
  const toast = useToastStore();
  const [rows, setRows] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);

  const fetchNotifications = useCallback(async () => {
    const res = await fetch("/api/v1/notifications");
    const payload = await res.json();
    setRows(payload.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { void fetchNotifications(); }, [fetchNotifications]);

  async function markAsRead(id: string) {
    await fetch(`/api/v1/notifications/${id}/read`, { method: "PATCH" });
    setRows((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    window.dispatchEvent(new Event("notif-updated"));
  }

  async function markAllAsRead() {
    setMarkingAll(true);
    await fetch("/api/v1/notifications/read-all", { method: "POST" });
    setRows((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setMarkingAll(false);
    toast.success("모든 알림을 읽음으로 표시했습니다.");
    window.dispatchEvent(new Event("notif-updated"));
  }

  const unreadCount = rows.filter((n) => !n.isRead).length;

  return (
    <section className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">
          알림
          {unreadCount > 0 && (
            <span className="ml-2 rounded-full bg-red-500 px-2 py-0.5 text-sm font-semibold text-white">
              {unreadCount}
            </span>
          )}
        </h1>
        {unreadCount > 0 && (
          <button
            type="button"
            onClick={() => void markAllAsRead()}
            disabled={markingAll}
            className="rounded border px-3 py-1.5 text-sm font-medium hover:bg-slate-50 disabled:opacity-60"
          >
            {markingAll ? "처리 중..." : "모두 읽음"}
          </button>
        )}
      </div>

      <div className="rounded-xl border bg-white overflow-hidden">
        {loading ? (
          <div className="flex items-center gap-2 p-6 text-slate-400">
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-blue-500" />
            알림을 불러오는 중입니다...
          </div>
        ) : rows.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-4xl mb-3">🔔</p>
            <p className="font-semibold text-slate-600">새 알림이 없습니다</p>
          </div>
        ) : (
          <ul className="divide-y">
            {rows.map((row) => (
              <li
                key={row.id}
                className={`flex gap-3 px-4 py-3 transition-colors ${
                  row.isRead ? "bg-white" : "bg-blue-50"
                }`}
              >
                <span className="mt-0.5 text-xl flex-shrink-0">
                  {TYPE_ICON[row.type] ?? "🔔"}
                </span>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm ${row.isRead ? "text-slate-700" : "font-semibold text-slate-900"}`}>
                    {row.title}
                  </p>
                  <p className="mt-0.5 text-sm text-slate-500">{row.message}</p>
                  <div className="mt-1 flex items-center gap-3">
                    <span className="text-xs text-slate-400">
                      {new Date(row.createdAt).toLocaleString("ko-KR")}
                    </span>
                    {row.link && (
                      <Link
                        href={row.link as Route}
                        className="text-xs text-blue-600 hover:underline"
                        onClick={() => { if (!row.isRead) void markAsRead(row.id); }}
                      >
                        바로가기 →
                      </Link>
                    )}
                  </div>
                </div>
                {!row.isRead && (
                  <button
                    type="button"
                    onClick={() => void markAsRead(row.id)}
                    className="flex-shrink-0 self-start mt-1 h-6 w-6 rounded-full bg-blue-100 text-blue-600 text-xs hover:bg-blue-200"
                    title="읽음 표시"
                  >
                    ✓
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
