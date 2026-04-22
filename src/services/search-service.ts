import { prisma } from "@/lib/prisma";

export type SearchParams = {
  query: string;
  dateFrom?: string;
  dateTo?: string;
};

/**
 * 날짜 문자열이 유효한지 검증 — Invalid Date 방지
 */
function isValidDateString(dateStr: string): boolean {
  const date = new Date(dateStr);
  return !isNaN(date.getTime());
}

export async function integratedSearch({ query, dateFrom, dateTo }: SearchParams) {
  if (!query.trim() && !dateFrom && !dateTo) {
    return { projects: [], documents: [], estimates: [] };
  }

  // [수정] 날짜 유효성 검증 추가
  const validDateFrom = dateFrom && isValidDateString(dateFrom) ? dateFrom : undefined;
  const validDateTo = dateTo && isValidDateString(dateTo) ? dateTo : undefined;

  const dateFilter =
    validDateFrom || validDateTo
      ? {
          createdAt: {
            ...(validDateFrom ? { gte: new Date(validDateFrom) } : {}),
            ...(validDateTo ? { lte: new Date(`${validDateTo}T23:59:59.999Z`) } : {}),
          },
        }
      : {};

  const docDateFilter =
    validDateFrom || validDateTo
      ? {
          createdAt: {
            ...(validDateFrom ? { gte: new Date(validDateFrom) } : {}),
            ...(validDateTo ? { lte: new Date(`${validDateTo}T23:59:59.999Z`) } : {}),
          },
        }
      : {};

  const textFilter = query.trim()
    ? {
        OR: [
          { name: { contains: query, mode: "insensitive" as const } },
          { projectNumber: { contains: query, mode: "insensitive" as const } },
        ],
      }
    : {};

  const [projects, documents, estimates] = await Promise.all([
    prisma.project.findMany({
      where: { ...textFilter, ...dateFilter },
      include: { customer: true, site: true, processType: true, itemType: true },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.stageDocument.findMany({
      where: {
        ...(query.trim() ? { fileName: { contains: query, mode: "insensitive" } } : {}),
        ...docDateFilter,
        deletedAt: null,
      },
      include: { stage: { include: { project: true } } },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.estimate.findMany({
      where: {
        ...(query.trim()
          ? {
              OR: [
                { title: { contains: query, mode: "insensitive" } },
                { estimateNumber: { contains: query, mode: "insensitive" } },
              ],
            }
          : {}),
        ...dateFilter,
      },
      include: { project: true },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  return { projects, documents, estimates };
}
