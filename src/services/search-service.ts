import { prisma } from "@/lib/prisma";

export type SearchParams = {
  query: string;
  dateFrom?: string;
  dateTo?: string;
};

export async function integratedSearch({ query, dateFrom, dateTo }: SearchParams) {
  if (!query.trim() && !dateFrom && !dateTo) {
    return { projects: [], documents: [], estimates: [] };
  }

  const dateFilter =
    dateFrom || dateTo
      ? {
          createdAt: {
            ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
            ...(dateTo ? { lte: new Date(`${dateTo}T23:59:59.999Z`) } : {}),
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
        ...(dateFrom || dateTo
          ? {
              createdAt: {
                ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
                ...(dateTo ? { lte: new Date(`${dateTo}T23:59:59.999Z`) } : {}),
              },
            }
          : {}),
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
