"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Option = { id: string; name: string; isActive?: boolean };

export default function NewProjectPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [copyLoadingId, setCopyLoadingId] = useState<string | null>(null);
  const [masters, setMasters] = useState<{
    customers: Option[];
    sites: Option[];
    processTypes: Option[];
    itemTypes: Option[];
  }>({
    customers: [],
    sites: [],
    processTypes: [],
    itemTypes: [],
  });
  const [form, setForm] = useState({
    name: "",
    description: "",
    customerId: "",
    siteId: "",
    processTypeId: "",
    itemTypeId: "",
  });
  const [similarProjects, setSimilarProjects] = useState<
    Array<{
      id: string;
      name: string;
      projectNumber: string;
      customer: { name: string };
      site: { name: string };
      processType: { name: string };
      itemType: { name: string };
    }>
  >([]);
  const [similarLoading, setSimilarLoading] = useState(false);

  useEffect(() => {
    async function bootstrap() {
      const [customers, sites, processTypes, itemTypes] = await Promise.all([
        fetch("/api/v1/master/customers").then((r) => r.json()),
        fetch("/api/v1/master/sites").then((r) => r.json()),
        fetch("/api/v1/master/process-types").then((r) => r.json()),
        fetch("/api/v1/master/item-types").then((r) => r.json()),
      ]);
      setMasters({
        customers: customers.data ?? [],
        sites: sites.data ?? [],
        processTypes: processTypes.data ?? [],
        itemTypes: itemTypes.data ?? [],
      });
    }
    void bootstrap();
  }, []);

  useEffect(() => {
    async function loadSimilarProjects() {
      if (!form.customerId && !form.siteId && !form.processTypeId && !form.itemTypeId) {
        setSimilarProjects([]);
        return;
      }
      setSimilarLoading(true);
      const query = new URLSearchParams({
        ...(form.customerId ? { customerId: form.customerId } : {}),
        ...(form.siteId ? { siteId: form.siteId } : {}),
        ...(form.processTypeId ? { processTypeId: form.processTypeId } : {}),
        ...(form.itemTypeId ? { itemTypeId: form.itemTypeId } : {}),
      });
      const response = await fetch(`/api/v1/projects/similar?${query.toString()}`);
      const payload = await response.json();
      setSimilarProjects(payload.data ?? []);
      setSimilarLoading(false);
    }
    void loadSimilarProjects();
  }, [form.customerId, form.siteId, form.processTypeId, form.itemTypeId]);

  async function onCopyProject(sourceProjectId: string) {
    setCopyLoadingId(sourceProjectId);
    const response = await fetch(`/api/v1/projects/${sourceProjectId}/copy`, {
      method: "POST",
    });
    const payload = await response.json();
    setCopyLoadingId(null);
    if (!payload.success) {
      alert(payload.error?.message ?? "프로젝트 복사 생성 실패");
      return;
    }
    router.push(`/projects/${payload.data.id}`);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    const response = await fetch("/api/v1/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const payload = await response.json();
    setLoading(false);
    if (!payload.success) {
      alert(payload.error?.message ?? "프로젝트 생성 실패");
      return;
    }
    router.push(`/projects/${payload.data.id}`);
  }

  return (
    <section className="grid gap-6 lg:grid-cols-[2fr_1fr]">
      <div className="rounded-xl border bg-white p-6">
        <h1 className="mb-6 text-2xl font-bold">프로젝트 생성</h1>
        <form onSubmit={onSubmit} className="space-y-4">
          <Input label="프로젝트명" value={form.name} onChange={(v) => setForm((p) => ({ ...p, name: v }))} />
          <Input
            label="설명"
            value={form.description}
            onChange={(v) => setForm((p) => ({ ...p, description: v }))}
          />
          <Select
            label="고객사"
            value={form.customerId}
            options={masters.customers}
            onChange={(v) => setForm((p) => ({ ...p, customerId: v }))}
          />
          <Select
            label="사업장"
            value={form.siteId}
            options={masters.sites}
            onChange={(v) => setForm((p) => ({ ...p, siteId: v }))}
          />
          <Select
            label="공정"
            value={form.processTypeId}
            options={masters.processTypes}
            onChange={(v) => setForm((p) => ({ ...p, processTypeId: v }))}
          />
          <Select
            label="품목"
            value={form.itemTypeId}
            options={masters.itemTypes}
            onChange={(v) => setForm((p) => ({ ...p, itemTypeId: v }))}
          />
          <button
            type="submit"
            disabled={loading}
            className="h-11 rounded bg-blue-600 px-4 font-semibold text-white disabled:opacity-60"
          >
            {loading ? "생성 중..." : "신규 프로젝트 생성"}
          </button>
        </form>
      </div>

      <aside className="rounded-xl border bg-white p-4">
        <h2 className="text-lg font-semibold">유사 프로젝트 추천</h2>
        <p className="mt-1 text-sm text-slate-500">고객사/사업장/공정/품목 기준 유사 프로젝트</p>

        <div className="mt-4 space-y-3">
          {similarLoading ? (
            <div className="flex items-center gap-2 rounded border border-dashed p-4 text-sm text-slate-400">
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-blue-500" />
              유사 프로젝트 검색 중...
            </div>
          ) : similarProjects.length === 0 ? (
            <div className="rounded border border-dashed p-4 text-center text-sm text-slate-400">
              {form.customerId || form.siteId || form.processTypeId || form.itemTypeId
                ? "조건에 맞는 유사 프로젝트가 없습니다."
                : "고객사/사업장/공정/품목을 선택하면\n유사 프로젝트가 표시됩니다."}
            </div>
          ) : (
            <>
              <p className="text-xs font-semibold text-slate-400">{similarProjects.length}건 발견</p>
              {similarProjects.map((project) => (
                <article key={project.id} className="rounded-lg border p-3 hover:border-blue-300 hover:bg-blue-50 transition-colors">
                  <p className="font-semibold text-sm leading-snug">{project.name}</p>
                  <p className="mt-1 text-xs text-slate-500">{project.projectNumber}</p>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {project.customer.name ? (
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">{project.customer.name}</span>
                    ) : null}
                    {project.site.name ? (
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">{project.site.name}</span>
                    ) : null}
                    {project.processType.name ? (
                      <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] text-blue-700">{project.processType.name}</span>
                    ) : null}
                    {project.itemType.name ? (
                      <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] text-indigo-700">{project.itemType.name}</span>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => onCopyProject(project.id)}
                    disabled={copyLoadingId === project.id}
                    className="mt-2.5 h-9 w-full rounded border border-blue-200 bg-white px-3 text-sm font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-60 transition-colors"
                  >
                    {copyLoadingId === project.id ? "복사 중..." : "이 프로젝트 복사 생성"}
                  </button>
                </article>
              ))}
            </>
          )}
        </div>
      </aside>
    </section>
  );
}

function Input({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold">{label}</span>
      <input className="h-11 w-full rounded border px-3" value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Option[];
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold">{label}</span>
      <select className="h-11 w-full rounded border px-3" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">선택</option>
        {options.filter((o) => o.isActive !== false).map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </select>
    </label>
  );
}
