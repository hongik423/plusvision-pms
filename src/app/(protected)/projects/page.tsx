import Link from "next/link";
import type { Route } from "next";
import { ProjectStatus } from "@prisma/client";
import { Cog, FolderKanban, MapPin, Package, Plus, Search, X } from "lucide-react";
import { listProjects } from "@/services/project-service";
import { prisma } from "@/lib/prisma";
import { PROJECT_STATUS_LABELS, PROJECT_STATUS_COLORS } from "@/lib/constants";
import { requireSession } from "@/lib/rbac";
import ProjectSearchInput from "@/components/projects/project-search-input";

// 서버사이드 캐싱 비활성화 — DB 변경 즉시 반영
export const dynamic = "force-dynamic";
export const revalidate = 0;

const SORT_OPTIONS = [
  { value: "createdAt", label: "등록일" },
  { value: "name", label: "프로젝트명" },
  { value: "dueDate", label: "완료예정일" },
  { value: "status", label: "상태" },
] as const;

const LIMIT_OPTIONS = [
  { value: "20", label: "20건" },
  { value: "50", label: "50건" },
  { value: "100", label: "100건" },
  { value: "500", label: "전체 (500건)" },
] as const;

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const session = await requireSession();
  const role = (session?.user?.role ?? "VIEWER") as "ADMIN" | "MANAGER" | "USER" | "VIEWER";
  const userId = session?.user?.id ?? "";
  const page = Number(readParam(searchParams, "page") ?? "1");
  const limit = Number(readParam(searchParams, "limit") ?? "20");
  const q = readParam(searchParams, "q") ?? undefined;
  const status = readParam(searchParams, "status") as ProjectStatus | undefined;
  const customerId = readParam(searchParams, "customerId") ?? undefined;
  const siteId = readParam(searchParams, "siteId") ?? undefined;
  const processTypeId = readParam(searchParams, "processTypeId") ?? undefined;
  const itemTypeId = readParam(searchParams, "itemTypeId") ?? undefined;
  const sort = (readParam(searchParams, "sort") ?? "createdAt") as "createdAt" | "name" | "dueDate" | "status";
  const order = (readParam(searchParams, "order") ?? "desc") as "asc" | "desc";
  const assigneeId = readParam(searchParams, "assigneeId") ?? undefined;
  const dateFrom = readParam(searchParams, "dateFrom") ?? undefined;
  const dateTo = readParam(searchParams, "dateTo") ?? undefined;

  let rows: Awaited<ReturnType<typeof listProjects>>["rows"] = [];
  let total = 0;
  let customers: { id: string; name: string }[] = [];
  let sites: { id: string; name: string }[] = [];
  let processTypes: { id: string; name: string }[] = [];
  let itemTypes: { id: string; name: string }[] = [];
  let users: { id: string; name: string }[] = [];
  let dataError = "";

  try {
    const [listResult, c, s, pt, it, u] = await Promise.all([
      listProjects({
        page: Number.isFinite(page) && page > 0 ? page : 1,
        limit: Number.isFinite(limit) && limit > 0 ? limit : 20,
        q,
        status,
        customerId,
        siteId,
        processTypeId,
        itemTypeId,
        assigneeId,
        startDate: dateFrom,
        endDate: dateTo,
        sort,
        order,
        role,
        userId,
      }),
      prisma.customer.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
      prisma.site.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
      prisma.processType.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
      prisma.itemType.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
      prisma.user.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    ]);
    rows = listResult.rows;
    total = listResult.total;
    customers = c;
    sites = s;
    processTypes = pt;
    itemTypes = it;
    users = u;
  } catch {
    dataError = "데이터베이스 연결이 일시적으로 불안정합니다. DATABASE_URL을 확인하고 잠시 후 다시 시도해 주세요.";
  }

  const totalPages = Math.max(1, Math.ceil(total / limit));
  const queryObject = {
    q,
    status,
    customerId,
    siteId,
    processTypeId,
    itemTypeId,
    assigneeId,
    dateFrom,
    dateTo,
    sort,
    order,
    limit: String(limit),
  };

  const hasActiveFilters = Boolean(
    q ||
      status ||
      customerId ||
      siteId ||
      processTypeId ||
      itemTypeId ||
      assigneeId ||
      dateFrom ||
      dateTo
  );

  const filterChips = buildFilterChips({
    q,
    status,
    customerId,
    siteId,
    processTypeId,
    itemTypeId,
    assigneeId,
    dateFrom,
    dateTo,
    customers,
    sites,
    processTypes,
    itemTypes,
    users,
  });
  const previousHref = page > 1 ? buildQuery({ ...queryObject, page: String(page - 1) }) : null;
  const nextHref = page < totalPages ? buildQuery({ ...queryObject, page: String(page + 1) }) : null;

  return (
    <section className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-3xl font-bold">
          <FolderKanban className="h-8 w-8 text-blue-600" />
          프로젝트
        </h1>
        <Link href="/projects/new" className="flex items-center gap-2 rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 transition-colors">
          <Plus className="h-5 w-5" />
          프로젝트 생성
        </Link>
      </div>

      <form className="grid gap-3 rounded-xl border bg-white p-4 md:grid-cols-4" method="GET">
        <div className="text-sm md:col-span-2">
          <span className="mb-1 flex items-center gap-1.5 font-semibold">
            <Search className="h-4 w-4 text-slate-500" />
            검색어
          </span>
          <ProjectSearchInput defaultValue={q ?? ""} inputName="q" />
        </div>
        <label className="text-sm">
          <span className="mb-1 block font-semibold">상태</span>
          <select className="h-11 w-full rounded border px-3" name="status" defaultValue={status ?? ""}>
            <option value="">전체</option>
            {Object.entries(PROJECT_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-semibold">고객사</span>
          <select className="h-11 w-full rounded border px-3" name="customerId" defaultValue={customerId ?? ""}>
            <option value="">전체</option>
            {customers.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-semibold">사업장</span>
          <select className="h-11 w-full rounded border px-3" name="siteId" defaultValue={siteId ?? ""}>
            <option value="">전체</option>
            {sites.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-semibold">공정</span>
          <select className="h-11 w-full rounded border px-3" name="processTypeId" defaultValue={processTypeId ?? ""}>
            <option value="">전체</option>
            {processTypes.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-semibold">품목</span>
          <select className="h-11 w-full rounded border px-3" name="itemTypeId" defaultValue={itemTypeId ?? ""}>
            <option value="">전체</option>
            {itemTypes.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-semibold">담당자</span>
          <select className="h-11 w-full rounded border px-3" name="assigneeId" defaultValue={assigneeId ?? ""}>
            <option value="">전체</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-semibold">등록일 시작</span>
          <input type="date" className="h-11 w-full rounded border px-3" name="dateFrom" defaultValue={dateFrom ?? ""} />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-semibold">등록일 종료</span>
          <input type="date" className="h-11 w-full rounded border px-3" name="dateTo" defaultValue={dateTo ?? ""} min={dateFrom ?? undefined} />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-semibold">정렬</span>
          <select className="h-11 w-full rounded border px-3" name="sort" defaultValue={sort}>
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-semibold">순서</span>
          <select className="h-11 w-full rounded border px-3" name="order" defaultValue={order}>
            <option value="desc">내림차순</option>
            <option value="asc">오름차순</option>
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-semibold">표시 개수</span>
          <select className="h-11 w-full rounded border px-3" name="limit" defaultValue={String(limit)}>
            <option value="20">20건</option>
            <option value="50">50건</option>
            <option value="100">100건</option>
            <option value="500">전체 (500건)</option>
          </select>
        </label>
        <div className="flex items-end gap-2 md:col-span-4">
          <button type="submit" className="flex items-center gap-2 h-11 rounded bg-blue-600 px-5 font-semibold text-white hover:bg-blue-700 transition-colors">
            <Search className="h-4 w-4" />
            필터 적용
          </button>
          {hasActiveFilters && (
            <a href="/projects" className="h-11 flex items-center rounded border px-4 text-sm text-slate-500 hover:bg-slate-50">
              필터 초기화
            </a>
          )}
        </div>
      </form>

      {/* 적용된 필터 칩 */}
      {filterChips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-white p-4">
          <span className="text-sm font-semibold text-slate-600">적용된 필터:</span>
          {filterChips.map((chip) => (
            <Link
              key={chip.key}
              href={chip.href as Route}
              className="flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-200 transition-colors"
            >
              {chip.label}
              <X className="h-3.5 w-3.5" />
            </Link>
          ))}
        </div>
      )}

      {/* dataError 배너 */}
      {dataError && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800">
          {dataError}
        </div>
      )}

      {/* 데스크톱 테이블 */}
      <div className="hidden md:block rounded-xl border bg-white overflow-hidden">
        {rows.length === 0 ? (
          <div className="py-16 text-center">
            <FolderKanban className="mx-auto mb-3 h-16 w-16 text-slate-300" />
            <p className="font-semibold text-slate-600">등록된 프로젝트가 없습니다</p>
            <p className="mt-1 text-sm text-slate-400">필터를 변경하거나 새 프로젝트를 생성해 주세요</p>
          </div>
        ) : (
          <table className="w-full text-left">
            <thead className="border-b bg-slate-50 text-sm">
              <tr>
                <th className="p-3 font-semibold text-slate-600">프로젝트 번호</th>
                <th className="p-3 font-semibold text-slate-600">프로젝트명</th>
                <th className="p-3 font-semibold text-slate-600">고객사</th>
                <th className="p-3 font-semibold text-slate-600">상태</th>
                <th className="p-3 font-semibold text-slate-600">현재 단계</th>
                <th className="p-3 font-semibold text-slate-600">진행률</th>
                <th className="p-3 font-semibold text-slate-600">현재 담당자</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const activeStage = row.stages.find(
                  (s) => s.status === "ACTIVE" || (s.stageNumber === row.currentStage),
                );
                const assigneeName =
                  (activeStage as { assignee?: { name: string } | null } | undefined)
                    ?.assignee?.name ?? "미지정";
                const completedStages = row.stages.filter((s) => s.status === "COMPLETED").length;
                const progress = Math.round((completedStages / 10) * 100);
                return (
                  <tr key={row.id} className="h-14 border-b text-sm hover:bg-slate-50 transition-colors">
                    <td className="p-3 font-mono text-xs text-slate-500">{row.projectNumber}</td>
                    <td className="p-3">
                      <Link href={`/projects/${row.id}`} className="font-semibold hover:text-blue-600 hover:underline">
                        {row.name}
                      </Link>
                    </td>
                    <td className="p-3 text-slate-600">{row.customer.name}</td>
                    <td className="p-3">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${PROJECT_STATUS_COLORS[row.status]}`}>
                        {PROJECT_STATUS_LABELS[row.status]}
                      </span>
                    </td>
                    <td className="p-3">
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium">{row.currentStage}단계</span>
                    </td>
                    <td className="p-3 text-slate-600 text-xs">{progress}%</td>
                    <td className="p-3 text-slate-600 text-xs">{assigneeName}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* 모바일 카드 목록 */}
      <div className="md:hidden space-y-2">
        {rows.length === 0 ? (
          <div className="rounded-xl border bg-white py-16 text-center">
            <FolderKanban className="mx-auto mb-3 h-16 w-16 text-slate-300" />
            <p className="font-semibold text-slate-600">등록된 프로젝트가 없습니다</p>
          </div>
        ) : (
          rows.map((row) => {
            const completedStages = row.stages.filter((s) => s.status === "COMPLETED").length;
            const progress = Math.round((completedStages / 10) * 100);
            return (
              <Link
                key={row.id}
                href={`/projects/${row.id}`}
                className="block rounded-xl border bg-white p-4 hover:border-blue-300 hover:bg-blue-50 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">{row.name}</p>
                    <p className="mt-0.5 text-xs font-mono text-slate-400">{row.projectNumber}</p>
                  </div>
                  <span className={`flex-shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${PROJECT_STATUS_COLORS[row.status]}`}>
                    {PROJECT_STATUS_LABELS[row.status]}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span>{row.customer.name}</span>
                  <span>·</span>
                  <span className="flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5">
                    <MapPin className="h-3 w-3" />
                    {row.site.name}
                  </span>
                  <span className="flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5">
                    <Cog className="h-3 w-3" />
                    {row.processType.name}
                  </span>
                  <span className="flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5">
                    <Package className="h-3 w-3" />
                    {row.itemType.name}
                  </span>
                </div>
                <div className="mt-3">
                  <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                    <span>진행률</span>
                    <span>{progress}%</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="h-full rounded-full bg-blue-500 transition-all"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              </Link>
            );
          })
        )}
      </div>

      <div className="flex items-center justify-between rounded-xl border bg-white px-4 py-3 text-sm">
        <p>
          총 {total}건 / {page}페이지 ({totalPages}페이지 중)
        </p>
        <div className="flex gap-2">
          {previousHref ? (
            <Link href={previousHref as Route} className="rounded border px-3 py-1.5 hover:bg-slate-50">
              이전
            </Link>
          ) : (
            <span className="rounded border px-3 py-1.5 text-slate-400">이전</span>
          )}
          {nextHref ? (
            <Link href={nextHref as Route} className="rounded border px-3 py-1.5 hover:bg-slate-50">
              다음
            </Link>
          ) : (
            <span className="rounded border px-3 py-1.5 text-slate-400">다음</span>
          )}
        </div>
      </div>
    </section>
  );
}

type FilterChipParams = {
  q?: string;
  status?: string;
  customerId?: string;
  siteId?: string;
  processTypeId?: string;
  itemTypeId?: string;
  assigneeId?: string;
  dateFrom?: string;
  dateTo?: string;
  customers: { id: string; name: string }[];
  sites: { id: string; name: string }[];
  processTypes: { id: string; name: string }[];
  itemTypes: { id: string; name: string }[];
  users: { id: string; name: string }[];
};

function buildFilterChips(params: FilterChipParams): { key: string; label: string; href: string }[] {
  const {
    q,
    status,
    customerId,
    siteId,
    processTypeId,
    itemTypeId,
    assigneeId,
    dateFrom,
    dateTo,
    customers,
    sites,
    processTypes,
    itemTypes,
    users,
  } = params;
  const chips: { key: string; label: string; href: string }[] = [];
  const base: Record<string, string | undefined> = { sort: "createdAt", order: "desc", limit: "20" };
  const without = (omitKeys: string[]) => {
    const o = { ...base };
    if (!omitKeys.includes("q") && q) o.q = q;
    if (!omitKeys.includes("status") && status) o.status = status;
    if (!omitKeys.includes("customerId") && customerId) o.customerId = customerId;
    if (!omitKeys.includes("siteId") && siteId) o.siteId = siteId;
    if (!omitKeys.includes("processTypeId") && processTypeId) o.processTypeId = processTypeId;
    if (!omitKeys.includes("itemTypeId") && itemTypeId) o.itemTypeId = itemTypeId;
    if (!omitKeys.includes("assigneeId") && assigneeId) o.assigneeId = assigneeId;
    if (!omitKeys.includes("dateFrom") && dateFrom) o.dateFrom = dateFrom;
    if (!omitKeys.includes("dateTo") && dateTo) o.dateTo = dateTo;
    return buildQuery(o);
  };
  if (q) chips.push({ key: "q", label: `검색어: ${q}`, href: without(["q"]) });
  if (status) chips.push({ key: "status", label: `상태: ${PROJECT_STATUS_LABELS[status as keyof typeof PROJECT_STATUS_LABELS] ?? status}`, href: without(["status"]) });
  if (customerId) chips.push({ key: "customerId", label: `고객사: ${customers.find((c) => c.id === customerId)?.name ?? customerId}`, href: without(["customerId"]) });
  if (siteId) chips.push({ key: "siteId", label: `사업장: ${sites.find((s) => s.id === siteId)?.name ?? siteId}`, href: without(["siteId"]) });
  if (processTypeId) chips.push({ key: "processTypeId", label: `공정: ${processTypes.find((p) => p.id === processTypeId)?.name ?? processTypeId}`, href: without(["processTypeId"]) });
  if (itemTypeId) chips.push({ key: "itemTypeId", label: `품목: ${itemTypes.find((i) => i.id === itemTypeId)?.name ?? itemTypeId}`, href: without(["itemTypeId"]) });
  if (assigneeId) chips.push({ key: "assigneeId", label: `담당자: ${users.find((u) => u.id === assigneeId)?.name ?? assigneeId}`, href: without(["assigneeId"]) });
  if (dateFrom || dateTo) chips.push({ key: "date", label: `등록일: ${[dateFrom, dateTo].filter(Boolean).join(" ~ ")}`, href: without(["dateFrom", "dateTo"]) });
  return chips;
}

function readParam(
  searchParams: Record<string, string | string[] | undefined> | undefined,
  key: string,
) {
  const raw = searchParams?.[key];
  if (Array.isArray(raw)) {
    return raw[0];
  }
  return raw;
}

function buildQuery(params: Record<string, string | undefined>) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) {
      query.set(key, value);
    }
  });
  return `/projects?${query.toString()}`;
}
