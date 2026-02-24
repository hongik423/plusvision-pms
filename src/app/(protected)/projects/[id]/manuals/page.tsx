"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";

type ManualRow = {
  id: string;
  type: "MANUFACTURE" | "INSTALL";
  title: string;
  content: string;
  version: number;
  updatedAt: string;
  createdBy: {
    name: string;
  };
};

const MANUAL_TYPE_LABELS: Record<ManualRow["type"], string> = {
  MANUFACTURE: "제작 매뉴얼",
  INSTALL: "설치 매뉴얼",
};

export default function ProjectManualsPage() {
  const params = useParams<{ id: string }>();
  const projectId = params.id;

  const [rows, setRows] = useState<ManualRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState({
    type: "MANUFACTURE" as ManualRow["type"],
    title: "",
    content: "",
  });

  const selected = rows.find((row) => row.id === selectedId) ?? null;

  const fetchRows = useCallback(async () => {
    setLoading(true);
    const response = await fetch(`/api/v1/projects/${projectId}/manuals`);
    const payload = await response.json();
    setRows(payload.data ?? []);
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    void fetchRows();
  }, [fetchRows]);

  useEffect(() => {
    if (!selected) {
      return;
    }
    setForm({
      type: selected.type,
      title: selected.title,
      content: selected.content,
    });
  }, [selectedId, selected]);

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    const response = await fetch(`/api/v1/projects/${projectId}/manuals`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const payload = await response.json();
    setSaving(false);
    if (!payload.success) {
      alert(payload.error?.message ?? "매뉴얼 생성에 실패했습니다.");
      return;
    }
    setSelectedId(payload.data.id);
    await fetchRows();
  }

  async function onUpdate(event: FormEvent) {
    event.preventDefault();
    if (!selectedId) {
      alert("수정할 매뉴얼을 선택해 주세요.");
      return;
    }
    setSaving(true);
    const response = await fetch(`/api/v1/manuals/${selectedId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: form.title,
        content: form.content,
      }),
    });
    const payload = await response.json();
    setSaving(false);
    if (!payload.success) {
      alert(payload.error?.message ?? "매뉴얼 수정에 실패했습니다.");
      return;
    }
    await fetchRows();
  }

  return (
    <section className="grid gap-6 lg:grid-cols-[320px_1fr]">
      <aside className="rounded-xl border bg-white p-4">
        <h1 className="mb-3 text-2xl font-bold">매뉴얼</h1>
        {loading ? (
          <p className="text-sm text-slate-500">매뉴얼 목록을 불러오는 중입니다...</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-slate-500">등록된 매뉴얼이 없습니다.</p>
        ) : (
          <ul className="space-y-2">
            {rows.map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(row.id)}
                  className={`w-full rounded border px-3 py-2 text-left text-sm ${
                    selectedId === row.id ? "border-blue-500 bg-blue-50" : "hover:bg-slate-50"
                  }`}
                >
                  <p className="font-semibold">{row.title}</p>
                  <p className="text-xs text-slate-500">
                    {MANUAL_TYPE_LABELS[row.type]} · v{row.version}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </aside>

      <form onSubmit={selectedId ? onUpdate : onCreate} className="space-y-4 rounded-xl border bg-white p-5">
        <h2 className="text-xl font-semibold">{selectedId ? "매뉴얼 수정" : "매뉴얼 등록"}</h2>
        <label className="block text-sm">
          <span className="mb-1 block font-semibold">매뉴얼 유형</span>
          <select
            className="h-11 w-full rounded border px-3"
            value={form.type}
            disabled={Boolean(selectedId)}
            onChange={(event) => setForm((prev) => ({ ...prev, type: event.target.value as ManualRow["type"] }))}
          >
            <option value="MANUFACTURE">제작 매뉴얼</option>
            <option value="INSTALL">설치 매뉴얼</option>
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-semibold">제목</span>
          <input
            className="h-11 w-full rounded border px-3"
            value={form.title}
            onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-semibold">내용</span>
          <textarea
            className="min-h-[360px] w-full rounded border px-3 py-2"
            value={form.content}
            onChange={(event) => setForm((prev) => ({ ...prev, content: event.target.value }))}
          />
        </label>

        {selected ? (
          <p className="text-xs text-slate-500">
            마지막 수정: {new Date(selected.updatedAt).toLocaleString()} · 작성자: {selected.createdBy.name}
          </p>
        ) : null}

        <div className="flex gap-2">
          <button type="submit" className="h-11 rounded bg-blue-600 px-4 text-white disabled:opacity-60" disabled={saving}>
            {saving ? "저장 중..." : selectedId ? "매뉴얼 수정" : "매뉴얼 등록"}
          </button>
          {selectedId ? (
            <button
              type="button"
              className="h-11 rounded border px-4"
              onClick={() => {
                setSelectedId(null);
                setForm({ type: "MANUFACTURE", title: "", content: "" });
              }}
            >
              새 매뉴얼 작성
            </button>
          ) : null}
        </div>
      </form>
    </section>
  );
}
