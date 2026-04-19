"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export function NotificationBell() {
  const [unread, setUnread] = useState(0);

  async function fetchCount() {
    try {
      const res = await fetch("/api/v1/notifications/unread-count", { cache: "no-store" });
      if (res.ok) {
        const payload = await res.json();
        setUnread(payload.data?.count ?? 0);
      }
    } catch {
      // 네트워크 오류 무시
    }
  }

  useEffect(() => {
    void fetchCount();
    const timer = setInterval(() => void fetchCount(), 60_000);
    // 알림 읽음 처리 시 즉시 갱신
    const handler = () => void fetchCount();
    window.addEventListener("notif-updated", handler);
    return () => {
      clearInterval(timer);
      window.removeEventListener("notif-updated", handler);
    };
  }, []);

  return (
    <Link
      href="/notifications"
      className="relative flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 transition-colors"
      aria-label={`알림${unread > 0 ? ` (${unread}건 미읽음)` : ""}`}
    >
      {/* 벨 아이콘 */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>

      {/* 미읽음 배지 */}
      {unread > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-0.5 text-[10px] font-bold text-white leading-none">
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </Link>
  );
}
