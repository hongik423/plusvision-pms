"use client";

import { FormEvent, Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

type PageState = "form" | "success" | "invalid";

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [pageState, setPageState] = useState<PageState>(token ? "form" : "invalid");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErrorMsg("");

    if (newPassword.length < 8) {
      setErrorMsg("새 비밀번호는 8자 이상이어야 합니다.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMsg("비밀번호와 확인 비밀번호가 일치하지 않습니다.");
      return;
    }

    setLoading(true);
    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, newPassword }),
    });
    const payload = await res.json();
    setLoading(false);

    if (!payload.success) {
      if (payload.error?.code === "INVALID_TOKEN") {
        setPageState("invalid");
      } else {
        setErrorMsg(payload.error?.message ?? "비밀번호 재설정에 실패했습니다.");
      }
      return;
    }

    setPageState("success");
    setTimeout(() => router.push("/login"), 3000);
  }

  if (pageState === "invalid") {
    return (
      <section className="w-full max-w-md rounded-xl border bg-white p-8 text-center">
        <div className="text-5xl mb-4">⚠️</div>
        <h1 className="text-xl font-bold text-slate-800">링크가 만료되었습니다</h1>
        <p className="mt-3 text-sm text-slate-500">
          비밀번호 재설정 링크가 만료되었거나 유효하지 않습니다.
          <br />
          비밀번호 재설정을 다시 요청해 주세요.
        </p>
        <Link
          href="/forgot-password"
          className="mt-6 inline-block rounded bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
        >
          비밀번호 재설정 재요청
        </Link>
      </section>
    );
  }

  if (pageState === "success") {
    return (
      <section className="w-full max-w-md rounded-xl border bg-white p-8 text-center">
        <div className="text-5xl mb-4">✅</div>
        <h1 className="text-xl font-bold text-slate-800">비밀번호 재설정 완료</h1>
        <p className="mt-3 text-sm text-slate-500">
          비밀번호가 성공적으로 변경되었습니다.
          <br />
          잠시 후 로그인 페이지로 이동합니다.
        </p>
        <Link
          href="/login"
          className="mt-6 inline-block rounded bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
        >
          로그인 페이지로 이동
        </Link>
      </section>
    );
  }

  return (
    <section className="w-full max-w-md rounded-xl border bg-white p-8">
      <h1 className="text-2xl font-bold">새 비밀번호 설정</h1>
      <p className="mt-2 text-sm text-slate-500">
        새로운 비밀번호를 입력해 주세요. (8자 이상)
      </p>

      <form className="mt-6 space-y-4" onSubmit={onSubmit}>
        <label className="block text-sm">
          <span className="mb-1 block font-semibold">새 비밀번호</span>
          <input
            type="password"
            className="h-11 w-full rounded border px-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
            minLength={8}
            required
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-semibold">새 비밀번호 확인</span>
          <input
            type="password"
            className="h-11 w-full rounded border px-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
            required
          />
        </label>

        {errorMsg ? (
          <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{errorMsg}</p>
        ) : null}

        <button
          type="submit"
          disabled={loading}
          className="h-11 w-full rounded bg-blue-600 font-semibold text-white disabled:opacity-60"
        >
          {loading ? "변경 중..." : "비밀번호 변경"}
        </button>
      </form>

      <p className="mt-4 text-center text-sm text-slate-400">
        <Link href="/login" className="hover:underline text-blue-600">
          로그인으로 돌아가기
        </Link>
      </p>
    </section>
  );
}

export default function ResetPasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <Suspense
        fallback={
          <div className="flex items-center gap-2 text-slate-400">
            <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-blue-500" />
            로딩 중...
          </div>
        }
      >
        <ResetPasswordContent />
      </Suspense>
    </main>
  );
}
