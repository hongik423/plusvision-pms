"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Search, Loader2, FolderKanban, X, ChevronDown } from "lucide-react";
import { PROJECT_STATUS_LABELS, PROJECT_STATUS_COLORS } from "@/lib/constants";

type Suggestion = {
  id: string;
  projectNumber: string;
  name: string;
  status: string;
  customerName: string;
  currentStage: number;
};

type Props = {
  defaultValue?: string;
  inputName?: string;
};

export default function ProjectSearchInput({ defaultValue = "", inputName = "q" }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState(defaultValue);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [mounted, setMounted] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 });

  // 클라이언트 마운트 확인 (Portal용)
  useEffect(() => { setMounted(true); }, []);

  // ── 드롭다운 위치 계산 ────────────────────────────────
  const updateDropdownPos = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setDropdownPos({
      top: rect.bottom + window.scrollY + 4,
      left: rect.left + window.scrollX,
      width: rect.width,
    });
  }, []);

  // ── 외부 클릭 시 드롭다운 닫기 ────────────────────────
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (containerRef.current && !containerRef.current.contains(target)) {
        // Portal 드롭다운 안의 클릭인지도 확인
        const dropdown = document.getElementById("project-search-dropdown");
        if (dropdown && dropdown.contains(target)) return;
        setIsOpen(false);
        setActiveIndex(-1);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── API 호출 함수 ─────────────────────────────────────
  const fetchSuggestions = useCallback(async (searchQuery: string) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        limit: "500",
        sort: "name",
        order: "asc",
      });
      if (searchQuery.trim()) {
        params.set("q", searchQuery.trim());
      }

      const res = await fetch(`/api/v1/projects?${params.toString()}`);
      if (!res.ok) {
        console.error("프로젝트 검색 API 오류:", res.status);
        setSuggestions([]);
        setIsOpen(false);
        return;
      }

      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        const mapped: Suggestion[] = json.data.map(
          (p: {
            id: string;
            projectNumber: string;
            name: string;
            status: string;
            currentStage: number;
            customer?: { name: string };
          }) => ({
            id: p.id,
            projectNumber: p.projectNumber,
            name: p.name,
            status: p.status,
            customerName: p.customer?.name ?? "",
            currentStage: p.currentStage ?? 1,
          }),
        );
        setSuggestions(mapped);
        setIsOpen(mapped.length > 0);
        updateDropdownPos();
      } else {
        console.error("프로젝트 검색 응답 형식 오류:", json);
        setSuggestions([]);
        setIsOpen(false);
      }
    } catch (err) {
      console.error("프로젝트 검색 fetch 실패:", err);
      setSuggestions([]);
      setIsOpen(false);
    } finally {
      setIsLoading(false);
    }
  }, [updateDropdownPos]);

  // ── 검색어 변경 → debounce 후 API 호출 ────────────────
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(() => {
      fetchSuggestions(query);
    }, 250);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, fetchSuggestions]);

  // ── 포커스 시 (빈 입력이어도) 목록 표시 ───────────────
  const handleFocus = () => {
    if (suggestions.length > 0) {
      updateDropdownPos();
      setIsOpen(true);
    } else {
      // 빈 상태에서 포커스 → 전체 목록 로드
      fetchSuggestions(query);
    }
  };

  // ── 키보드 탐색 ──────────────────────────────────────
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) => Math.min(prev + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) => Math.max(prev - 1, -1));
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      const selected = suggestions[activeIndex];
      if (selected) navigateTo(selected.id);
    } else if (e.key === "Escape") {
      setIsOpen(false);
      setActiveIndex(-1);
    }
  };

  // ── 프로젝트 상세 페이지로 이동 ──────────────────────
  const navigateTo = (id: string) => {
    setIsOpen(false);
    setActiveIndex(-1);
    router.push(`/projects/${id}`);
  };

  // ── 입력 초기화 ──────────────────────────────────────
  const clearInput = () => {
    setQuery("");
    setSuggestions([]);
    setIsOpen(false);
    setActiveIndex(-1);
    inputRef.current?.focus();
  };

  // ── 드롭다운 토글 (화살표 클릭) ──────────────────────
  const toggleDropdown = () => {
    if (isOpen) {
      setIsOpen(false);
    } else {
      updateDropdownPos();
      fetchSuggestions(query);
    }
  };

  // ── 드롭다운 렌더링 (Portal 사용 → overflow 문제 해결) ──
  const dropdown =
    isOpen && suggestions.length > 0 && mounted
      ? createPortal(
          <div
            id="project-search-dropdown"
            style={{
              position: "absolute",
              top: dropdownPos.top,
              left: dropdownPos.left,
              width: dropdownPos.width,
              zIndex: 9999,
            }}
            className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl"
          >
            {/* 헤더 */}
            <div className="flex items-center gap-2 border-b bg-slate-50 px-3 py-2">
              <Search className="h-3.5 w-3.5 text-slate-400" />
              <span className="text-xs font-semibold text-slate-500">
                {query.trim()
                  ? `"${query.trim()}" 검색 결과 ${suggestions.length}건`
                  : `전체 프로젝트 ${suggestions.length}건`}
                {" · 선택 시 상세 페이지로 이동"}
              </span>
            </div>

            {/* 목록 */}
            <ul className="max-h-72 overflow-y-auto" role="listbox">
              {suggestions.map((s, i) => (
                <li
                  key={s.id}
                  role="option"
                  aria-selected={i === activeIndex}
                  onMouseEnter={() => setActiveIndex(i)}
                  onMouseLeave={() => setActiveIndex(-1)}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    navigateTo(s.id);
                  }}
                  className={`flex cursor-pointer items-center gap-3 px-3 py-2.5 transition-colors ${
                    i === activeIndex ? "bg-blue-50" : "hover:bg-slate-50"
                  } ${i < suggestions.length - 1 ? "border-b border-slate-100" : ""}`}
                >
                  <div className="flex-shrink-0 rounded-lg bg-slate-100 p-1.5">
                    <FolderKanban className="h-4 w-4 text-slate-500" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-medium text-slate-800 text-sm">
                        {highlight(s.name, query)}
                      </p>
                      <span
                        className={`flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
                          PROJECT_STATUS_COLORS[s.status as keyof typeof PROJECT_STATUS_COLORS] ??
                          "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {PROJECT_STATUS_LABELS[s.status as keyof typeof PROJECT_STATUS_LABELS] ?? s.status}
                      </span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-400">
                      <span className="font-mono">{s.projectNumber}</span>
                      <span>·</span>
                      <span>{s.customerName}</span>
                      <span>·</span>
                      <span>{s.currentStage}단계</span>
                    </div>
                  </div>
                  <span className="flex-shrink-0 text-xs text-slate-300">→</span>
                </li>
              ))}
            </ul>

            {/* 하단 안내 */}
            <div className="flex items-center justify-between border-t bg-slate-50 px-3 py-1.5 text-xs text-slate-400">
              <span>↑↓ 이동 · Enter 선택 · Esc 닫기</span>
              <span className="text-blue-400">클릭 시 상세 이동</span>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          name={inputName}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActiveIndex(-1);
          }}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          placeholder="프로젝트명/번호 (클릭하여 목록 보기)"
          autoComplete="off"
          className="h-11 w-full rounded border px-3 pr-20 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-300"
        />

        {/* 오른쪽 아이콘 영역 */}
        <div className="absolute inset-y-0 right-1 flex items-center gap-0.5">
          {isLoading && (
            <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
          )}
          {query && !isLoading && (
            <button
              type="button"
              onClick={clearInput}
              className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              tabIndex={-1}
              title="초기화"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={toggleDropdown}
            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            tabIndex={-1}
            title="프로젝트 목록 열기"
          >
            <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
          </button>
        </div>
      </div>

      {dropdown}
    </div>
  );
}

/* ── 검색어 하이라이트 ─────────────────────────────────── */
function highlight(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;
  const escaped = query.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${escaped})`, "gi"));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.trim().toLowerCase() ? (
          <mark key={i} className="bg-yellow-100 text-yellow-800 rounded px-0.5">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}
