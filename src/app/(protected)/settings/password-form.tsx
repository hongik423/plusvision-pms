"use client";

import { FormEvent, useState } from "react";

type FormState = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

export function PasswordForm() {
  const [form, setForm] = useState<FormState>({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  function onChange(field: keyof FormState) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setMessage(null);

    if (form.newPassword !== form.confirmPassword) {
      setMessage({ type: "error", text: "새 비밀번호와 확인 비밀번호가 일치하지 않습니다." });
      return;
    }

    if (form.newPassword.length < 8) {
      setMessage({ type: "error", text: "새 비밀번호는 8자 이상이어야 합니다." });
      return;
    }

    setSaving(true);
    const res = await fetch("/api/v1/users/me/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      }),
    });
    const payload = await res.json();
    setSaving(false);

    if (!payload.success) {
      setMessage({ type: "error", text: payload.error?.message ?? "비밀번호 변경에 실패했습니다." });
      return;
    }

    setMessage({ type: "success", text: "비밀번호가 성공적으로 변경되었습니다." });
    setForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <label className="block text-sm">
        <span className="mb-1 block font-semibold">현재 비밀번호</span>
        <input
          type="password"
          className="h-11 w-full rounded border px-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={form.currentPassword}
          onChange={onChange("currentPassword")}
          autoComplete="current-password"
          required
        />
      </label>

      <label className="block text-sm">
        <span className="mb-1 block font-semibold">새 비밀번호</span>
        <input
          type="password"
          className="h-11 w-full rounded border px-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={form.newPassword}
          onChange={onChange("newPassword")}
          autoComplete="new-password"
          minLength={8}
          required
        />
        <span className="mt-1 block text-xs text-slate-400">8자 이상 입력해 주세요.</span>
      </label>

      <label className="block text-sm">
        <span className="mb-1 block font-semibold">새 비밀번호 확인</span>
        <input
          type="password"
          className="h-11 w-full rounded border px-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={form.confirmPassword}
          onChange={onChange("confirmPassword")}
          autoComplete="new-password"
          required
        />
      </label>

      {message ? (
        <p
          className={`rounded px-3 py-2 text-sm ${
            message.type === "success"
              ? "bg-green-50 text-green-700"
              : "bg-red-50 text-red-700"
          }`}
        >
          {message.text}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={saving}
        className="h-11 rounded bg-slate-900 px-5 text-white disabled:opacity-60"
      >
        {saving ? "변경 중..." : "비밀번호 변경"}
      </button>
    </form>
  );
}
