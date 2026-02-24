import { prisma } from "@/lib/prisma";
import { STAGE_NAMES } from "@/lib/constants";

export async function dashboardStats(userId: string) {
  const [totalProjects, activeProjects, completedProjects, holdProjects, myTasks] = await Promise.all([
    prisma.project.count(),
    prisma.project.count({ where: { status: "ACTIVE" } }),
    prisma.project.count({ where: { status: "COMPLETED" } }),
    prisma.project.count({ where: { status: "HOLD" } }),
    prisma.projectStage.count({ where: { assigneeId: userId, status: "ACTIVE" } }),
  ]);

  return { totalProjects, activeProjects, completedProjects, holdProjects, myTasks };
}

export async function dashboardMyTasks(userId: string) {
  return prisma.projectStage.findMany({
    where: { assigneeId: userId, status: "ACTIVE" },
    include: { project: true },
    orderBy: { updatedAt: "desc" },
  });
}

export async function recentActivities() {
  return prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
    include: { user: true, project: true },
  });
}

export async function stageDistribution() {
  const grouped = await prisma.project.groupBy({
    by: ["currentStage"],
    _count: { _all: true },
    orderBy: { currentStage: "asc" },
  });

  return grouped.map((row) => ({
    stageNumber: row.currentStage,
    stageName: STAGE_NAMES[row.currentStage] ?? `${row.currentStage}단계`,
    count: row._count._all,
  }));
}

export async function monthlyPerformance(months = 6) {
  const since = new Date();
  since.setMonth(since.getMonth() - (months - 1));
  since.setDate(1);
  since.setHours(0, 0, 0, 0);

  const completedProjects = await prisma.project.findMany({
    where: {
      status: "COMPLETED",
      completedDate: {
        gte: since,
      },
    },
    select: {
      completedDate: true,
    },
  });

  const bucket = new Map<string, number>();
  for (let i = 0; i < months; i += 1) {
    const month = new Date(since);
    month.setMonth(since.getMonth() + i);
    const key = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}`;
    bucket.set(key, 0);
  }

  completedProjects.forEach((project) => {
    if (!project.completedDate) {
      return;
    }
    const key = `${project.completedDate.getFullYear()}-${String(project.completedDate.getMonth() + 1).padStart(2, "0")}`;
    if (bucket.has(key)) {
      bucket.set(key, (bucket.get(key) ?? 0) + 1);
    }
  });

  return Array.from(bucket.entries()).map(([month, completedCount]) => ({
    month,
    completedCount,
  }));
}

export async function assigneeWorkload() {
  const grouped = await prisma.projectStage.groupBy({
    by: ["assigneeId"],
    where: {
      status: "ACTIVE",
      assigneeId: {
        not: null,
      },
    },
    _count: {
      _all: true,
    },
  });

  const assigneeIds = grouped
    .map((row) => row.assigneeId)
    .filter((value): value is string => Boolean(value));
  const users = assigneeIds.length
    ? await prisma.user.findMany({
        where: { id: { in: assigneeIds } },
        select: { id: true, name: true },
      })
    : [];
  const nameById = new Map(users.map((user) => [user.id, user.name]));

  return grouped
    .filter((row): row is typeof row & { assigneeId: string } => Boolean(row.assigneeId))
    .map((row) => ({
      assigneeId: row.assigneeId,
      assigneeName: nameById.get(row.assigneeId) ?? "미지정",
      taskCount: row._count._all,
    }))
    .sort((a, b) => b.taskCount - a.taskCount);
}
