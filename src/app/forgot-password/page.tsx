"use client";

import { FormEvent, useState } from "react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    const response = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const payload = await response.json();
    setLoading(false);
    setMessage(payload.data?.message ?? "요청이 접수되었습니다.");
    setEmail("");
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <section className="w-full max-w-md rounded-xl border bg-white p-6">
        <h1 className="text-2xl font-bold">비밀번호 재설정</h1>
        <p className="mt-3 text-sm text-slate-600">가입한 이메일을 입력하면 비밀번호 재설정 링크를 발송합니다.</p>
        <form className="mt-5 space-y-3" onSubmit={onSubmit}>
          <label className="block text-sm">
            <span className="mb-1 block font-semibold">이메일</span>
            <input
              type="email"
              className="h-11 w-full rounded border px-3"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>
          {message ? <p className="text-sm text-slate-700">{message}</p> : null}
          <button type="submit" disabled={loading} className="h-11 rounded bg-blue-600 px-4 text-white disabled:opacity-60">
            {loading ? "요청 중..." : "재설정 요청"}
          </button>
        </form>
      </section>
    </main>
  );
}
