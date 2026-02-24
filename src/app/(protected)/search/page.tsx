"use client";

import Link from "next/link";
import { useCallback, useRef, useState } from "react";

type SearchResult = {
  projects: Array<{
    id: string;
    projectNumber: string;
    name: string;
    customer: { name: string };
    site: { name: string };
    processType: { name: string };
    itemType: { name: string };
  }>;
  documents: Array<{
    id: string;
    fileName: string;
    documentType: string;
    stage: {
      stageNumber: number;
      project: { id: string; name: string };
    };
  }>;
  estimates: Array<{
    id: string;
    estimateNumber: string;
    title: string;
    project: { id: string; name: string };
  }>;
};

const EMPTY_RESULT: SearchResult = { projects: [], documents: [], estimates: [] };

export default function SearchPage() {
  const [q, setQ] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [result, setResult] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [copyingProjectId, setCopyingProjectId] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<Array<{ id: string; label: string }>>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadSuggestions = useCallback((keyword: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!keyword.trim()) { setSuggestions([]); return; }
    debounceRef.current = setTimeout(async () => {
      const res = await fetch(`/api/v1/search/suggestions?q=${encodeURIComponent(keyword)}`);
      const payload = await res.json();
      setSuggestions(payload.data ?? []);
      setShowSuggestions(true);
    }, 250);
  }, []);

  async function onSearch() {
    if (!q.trim() && !dateFrom && !dateTo) {
      setResult(null);
      setHasSearched(false);
      return;
    }
    setLoading(true);
    setShowSuggestions(false);
    setHasSearched(true);
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    const res = await fetch(`/api/v1/search?${params.toString()}`);
    const payload = await res.json();
    setResult(payload.data ?? EMPTY_RESULT);
    setLoading(false);
  }

  async function onCopyProject(projectId: string) {
    setCopyingProjectId(projectId);
    const res = await fetch(`/api/v1/projects/${projectId}/copy`, { method: "POST" });
    const payload = await res.json();
    setCopyingProjectId(null);
    if (!payload.success) {
      alert(payload.error?.message ?? "프로젝트 복사 생성에 실패했습니다.");
      return;
    }
    window.location.href = `/projects/${payload.data.id}`;
  }

  function onReset() {
    setQ(""); setDateFrom(""); setDateTo("");
    setResult(null); setSuggestions([]); setHasSearched(false);
  }

  const totalCount = result
    ? result.projects.length + result.documents.length + result.estimates.length
    : 0;

  return (
    <section className="space-y-5">
      <h1 className="text-3xl font-bold">통합 검색</h1>

      {/* 검색 입력 영역 */}
      <div className="rounded-xl border bg-white p-5 space-y-3">
        {/* 검색어 입력 + 자동완성 */}
        <div className="relative">
          <label className="mb-1 block text-sm font-semibold">검색어</label>
          <div className="flex gap-2">
            <input
              className="h-11 flex-1 rounded border px-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                loadSuggestions(e.target.value);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); void onSearch(); }
                if (e.key === "Escape") setShowSuggestions(false);
              }}
              onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              placeholder="프로젝트명, 문서명, 견적번호 입력 후 Enter"
            />
            <button
              onClick={() => void onSearch()}
              disabled={loading}
              className="h-11 rounded bg-blue-600 px-5 font-semibold text-white disabled:opacity-60"
            >
              {loading ? "검색 중..." : "검색"}
            </button>
            {(q || dateFrom || dateTo) && (
              <button
                onClick={onReset}
                className="h-11 rounded border px-4 text-sm text-slate-500 hover:bg-slate-50"
              >
                초기화
              </button>
            )}
          </div>

          {/* 자동완성 드롭다운 */}
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 z-10 mt-1 rounded-lg border bg-white shadow-lg">
              {suggestions.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onMouseDown={() => {
                    setQ(item.label);
                    setSuggestions([]);
                    setShowSuggestions(false);
                  }}
                  className="w-full px-4 py-2.5 text-left text-sm hover:bg-slate-50 first:rounded-t-lg last:rounded-b-lg"
                >
                  🔍 {item.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 날짜 범위 필터 */}
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm">
            <span className="mb-1 block font-semibold">등록일 시작</span>
            <input
              type="date"
              className="h-11 rounded border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              max={dateTo || undefined}
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-semibold">등록일 종료</span>
            <input
              type="date"
              className="h-11 rounded border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              min={dateFrom || undefined}
            />
          </label>
          <p className="text-xs text-slate-400 pb-1">
            날짜만 입력해도 검색 가능합니다.
          </p>
        </div>
      </div>

      {/* 검색 결과 요약 */}
      {hasSearched && !loading && result && (
        <div className={`rounded-xl border px-4 py-3 text-sm ${totalCount === 0 ? "border-amber-200 bg-amber-50 text-amber-800" : "border-blue-100 bg-blue-50 text-blue-800"}`}>
          {totalCount === 0 ? (
            <span>검색 결과가 없습니다. 다른 검색어나 날짜 범위를 시도해 보세요.</span>
          ) : (
            <span>
              총 <strong>{totalCount}건</strong> 발견 — 프로젝트 {result.projects.length}건 · 문서 {result.documents.length}건 · 견적 {result.estimates.length}건
            </span>
          )}
        </div>
      )}

      {/* 결과 없음 빈 상태 */}
      {hasSearched && !loading && result && totalCount === 0 && (
        <div className="rounded-xl border border-dashed py-16 text-center">
          <p className="text-5xl mb-4">🔍</p>
          <p className="text-lg font-semibold text-slate-600">검색 결과가 없습니다</p>
          <p className="mt-2 text-sm text-slate-400">
            검색어를 변경하거나 날짜 범위를 넓혀 보세요.
          </p>
          <button onClick={onReset} className="mt-4 rounded border px-4 py-2 text-sm hover:bg-slate-50">
            검색 초기화
          </button>
        </div>
      )}

      {/* 결과 목록 */}
      {result && totalCount > 0 && (
        <div className="space-y-4">
          {/* 프로젝트 결과 */}
          {result.projects.length > 0 && (
            <ResultSection title="프로젝트" count={result.projects.length}>
              {result.projects.map((project) => (
                <li key={project.id} className="rounded-lg border p-4 hover:border-blue-200 hover:bg-blue-50 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <Link
                        href={`/projects/${project.id}`}
                        className="font-semibold hover:text-blue-600 hover:underline"
                      >
                        {project.projectNumber} · {project.name}
                      </Link>
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        <Tag>{project.customer.name}</Tag>
                        <Tag>{project.site.name}</Tag>
                        <Tag color="blue">{project.processType.name}</Tag>
                        <Tag color="indigo">{project.itemType.name}</Tag>
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={copyingProjectId === project.id}
                      onClick={() => void onCopyProject(project.id)}
                      className="flex-shrink-0 h-9 rounded border px-3 text-sm font-medium hover:bg-white disabled:opacity-60"
                    >
                      {copyingProjectId === project.id ? "복사 중..." : "복사 생성"}
                    </button>
                  </div>
                </li>
              ))}
            </ResultSection>
          )}

          {/* 문서 결과 */}
          {result.documents.length > 0 && (
            <ResultSection title="문서" count={result.documents.length}>
              {result.documents.map((doc) => (
                <li key={doc.id} className="rounded-lg border p-4 hover:bg-slate-50 transition-colors">
                  <Link
                    href={`/projects/${doc.stage.project.id}/documents`}
                    className="font-semibold hover:text-blue-600 hover:underline"
                  >
                    📎 {doc.fileName}
                  </Link>
                  <p className="mt-1 text-sm text-slate-500">
                    {doc.stage.project.name} · {doc.stage.stageNumber}단계 · {doc.documentType}
                  </p>
                </li>
              ))}
            </ResultSection>
          )}

          {/* 견적 결과 */}
          {result.estimates.length > 0 && (
            <ResultSection title="견적서" count={result.estimates.length}>
              {result.estimates.map((est) => (
                <li key={est.id} className="rounded-lg border p-4 hover:bg-slate-50 transition-colors">
                  <Link
                    href={`/projects/${est.project.id}/estimate`}
                    className="font-semibold hover:text-blue-600 hover:underline"
                  >
                    📋 {est.estimateNumber} · {est.title}
                  </Link>
                  <p className="mt-1 text-sm text-slate-500">{est.project.name}</p>
                </li>
              ))}
            </ResultSection>
          )}
        </div>
      )}
    </section>
  );
}

function ResultSection({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border bg-white p-5">
      <h2 className="mb-3 flex items-center gap-2 text-xl font-semibold">
        {title}
        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-sm font-normal text-slate-500">
          {count}건
        </span>
      </h2>
      <ul className="space-y-2">{children}</ul>
    </div>
  );
}

function Tag({ children, color }: { children: React.ReactNode; color?: "blue" | "indigo" }) {
  const cls =
    color === "blue"
      ? "bg-blue-100 text-blue-700"
      : color === "indigo"
      ? "bg-indigo-100 text-indigo-700"
      : "bg-slate-100 text-slate-600";
  return <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${cls}`}>{children}</span>;
}
