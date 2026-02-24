"use client";

import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";

type Site = {
  id: string;
  name: string;
  code: string;
  address: string | null;
  isActive: boolean;
};

type ProcessType = {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
};

type ItemType = {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
};

type Customer = {
  id: string;
  name: string;
  code: string;
  contact: string | null;
  phone: string | null;
  isActive: boolean;
};

type PartSpec = {
  id: string;
  category: string;
  name: string;
  specification: string;
  unit: string;
  unitPrice: number | string | null;
  manufacturer: string | null;
  isActive: boolean;
};

type TabKey = "sites" | "processTypes" | "itemTypes" | "customers" | "partSpecs";

type MasterPayload = {
  sites: Site[];
  processTypes: ProcessType[];
  itemTypes: ItemType[];
  customers: Customer[];
  partSpecs: PartSpec[];
};

export function MasterCrudPanel() {
  const [activeTab, setActiveTab] = useState<TabKey>("sites");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<MasterPayload>({
    sites: [],
    processTypes: [],
    itemTypes: [],
    customers: [],
    partSpecs: [],
  });

  const [newSite, setNewSite] = useState({ name: "", code: "", address: "" });
  const [newProcessType, setNewProcessType] = useState({ name: "", code: "" });
  const [newItemType, setNewItemType] = useState({ name: "", code: "" });
  const [newCustomer, setNewCustomer] = useState({ name: "", code: "", contact: "", phone: "" });
  const [newPartSpec, setNewPartSpec] = useState({
    category: "",
    name: "",
    specification: "",
    unit: "EA",
    unitPrice: "0",
    manufacturer: "",
  });

  async function fetchMasterData() {
    setLoading(true);
    const [sites, processTypes, itemTypes, customers, partSpecs] = await Promise.all([
      fetch("/api/v1/master/sites").then((response) => response.json()),
      fetch("/api/v1/master/process-types").then((response) => response.json()),
      fetch("/api/v1/master/item-types").then((response) => response.json()),
      fetch("/api/v1/master/customers").then((response) => response.json()),
      fetch("/api/v1/master/part-specs").then((response) => response.json()),
    ]);

    setData({
      sites: sites.data ?? [],
      processTypes: processTypes.data ?? [],
      itemTypes: itemTypes.data ?? [],
      customers: customers.data ?? [],
      partSpecs: partSpecs.data ?? [],
    });
    setLoading(false);
  }

  useEffect(() => {
    void fetchMasterData();
  }, []);

  const tabCounts = useMemo(
    () => ({
      sites: data.sites.length,
      processTypes: data.processTypes.length,
      itemTypes: data.itemTypes.length,
      customers: data.customers.length,
      partSpecs: data.partSpecs.length,
    }),
    [data],
  );

  async function createRecord(endpoint: string, body: Record<string, unknown>) {
    setSaving(true);
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = await response.json();
    setSaving(false);
    if (!payload.success) {
      alert(payload.error?.message ?? "생성에 실패했습니다.");
      return false;
    }
    await fetchMasterData();
    return true;
  }

  async function updateRecord(endpoint: string, body: Record<string, unknown>) {
    setSaving(true);
    const response = await fetch(endpoint, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = await response.json();
    setSaving(false);
    if (!payload.success) {
      alert(payload.error?.message ?? "수정에 실패했습니다.");
      return false;
    }
    await fetchMasterData();
    return true;
  }

  async function toggleActive(endpoint: string, row: { id: string; isActive: boolean }) {
    await updateRecord(endpoint, { id: row.id, isActive: !row.isActive });
  }

  async function onCreateSite(event: FormEvent) {
    event.preventDefault();
    const ok = await createRecord("/api/v1/master/sites", {
      name: newSite.name,
      code: newSite.code,
      address: newSite.address || null,
    });
    if (ok) {
      setNewSite({ name: "", code: "", address: "" });
    }
  }

  async function onCreateProcessType(event: FormEvent) {
    event.preventDefault();
    const ok = await createRecord("/api/v1/master/process-types", newProcessType);
    if (ok) {
      setNewProcessType({ name: "", code: "" });
    }
  }

  async function onCreateItemType(event: FormEvent) {
    event.preventDefault();
    const ok = await createRecord("/api/v1/master/item-types", newItemType);
    if (ok) {
      setNewItemType({ name: "", code: "" });
    }
  }

  async function onCreateCustomer(event: FormEvent) {
    event.preventDefault();
    const ok = await createRecord("/api/v1/master/customers", {
      name: newCustomer.name,
      code: newCustomer.code,
      contact: newCustomer.contact || null,
      phone: newCustomer.phone || null,
    });
    if (ok) {
      setNewCustomer({ name: "", code: "", contact: "", phone: "" });
    }
  }

  async function onCreatePartSpec(event: FormEvent) {
    event.preventDefault();
    const ok = await createRecord("/api/v1/master/part-specs", {
      category: newPartSpec.category,
      name: newPartSpec.name,
      specification: newPartSpec.specification,
      unit: newPartSpec.unit,
      unitPrice: Number(newPartSpec.unitPrice || 0),
      manufacturer: newPartSpec.manufacturer || null,
    });
    if (ok) {
      setNewPartSpec({
        category: "",
        name: "",
        specification: "",
        unit: "EA",
        unitPrice: "0",
        manufacturer: "",
      });
    }
  }

  async function promptAndUpdate(
    endpoint: string,
    row: Record<string, unknown> & { id: string },
    fieldPrompts: Array<{ key: string; label: string }>,
  ) {
    const patch: Record<string, unknown> = { id: row.id };
    for (const field of fieldPrompts) {
      const before = row[field.key];
      const input = window.prompt(`${field.label} 수정`, before == null ? "" : String(before));
      if (input === null) {
        return;
      }
      patch[field.key] = input;
    }
    await updateRecord(endpoint, patch);
  }

  return (
    <section className="space-y-5">
      <h1 className="text-3xl font-bold">마스터 데이터 관리</h1>

      <div className="flex flex-wrap gap-2">
        <TabButton label={`사업장 (${tabCounts.sites})`} active={activeTab === "sites"} onClick={() => setActiveTab("sites")} />
        <TabButton
          label={`공정 (${tabCounts.processTypes})`}
          active={activeTab === "processTypes"}
          onClick={() => setActiveTab("processTypes")}
        />
        <TabButton label={`품목 (${tabCounts.itemTypes})`} active={activeTab === "itemTypes"} onClick={() => setActiveTab("itemTypes")} />
        <TabButton label={`고객사 (${tabCounts.customers})`} active={activeTab === "customers"} onClick={() => setActiveTab("customers")} />
        <TabButton label={`부품 (${tabCounts.partSpecs})`} active={activeTab === "partSpecs"} onClick={() => setActiveTab("partSpecs")} />
      </div>

      {loading ? <p className="text-sm text-slate-500">마스터 데이터를 불러오는 중입니다...</p> : null}

      {activeTab === "sites" ? (
        <div className="space-y-4 rounded-xl border bg-white p-4">
          <h2 className="text-xl font-semibold">사업장 CRUD</h2>
          <form onSubmit={onCreateSite} className="grid gap-2 md:grid-cols-4">
            <input
              className="h-11 rounded border px-3"
              placeholder="사업장명"
              value={newSite.name}
              onChange={(event) => setNewSite((prev) => ({ ...prev, name: event.target.value }))}
              required
            />
            <input
              className="h-11 rounded border px-3"
              placeholder="코드"
              value={newSite.code}
              onChange={(event) => setNewSite((prev) => ({ ...prev, code: event.target.value }))}
              required
            />
            <input
              className="h-11 rounded border px-3"
              placeholder="주소"
              value={newSite.address}
              onChange={(event) => setNewSite((prev) => ({ ...prev, address: event.target.value }))}
            />
            <button className="h-11 rounded bg-blue-600 px-3 text-white disabled:opacity-60" disabled={saving} type="submit">
              생성
            </button>
          </form>
          <SimpleTable
            headers={["이름", "코드", "주소", "상태", "액션"]}
            rows={data.sites.map((row) => (
              <tr key={row.id} className="border-b">
                <td className="p-2">{row.name}</td>
                <td className="p-2">{row.code}</td>
                <td className="p-2">{row.address ?? "-"}</td>
                <td className="p-2">{row.isActive ? "사용중" : "비활성"}</td>
                <td className="p-2">
                  <div className="flex gap-2">
                    <button
                      className="rounded border px-2 py-1 text-xs"
                      onClick={() =>
                        promptAndUpdate("/api/v1/master/sites", row, [
                          { key: "name", label: "사업장명" },
                          { key: "code", label: "코드" },
                          { key: "address", label: "주소" },
                        ])
                      }
                      type="button"
                    >
                      수정
                    </button>
                    <button className="rounded border px-2 py-1 text-xs" onClick={() => toggleActive("/api/v1/master/sites", row)} type="button">
                      {row.isActive ? "비활성화" : "활성화"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          />
        </div>
      ) : null}

      {activeTab === "processTypes" ? (
        <div className="space-y-4 rounded-xl border bg-white p-4">
          <h2 className="text-xl font-semibold">공정 CRUD</h2>
          <form onSubmit={onCreateProcessType} className="grid gap-2 md:grid-cols-3">
            <input
              className="h-11 rounded border px-3"
              placeholder="공정명"
              value={newProcessType.name}
              onChange={(event) => setNewProcessType((prev) => ({ ...prev, name: event.target.value }))}
              required
            />
            <input
              className="h-11 rounded border px-3"
              placeholder="코드"
              value={newProcessType.code}
              onChange={(event) => setNewProcessType((prev) => ({ ...prev, code: event.target.value }))}
              required
            />
            <button className="h-11 rounded bg-blue-600 px-3 text-white disabled:opacity-60" disabled={saving} type="submit">
              생성
            </button>
          </form>
          <SimpleTable
            headers={["이름", "코드", "상태", "액션"]}
            rows={data.processTypes.map((row) => (
              <tr key={row.id} className="border-b">
                <td className="p-2">{row.name}</td>
                <td className="p-2">{row.code}</td>
                <td className="p-2">{row.isActive ? "사용중" : "비활성"}</td>
                <td className="p-2">
                  <div className="flex gap-2">
                    <button
                      className="rounded border px-2 py-1 text-xs"
                      onClick={() =>
                        promptAndUpdate("/api/v1/master/process-types", row, [
                          { key: "name", label: "공정명" },
                          { key: "code", label: "코드" },
                        ])
                      }
                      type="button"
                    >
                      수정
                    </button>
                    <button
                      className="rounded border px-2 py-1 text-xs"
                      onClick={() => toggleActive("/api/v1/master/process-types", row)}
                      type="button"
                    >
                      {row.isActive ? "비활성화" : "활성화"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          />
        </div>
      ) : null}

      {activeTab === "itemTypes" ? (
        <div className="space-y-4 rounded-xl border bg-white p-4">
          <h2 className="text-xl font-semibold">품목 CRUD</h2>
          <form onSubmit={onCreateItemType} className="grid gap-2 md:grid-cols-3">
            <input
              className="h-11 rounded border px-3"
              placeholder="품목명"
              value={newItemType.name}
              onChange={(event) => setNewItemType((prev) => ({ ...prev, name: event.target.value }))}
              required
            />
            <input
              className="h-11 rounded border px-3"
              placeholder="코드"
              value={newItemType.code}
              onChange={(event) => setNewItemType((prev) => ({ ...prev, code: event.target.value }))}
              required
            />
            <button className="h-11 rounded bg-blue-600 px-3 text-white disabled:opacity-60" disabled={saving} type="submit">
              생성
            </button>
          </form>
          <SimpleTable
            headers={["이름", "코드", "상태", "액션"]}
            rows={data.itemTypes.map((row) => (
              <tr key={row.id} className="border-b">
                <td className="p-2">{row.name}</td>
                <td className="p-2">{row.code}</td>
                <td className="p-2">{row.isActive ? "사용중" : "비활성"}</td>
                <td className="p-2">
                  <div className="flex gap-2">
                    <button
                      className="rounded border px-2 py-1 text-xs"
                      onClick={() =>
                        promptAndUpdate("/api/v1/master/item-types", row, [
                          { key: "name", label: "품목명" },
                          { key: "code", label: "코드" },
                        ])
                      }
                      type="button"
                    >
                      수정
                    </button>
                    <button className="rounded border px-2 py-1 text-xs" onClick={() => toggleActive("/api/v1/master/item-types", row)} type="button">
                      {row.isActive ? "비활성화" : "활성화"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          />
        </div>
      ) : null}

      {activeTab === "customers" ? (
        <div className="space-y-4 rounded-xl border bg-white p-4">
          <h2 className="text-xl font-semibold">고객사 CRUD</h2>
          <form onSubmit={onCreateCustomer} className="grid gap-2 md:grid-cols-5">
            <input
              className="h-11 rounded border px-3"
              placeholder="고객사명"
              value={newCustomer.name}
              onChange={(event) => setNewCustomer((prev) => ({ ...prev, name: event.target.value }))}
              required
            />
            <input
              className="h-11 rounded border px-3"
              placeholder="코드"
              value={newCustomer.code}
              onChange={(event) => setNewCustomer((prev) => ({ ...prev, code: event.target.value }))}
              required
            />
            <input
              className="h-11 rounded border px-3"
              placeholder="담당자"
              value={newCustomer.contact}
              onChange={(event) => setNewCustomer((prev) => ({ ...prev, contact: event.target.value }))}
            />
            <input
              className="h-11 rounded border px-3"
              placeholder="연락처"
              value={newCustomer.phone}
              onChange={(event) => setNewCustomer((prev) => ({ ...prev, phone: event.target.value }))}
            />
            <button className="h-11 rounded bg-blue-600 px-3 text-white disabled:opacity-60" disabled={saving} type="submit">
              생성
            </button>
          </form>
          <SimpleTable
            headers={["고객사", "코드", "담당자", "연락처", "상태", "액션"]}
            rows={data.customers.map((row) => (
              <tr key={row.id} className="border-b">
                <td className="p-2">{row.name}</td>
                <td className="p-2">{row.code}</td>
                <td className="p-2">{row.contact ?? "-"}</td>
                <td className="p-2">{row.phone ?? "-"}</td>
                <td className="p-2">{row.isActive ? "사용중" : "비활성"}</td>
                <td className="p-2">
                  <div className="flex gap-2">
                    <button
                      className="rounded border px-2 py-1 text-xs"
                      onClick={() =>
                        promptAndUpdate("/api/v1/master/customers", row, [
                          { key: "name", label: "고객사명" },
                          { key: "code", label: "코드" },
                          { key: "contact", label: "담당자" },
                          { key: "phone", label: "연락처" },
                        ])
                      }
                      type="button"
                    >
                      수정
                    </button>
                    <button className="rounded border px-2 py-1 text-xs" onClick={() => toggleActive("/api/v1/master/customers", row)} type="button">
                      {row.isActive ? "비활성화" : "활성화"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          />
        </div>
      ) : null}

      {activeTab === "partSpecs" ? (
        <div className="space-y-4 rounded-xl border bg-white p-4">
          <h2 className="text-xl font-semibold">부품 스펙 CRUD</h2>
          <form onSubmit={onCreatePartSpec} className="grid gap-2 md:grid-cols-7">
            <input
              className="h-11 rounded border px-3"
              placeholder="분류"
              value={newPartSpec.category}
              onChange={(event) => setNewPartSpec((prev) => ({ ...prev, category: event.target.value }))}
              required
            />
            <input
              className="h-11 rounded border px-3"
              placeholder="부품명"
              value={newPartSpec.name}
              onChange={(event) => setNewPartSpec((prev) => ({ ...prev, name: event.target.value }))}
              required
            />
            <input
              className="h-11 rounded border px-3"
              placeholder="사양"
              value={newPartSpec.specification}
              onChange={(event) => setNewPartSpec((prev) => ({ ...prev, specification: event.target.value }))}
              required
            />
            <input
              className="h-11 rounded border px-3"
              placeholder="단위"
              value={newPartSpec.unit}
              onChange={(event) => setNewPartSpec((prev) => ({ ...prev, unit: event.target.value }))}
              required
            />
            <input
              className="h-11 rounded border px-3"
              placeholder="단가"
              type="number"
              min={0}
              value={newPartSpec.unitPrice}
              onChange={(event) => setNewPartSpec((prev) => ({ ...prev, unitPrice: event.target.value }))}
            />
            <input
              className="h-11 rounded border px-3"
              placeholder="제조사"
              value={newPartSpec.manufacturer}
              onChange={(event) => setNewPartSpec((prev) => ({ ...prev, manufacturer: event.target.value }))}
            />
            <button className="h-11 rounded bg-blue-600 px-3 text-white disabled:opacity-60" disabled={saving} type="submit">
              생성
            </button>
          </form>
          <SimpleTable
            headers={["분류", "이름", "사양", "단위", "단가", "제조사", "상태", "액션"]}
            rows={data.partSpecs.map((row) => (
              <tr key={row.id} className="border-b">
                <td className="p-2">{row.category}</td>
                <td className="p-2">{row.name}</td>
                <td className="p-2">{row.specification}</td>
                <td className="p-2">{row.unit}</td>
                <td className="p-2">{Number(row.unitPrice ?? 0).toLocaleString()}</td>
                <td className="p-2">{row.manufacturer ?? "-"}</td>
                <td className="p-2">{row.isActive ? "사용중" : "비활성"}</td>
                <td className="p-2">
                  <div className="flex gap-2">
                    <button
                      className="rounded border px-2 py-1 text-xs"
                      onClick={() =>
                        promptAndUpdate(`/api/v1/master/part-specs/${row.id}`, row, [
                          { key: "category", label: "분류" },
                          { key: "name", label: "이름" },
                          { key: "specification", label: "사양" },
                          { key: "unit", label: "단위" },
                          { key: "unitPrice", label: "단가" },
                          { key: "manufacturer", label: "제조사" },
                        ])
                      }
                      type="button"
                    >
                      수정
                    </button>
                    <button
                      className="rounded border px-2 py-1 text-xs"
                      onClick={() => updateRecord(`/api/v1/master/part-specs/${row.id}`, { isActive: !row.isActive })}
                      type="button"
                    >
                      {row.isActive ? "비활성화" : "활성화"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          />
        </div>
      ) : null}
    </section>
  );
}

function TabButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      className={`h-11 rounded border px-4 text-sm font-medium ${active ? "border-blue-600 bg-blue-50 text-blue-700" : "hover:bg-slate-50"}`}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}

function SimpleTable({ headers, rows }: { headers: string[]; rows: ReactNode[] }) {
  return (
    <div className="overflow-x-auto rounded border">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50">
          <tr>
            {headers.map((header) => (
              <th key={header} className="p-2">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{rows}</tbody>
      </table>
    </div>
  );
}
