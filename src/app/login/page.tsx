"use client";

import { FormEvent, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);
    const result = await signIn("credentials", {
      loginId,
      password,
      redirect: false,
    });
    setLoading(false);
    if (result?.error) {
      if (result.error === "Configuration") {
        setError("시스템 설정 오류입니다. DATABASE_URL/NEXTAUTH_SECRET 값을 확인해 주세요.");
      } else {
        setError("로그인에 실패했습니다. 계정 정보를 확인해 주세요.");
      }
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <form onSubmit={onSubmit} className="w-full max-w-md rounded-xl border bg-white p-6 shadow-sm">
        <h1 className="mb-6 text-2xl font-bold">PlusPMS 로그인</h1>
        <p className="mb-4 text-sm text-slate-500">
          테스트 계정: admin/admin, manager/manager, test/test
        </p>
        <div className="space-y-2">
          <label className="text-sm font-semibold">아이디</label>
          <input
            className="h-11 w-full rounded border px-3"
            type="text"
            title="아이디"
            value={loginId}
            onChange={(e) => setLoginId(e.target.value)}
            placeholder="admin | manager | test"
            required
          />
        </div>
        <div className="mt-4 space-y-2">
          <label className="text-sm font-semibold">비밀번호</label>
          <input
            className="h-11 w-full rounded border px-3"
            type="password"
            title="비밀번호"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="비밀번호 입력"
            required
          />
        </div>
        {error ? <p className="mt-3 text-sm text-red-500">{error}</p> : null}
        <button
          disabled={loading}
          className="mt-6 h-11 w-full rounded bg-blue-600 font-semibold text-white disabled:opacity-60"
          type="submit"
        >
          {loading ? "로그인 중..." : "로그인"}
        </button>
      </form>
    </main>
  );
}
