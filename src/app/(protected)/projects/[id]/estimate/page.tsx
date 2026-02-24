"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

type PartSpec = {
  id: string;
  name: string;
  specification: string;
  unit: string;
  unitPrice: string | number | null;
};

type EstimateRow = {
  id: string;
  estimateNumber: string;
  title: string;
  grandTotal: string | number;
  createdAt: string;
  createdBy: {
    name: string;
  };
};

type TemplateRow = {
  id: string;
  type: "ESTIMATE" | "PROPOSAL";
  name: string;
  titleTemplate: string;
  bodyTemplate: string;
  isActive: boolean;
};

type ProjectMeta = {
  name: string;
  customer: { name: string };
  site: { name: string };
  processType: { name: string };
  itemType: { name: string };
};

type DraftItem = {
  partSpecId: string;
  itemName: string;
  specification: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  remarks: string;
};

const EMPTY_ITEM: DraftItem = {
  partSpecId: "",
  itemName: "",
  specification: "",
  unit: "EA",
  quantity: 1,
  unitPrice: 0,
  remarks: "",
};

export default function ProjectEstimatePage() {
  const params = useParams<{ id: string }>();
  const projectId = params.id;

  const [partSpecs, setPartSpecs] = useState<PartSpec[]>([]);
  const [estimates, setEstimates] = useState<EstimateRow[]>([]);
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [projectMeta, setProjectMeta] = useState<ProjectMeta | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [items, setItems] = useState<DraftItem[]>([{ ...EMPTY_ITEM }]);

  const fetchBootstrapData = useCallback(async () => {
    setLoading(true);
    const [partSpecsResponse, estimatesResponse, templatesResponse, projectResponse] = await Promise.all([
      fetch("/api/v1/master/part-specs"),
      fetch(`/api/v1/projects/${projectId}/estimates`),
      fetch("/api/v1/templates"),
      fetch(`/api/v1/projects/${projectId}`),
    ]);
    const [partSpecsPayload, estimatesPayload, templatesPayload, projectPayload] = await Promise.all([
      partSpecsResponse.json(),
      estimatesResponse.json(),
      templatesResponse.json(),
      projectResponse.json(),
    ]);
    setPartSpecs(partSpecsPayload.data ?? []);
    setEstimates(estimatesPayload.data ?? []);
    setTemplates((templatesPayload.data ?? []).filter((template: TemplateRow) => template.type === "ESTIMATE"));
    setProjectMeta(projectPayload.data ?? null);
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    void fetchBootstrapData();
  }, [fetchBootstrapData]);

  const total = useMemo(() => items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0), [items]);
  const tax = useMemo(() => Math.floor(total * 0.1), [total]);
  const grandTotal = total + tax;

  function updateItem(index: number, patch: Partial<DraftItem>) {
    setItems((prev) => prev.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)));
  }

  function onSelectPart(index: number, selectedId: string) {
    const selectedPart = partSpecs.find((part) => part.id === selectedId);
    if (!selectedPart) {
      updateItem(index, { partSpecId: "", itemName: "", specification: "", unit: "EA", unitPrice: 0 });
      return;
    }
    updateItem(index, {
      partSpecId: selectedPart.id,
      itemName: selectedPart.name,
      specification: selectedPart.specification,
      unit: selectedPart.unit || "EA",
      unitPrice: Number(selectedPart.unitPrice ?? 0),
    });
  }

  function addItem() {
    setItems((prev) => [...prev, { ...EMPTY_ITEM }]);
  }

  function removeItem(index: number) {
    setItems((prev) => (prev.length === 1 ? prev : prev.filter((_, itemIndex) => itemIndex !== index)));
  }

  function renderTemplate(source: string) {
    if (!projectMeta) {
      return source;
    }
    const values: Record<string, string> = {
      projectName: projectMeta.name,
      customerName: projectMeta.customer.name,
      siteName: projectMeta.site.name,
      processTypeName: projectMeta.processType.name,
      itemTypeName: projectMeta.itemType.name,
    };
    return source.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, token: string) => values[token] ?? "");
  }

  function applyTemplate() {
    const selectedTemplate = templates.find((template) => template.id === templateId);
    if (!selectedTemplate) {
      return;
    }
    setTitle(renderTemplate(selectedTemplate.titleTemplate));
    setNotes(renderTemplate(selectedTemplate.bodyTemplate));
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!title.trim()) {
      alert("견적 제목을 입력해 주세요.");
      return;
    }
    if (items.some((item) => !item.itemName.trim() || item.quantity <= 0 || item.unitPrice < 0)) {
      alert("견적 항목의 이름/수량/단가를 확인해 주세요.");
      return;
    }
    setSaving(true);
    const response = await fetch(`/api/v1/projects/${projectId}/estimates`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title,
        notes,
        items: items.map((item) => ({
          partSpecId: item.partSpecId || undefined,
          itemName: item.itemName,
          specification: item.specification || undefined,
          unit: item.unit,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          remarks: item.remarks || undefined,
        })),
      }),
    });
    const payload = await response.json();
    setSaving(false);
    if (!payload.success) {
      alert(payload.error?.message ?? "견적 저장에 실패했습니다.");
      return;
    }
    setTitle("");
    setNotes("");
    setItems([{ ...EMPTY_ITEM }]);
    await fetchBootstrapData();
  }

  return (
    <section className="space-y-6">
      <h1 className="text-3xl font-bold">견적 관리</h1>

      <form onSubmit={onSubmit} className="space-y-4 rounded-xl border bg-white p-4">
        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-sm">
            <span className="mb-1 block font-semibold">템플릿</span>
            <div className="flex gap-2">
              <select
                className="h-11 w-full rounded border px-3"
                value={templateId}
                onChange={(event) => setTemplateId(event.target.value)}
              >
                <option value="">선택 안함</option>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                    {template.isActive ? " (활성)" : ""}
                  </option>
                ))}
              </select>
              <button type="button" onClick={applyTemplate} className="h-11 rounded border px-3 text-sm">
                적용
              </button>
            </div>
          </label>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-sm">
            <span className="mb-1 block font-semibold">견적 제목</span>
            <input className="h-11 w-full rounded border px-3" value={title} onChange={(event) => setTitle(event.target.value)} />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-semibold">비고</span>
            <input className="h-11 w-full rounded border px-3" value={notes} onChange={(event) => setNotes(event.target.value)} />
          </label>
        </div>

        <div className="space-y-3">
          {items.map((item, index) => (
            <div key={`estimate-item-${index}`} className="grid gap-2 rounded border p-3 md:grid-cols-7">
              <select
                aria-label={`견적 항목 ${index + 1} 부품 선택`}
                className="h-11 rounded border px-2 text-sm md:col-span-2"
                value={item.partSpecId}
                onChange={(event) => onSelectPart(index, event.target.value)}
              >
                <option value="">부품 선택(자유입력 가능)</option>
                {partSpecs.map((part) => (
                  <option key={part.id} value={part.id}>
                    {part.name}
                  </option>
                ))}
              </select>
              <input
                className="h-11 rounded border px-2 text-sm"
                placeholder="항목명"
                value={item.itemName}
                onChange={(event) => updateItem(index, { itemName: event.target.value })}
              />
              <input
                className="h-11 rounded border px-2 text-sm"
                placeholder="규격"
                value={item.specification}
                onChange={(event) => updateItem(index, { specification: event.target.value })}
              />
              <input
                className="h-11 rounded border px-2 text-sm"
                placeholder="수량"
                type="number"
                min={1}
                value={item.quantity}
                onChange={(event) => updateItem(index, { quantity: Number(event.target.value) })}
              />
              <input
                className="h-11 rounded border px-2 text-sm"
                placeholder="단가"
                type="number"
                min={0}
                value={item.unitPrice}
                onChange={(event) => updateItem(index, { unitPrice: Number(event.target.value) })}
              />
              <button
                type="button"
                className="h-11 rounded border px-2 text-sm hover:bg-slate-50"
                onClick={() => removeItem(index)}
              >
                항목 삭제
              </button>
            </div>
          ))}
          <button type="button" onClick={addItem} className="h-10 rounded border px-3 text-sm hover:bg-slate-50">
            항목 추가
          </button>
        </div>

        <div className="rounded border bg-slate-50 p-3 text-sm">
          <p>공급가액: {total.toLocaleString()}원</p>
          <p>부가세(10%): {tax.toLocaleString()}원</p>
          <p className="font-semibold">총액: {grandTotal.toLocaleString()}원</p>
        </div>

        <button type="submit" disabled={saving} className="h-11 rounded bg-blue-600 px-4 text-white disabled:opacity-60">
          {saving ? "저장 중..." : "견적 저장"}
        </button>
      </form>

      <div className="rounded-xl border bg-white p-4">
        <h2 className="mb-3 text-xl font-semibold">견적 이력</h2>
        {loading ? (
          <p className="text-sm text-slate-500">견적 목록을 불러오는 중입니다...</p>
        ) : estimates.length === 0 ? (
          <p className="text-sm text-slate-500">등록된 견적이 없습니다.</p>
        ) : (
          <ul className="space-y-2">
            {estimates.map((estimate) => (
              <li key={estimate.id} className="rounded border p-3">
                <p className="font-semibold">
                  {estimate.estimateNumber} · {estimate.title}
                </p>
                <p className="text-sm text-slate-600">
                  총액 {Number(estimate.grandTotal).toLocaleString()}원 · 작성자 {estimate.createdBy.name}
                </p>
                <a
                  href={`/api/v1/estimates/${estimate.id}/pdf`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-block text-sm text-blue-600 hover:underline"
                >
                  PDF 다운로드
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
