"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useState } from "react";
import { NotificationBell } from "./notification-bell";

type NavItem = { href: string; label: string; adminOnly?: boolean };

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "대시보드" },
  { href: "/projects", label: "프로젝트" },
  { href: "/drive", label: "자료실" },
  { href: "/search", label: "검색" },
  { href: "/admin/master", label: "관리", adminOnly: true },
  { href: "/admin/migration", label: "마이그레이션", adminOnly: true },
  { href: "/settings", label: "설정" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { data } = useSession();
  const pathname = usePathname() ?? "";
  const role = data?.user?.role ?? "VIEWER";
  const isAdmin = role === "ADMIN";
  const [mobileOpen, setMobileOpen] = useState(false);

  const visibleItems = NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* 헤더 */}
      <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b bg-white px-4 md:px-6 shadow-sm">
        {/* 로고 */}
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="text-xl font-bold text-blue-700">
            PlusPMS
          </Link>

          {/* 데스크탑 네비게이션 */}
          <nav className="hidden md:flex items-center gap-1">
            {visibleItems.map((item) => {
              const active = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href as Route}
                  className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    active
                      ? "bg-blue-50 text-blue-700"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* 우측 영역 */}
        <div className="flex items-center gap-2">
          {/* 알림 벨 (로그인 시에만) */}
          {data?.user && <NotificationBell />}

          <span className="hidden md:block text-sm text-slate-500 ml-1">{data?.user?.name ?? ""}</span>
          {data?.user ? (
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="hidden md:block rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700"
            >
              로그아웃
            </button>
          ) : (
            <Link
              href="/login"
              className="hidden md:block rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700"
            >
              로그인
            </Link>
          )}

          {/* 모바일 햄버거 버튼 */}
          <button
            type="button"
            className="md:hidden flex flex-col justify-center items-center h-10 w-10 gap-1.5 rounded-lg hover:bg-slate-100"
            onClick={() => setMobileOpen((prev) => !prev)}
            aria-label="메뉴 열기"
          >
            <span className={`block h-0.5 w-5 bg-slate-700 transition-transform ${mobileOpen ? "translate-y-2 rotate-45" : ""}`} />
            <span className={`block h-0.5 w-5 bg-slate-700 transition-opacity ${mobileOpen ? "opacity-0" : ""}`} />
            <span className={`block h-0.5 w-5 bg-slate-700 transition-transform ${mobileOpen ? "-translate-y-2 -rotate-45" : ""}`} />
          </button>
        </div>
      </header>

      {/* 모바일 드로어 */}
      {mobileOpen && (
        <>
          {/* 오버레이 */}
          <div
            className="fixed inset-0 z-30 bg-black/30 md:hidden"
            onClick={() => setMobileOpen(false)}
          />
          {/* 슬라이드 메뉴 */}
          <nav className="fixed top-16 right-0 z-40 w-64 h-[calc(100vh-4rem)] overflow-y-auto border-l bg-white shadow-xl md:hidden">
            <div className="p-4 border-b">
              <p className="font-semibold text-slate-800">{data?.user?.name ?? "사용자"}</p>
              <p className="text-sm text-slate-500">{data?.user?.email ?? ""}</p>
            </div>
            <ul className="p-2 space-y-1">
              {/* 알림 항목 (모바일만) */}
              <li>
                <Link
                  href="/notifications"
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                    pathname.startsWith("/notifications") ? "bg-blue-50 text-blue-700" : "text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  <span>알림</span>
                </Link>
              </li>
              {visibleItems.map((item) => {
                const active = pathname.startsWith(item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href as Route}
                      onClick={() => setMobileOpen(false)}
                      className={`flex items-center rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                        active
                          ? "bg-blue-50 text-blue-700"
                          : "text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
            <div className="p-4 border-t">
              {data?.user ? (
                <button
                  onClick={() => { setMobileOpen(false); void signOut({ callbackUrl: "/login" }); }}
                  className="w-full rounded-lg bg-slate-900 px-3 py-2.5 text-sm font-medium text-white hover:bg-slate-700"
                >
                  로그아웃
                </button>
              ) : (
                <Link
                  href="/login"
                  onClick={() => setMobileOpen(false)}
                  className="block w-full rounded-lg bg-slate-900 px-3 py-2.5 text-center text-sm font-medium text-white"
                >
                  로그인
                </Link>
              )}
            </div>
          </nav>
        </>
      )}

      {/* 메인 콘텐츠 */}
      <main className="mx-auto max-w-7xl px-4 py-6 md:px-6">{children}</main>
    </div>
  );
}
