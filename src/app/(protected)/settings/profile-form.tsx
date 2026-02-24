"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function ProfileForm({ initialName }: { initialName: string }) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    const res = await fetch("/api/v1/users/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() }),
    });
    const payload = await res.json();
    setSaving(false);

    if (!payload.success) {
      setMessage({ type: "error", text: payload.error?.message ?? "저장에 실패했습니다." });
      return;
    }

    setMessage({ type: "success", text: "이름이 변경되었습니다. 다음 로그인 시 반영됩니다." });
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <label className="block text-sm">
        <span className="mb-1 block font-semibold">이름</span>
        <input
          className="h-11 w-full rounded border px-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={50}
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
        disabled={saving || name.trim() === initialName}
        className="h-11 rounded bg-blue-600 px-5 text-white disabled:opacity-60"
      >
        {saving ? "저장 중..." : "이름 변경"}
      </button>
    </form>
  );
}
