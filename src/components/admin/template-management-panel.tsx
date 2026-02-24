"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type TemplateType = "ESTIMATE" | "PROPOSAL";

type TemplateRow = {
  id: string;
  type: TemplateType;
  name: string;
  titleTemplate: string;
  bodyTemplate: string;
  isActive: boolean;
  updatedAt: string;
};

const TEMPLATE_TYPE_LABELS: Record<TemplateType, string> = {
  ESTIMATE: "견적서",
  PROPOSAL: "제안서",
};

export function TemplateManagementPanel() {
  const [rows, setRows] = useState<TemplateRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState({
    type: "ESTIMATE" as TemplateType,
    name: "",
    titleTemplate: "",
    bodyTemplate: "",
  });

  const selected = useMemo(() => rows.find((row) => row.id === selectedId) ?? null, [rows, selectedId]);

  async function fetchRows() {
    setLoading(true);
    const response = await fetch("/api/v1/templates");
    const payload = await response.json();
    setRows(payload.data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    void fetchRows();
  }, []);

  useEffect(() => {
    if (!selected) {
      return;
    }
    setForm({
      type: selected.type,
      name: selected.name,
      titleTemplate: selected.titleTemplate,
      bodyTemplate: selected.bodyTemplate,
    });
  }, [selectedId, selected]);

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    const response = await fetch("/api/v1/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const payload = await response.json();
    setSaving(false);
    if (!payload.success) {
      alert(payload.error?.message ?? "템플릿 생성에 실패했습니다.");
      return;
    }
    setSelectedId(payload.data.id);
    await fetchRows();
  }

  async function onUpdate(event: FormEvent) {
    event.preventDefault();
    if (!selectedId) {
      return;
    }
    setSaving(true);
    const response = await fetch(`/api/v1/templates/${selectedId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const payload = await response.json();
    setSaving(false);
    if (!payload.success) {
      alert(payload.error?.message ?? "템플릿 수정에 실패했습니다.");
      return;
    }
    await fetchRows();
  }

  async function onActivate(templateId: string) {
    const response = await fetch(`/api/v1/templates/${templateId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: true }),
    });
    const payload = await response.json();
    if (!payload.success) {
      alert(payload.error?.message ?? "활성화 실패");
      return;
    }
    await fetchRows();
  }

  return (
    <section className="grid gap-6 lg:grid-cols-[360px_1fr]">
      <aside className="rounded-xl border bg-white p-4">
        <h1 className="mb-3 text-2xl font-bold">템플릿 관리</h1>
        {loading ? (
          <p className="text-sm text-slate-500">목록을 불러오는 중입니다...</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-slate-500">등록된 템플릿이 없습니다.</p>
        ) : (
          <ul className="space-y-2">
            {rows.map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  className={`w-full rounded border p-3 text-left text-sm ${
                    selectedId === row.id ? "border-blue-500 bg-blue-50" : "hover:bg-slate-50"
                  }`}
                  onClick={() => setSelectedId(row.id)}
                >
                  <p className="font-semibold">{row.name}</p>
                  <p className="text-xs text-slate-500">
                    {TEMPLATE_TYPE_LABELS[row.type]} · {row.isActive ? "활성" : "비활성"}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </aside>

      <form onSubmit={selectedId ? onUpdate : onCreate} className="space-y-4 rounded-xl border bg-white p-5">
        <h2 className="text-xl font-semibold">{selectedId ? "템플릿 수정" : "템플릿 생성"}</h2>
        <label className="block text-sm">
          <span className="mb-1 block font-semibold">템플릿 유형</span>
          <select
            className="h-11 w-full rounded border px-3"
            value={form.type}
            disabled={Boolean(selectedId)}
            onChange={(event) => setForm((prev) => ({ ...prev, type: event.target.value as TemplateType }))}
          >
            <option value="ESTIMATE">견적서</option>
            <option value="PROPOSAL">제안서</option>
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-semibold">템플릿 이름</span>
          <input
            className="h-11 w-full rounded border px-3"
            value={form.name}
            onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-semibold">제목 템플릿</span>
          <input
            className="h-11 w-full rounded border px-3"
            value={form.titleTemplate}
            onChange={(event) => setForm((prev) => ({ ...prev, titleTemplate: event.target.value }))}
          />
          <p className="mt-1 text-xs text-slate-500">사용 가능 변수: {"{{projectName}}"}, {"{{customerName}}"}</p>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-semibold">본문 템플릿</span>
          <textarea
            className="min-h-[280px] w-full rounded border px-3 py-2"
            value={form.bodyTemplate}
            onChange={(event) => setForm((prev) => ({ ...prev, bodyTemplate: event.target.value }))}
          />
        </label>

        <div className="flex flex-wrap gap-2">
          <button type="submit" className="h-11 rounded bg-blue-600 px-4 text-white disabled:opacity-60" disabled={saving}>
            {saving ? "저장 중..." : selectedId ? "템플릿 수정" : "템플릿 생성"}
          </button>
          {selectedId ? (
            <>
              <button
                type="button"
                className="h-11 rounded border px-4"
                onClick={() => {
                  setSelectedId(null);
                  setForm({
                    type: "ESTIMATE",
                    name: "",
                    titleTemplate: "",
                    bodyTemplate: "",
                  });
                }}
              >
                새 템플릿 작성
              </button>
              <button type="button" className="h-11 rounded border px-4" onClick={() => void onActivate(selectedId)}>
                이 템플릿 활성화
              </button>
            </>
          ) : null}
        </div>
      </form>
    </section>
  );
}
