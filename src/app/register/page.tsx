"use client";

import { FormEvent, useState } from "react";

export default function RegisterPage() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    department: "",
    phone: "",
  });

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    const response = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const payload = await response.json();
    setLoading(false);
    if (!response.ok || !payload.success) {
      setMessage(payload.error?.message ?? "회원가입 요청에 실패했습니다.");
      return;
    }
    setMessage("회원가입 요청이 접수되었습니다. 관리자 승인 후 로그인할 수 있습니다.");
    setForm({
      name: "",
      email: "",
      password: "",
      department: "",
      phone: "",
    });
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <section className="w-full max-w-xl rounded-xl border bg-white p-6">
        <h1 className="text-2xl font-bold">회원가입</h1>
        <p className="mt-3 text-sm text-slate-600">회원가입 요청 후 관리자 승인이 완료되면 로그인할 수 있습니다.</p>
        <form className="mt-5 space-y-3" onSubmit={onSubmit}>
          <label className="block text-sm">
            <span className="mb-1 block font-semibold">이름</span>
            <input
              className="h-11 w-full rounded border px-3"
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
              required
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-semibold">이메일</span>
            <input
              type="email"
              className="h-11 w-full rounded border px-3"
              value={form.email}
              onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
              required
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-semibold">비밀번호</span>
            <input
              type="password"
              className="h-11 w-full rounded border px-3"
              value={form.password}
              onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
              required
            />
          </label>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1 block font-semibold">부서</span>
              <input
                className="h-11 w-full rounded border px-3"
                value={form.department}
                onChange={(event) => setForm((prev) => ({ ...prev, department: event.target.value }))}
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-semibold">연락처</span>
              <input
                className="h-11 w-full rounded border px-3"
                value={form.phone}
                onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
              />
            </label>
          </div>
          {message ? <p className="text-sm text-slate-700">{message}</p> : null}
          <button type="submit" disabled={loading} className="h-11 rounded bg-blue-600 px-4 text-white disabled:opacity-60">
            {loading ? "요청 중..." : "회원가입 요청"}
          </button>
        </form>
      </section>
    </main>
  );
}
