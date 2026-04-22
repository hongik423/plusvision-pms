import { prisma } from "@/lib/prisma";
import { STAGE_NAMES } from "@/lib/constants";

export async function dashboardStats(userId: string) {
  const [totalProjects, activeProjects, completedProjects, holdProjects, myTasks] = await Promise.all([
    prisma.project.count({ where: { isArchived: false } }),
    prisma.project.count({ where: { status: "ACTIVE", isArchived: false } }),
    prisma.project.count({ where: { status: "COMPLETED", isArchived: false } }),
    prisma.project.count({ where: { status: "HOLD", isArchived: false } }),
    prisma.projectStage.count({ where: { assigneeId: userId, status: "ACTIVE", project: { isArchived: false } } }),
  ]);

  return { totalProjects, activeProjects, completedProjects, holdProjects, myTasks };
}

export async function dashboardMyTasks(userId: string) {
  return prisma.projectStage.findMany({
    where: {
      assigneeId: userId,
      status: "ACTIVE",
      project: { isArchived: false, status: { in: ["PENDING", "ACTIVE"] } },
    },
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
    where: { isArchived: false, status: { in: ["PENDING", "ACTIVE"] } },
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

/** MaxClientsInSessionMode 방지: 단일 트랜잭션에서 모든 쿼리 실행 (1개 연결 사용) */
export async function fetchAllDashboardData(userId: string) {
  return prisma.$transaction(async (tx) => {
    const [totalProjects, activeProjects, completedProjects, cancelledProjects, holdProjects, myTasks] = await Promise.all([
      tx.project.count({ where: { isArchived: false } }),
      tx.project.count({ where: { status: "ACTIVE", isArchived: false } }),
      tx.project.count({ where: { status: "COMPLETED", isArchived: false } }),
      tx.project.count({ where: { status: "CANCELLED", isArchived: false } }),
      tx.project.count({ where: { status: "HOLD", isArchived: false } }),
      tx.projectStage.count({ where: { assigneeId: userId, status: "ACTIVE", project: { isArchived: false, status: { in: ["PENDING", "ACTIVE"] } } } }),
    ]);
    const stats = { totalProjects, activeProjects, completedProjects, cancelledProjects, holdProjects, myTasks };

    const tasks = await tx.projectStage.findMany({
      where: {
        assigneeId: userId,
        status: "ACTIVE",
        project: { isArchived: false, status: { in: ["PENDING", "ACTIVE"] } },
      },
      include: { project: true },
      orderBy: { updatedAt: "desc" },
    });

    const projectList = await tx.project.findMany({
      where: { isArchived: false },
      select: { id: true, name: true, currentStage: true },
      orderBy: { currentStage: "asc" },
    });
    const stageMap = new Map<number, { id: string; name: string }[]>();
    projectList.forEach((p) => {
      const list = stageMap.get(p.currentStage) ?? [];
      list.push({ id: p.id, name: p.name });
      stageMap.set(p.currentStage, list);
    });
    const distributions = Array.from(stageMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([stageNumber, projects]) => ({
        stageNumber,
        stageName: STAGE_NAMES[stageNumber] ?? `${stageNumber}단계`,
        count: projects.length,
        projects,
      }));

    const activities = await tx.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { user: true, project: true },
    });

    const since = new Date();
    since.setMonth(since.getMonth() - 5);
    since.setDate(1);
    since.setHours(0, 0, 0, 0);
    const completedProjectList = await tx.project.findMany({
      where: {
        status: "COMPLETED",
        completedDate: { gte: since },
      },
      select: { completedDate: true },
    });
    const bucket = new Map<string, number>();
    for (let i = 0; i < 6; i += 1) {
      const month = new Date(since);
      month.setMonth(since.getMonth() + i);
      const key = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}`;
      bucket.set(key, 0);
    }
    completedProjectList.forEach((project) => {
      if (project.completedDate) {
        const key = `${project.completedDate.getFullYear()}-${String(project.completedDate.getMonth() + 1).padStart(2, "0")}`;
        if (bucket.has(key)) bucket.set(key, (bucket.get(key) ?? 0) + 1);
      }
    });
    const monthly = Array.from(bucket.entries()).map(([month, completedCount]) => ({ month, completedCount }));

    const workloadGrouped = await tx.projectStage.groupBy({
      by: ["assigneeId"],
      where: { assigneeId: { not: null }, project: { isArchived: false } },
      _count: { _all: true },
    });
    const taskCountById = new Map(
      workloadGrouped
        .filter((r): r is typeof r & { assigneeId: string } => Boolean(r.assigneeId))
        .map((r) => [r.assigneeId, r._count._all])
    );
    const assigneeIds = [...taskCountById.keys()];
    const assignees = assigneeIds.length > 0
      ? await tx.user.findMany({
          where: { id: { in: assigneeIds } },
          select: { id: true, name: true },
        })
      : [];
    const workloads = assignees
      .map((u) => ({
        assigneeId: u.id,
        assigneeName: u.name,
        taskCount: taskCountById.get(u.id) ?? 0,
      }))
      .filter((row) => row.taskCount > 0)
      .sort((a, b) => a.assigneeName.localeCompare(b.assigneeName, "ko"));

    return { stats, tasks, distributions, activities, monthly, workloads };
  });
}

export async function assigneeWorkload() {
  const grouped = await prisma.projectStage.groupBy({
    by: ["assigneeId"],
    where: { status: "ACTIVE", assigneeId: { not: null }, project: { isArchived: false } },
    _count: { _all: true },
  });

  const taskCountById = new Map(
    grouped
      .filter((r): r is typeof r & { assigneeId: string } => Boolean(r.assigneeId))
      .map((r) => [r.assigneeId, r._count._all])
  );
  const assigneeIds = [...taskCountById.keys()];
  if (assigneeIds.length === 0) {
    return [];
  }

  const allUsers = await prisma.user.findMany({
    where: { id: { in: assigneeIds } },
    select: { id: true, name: true },
  });

  return allUsers
    .map((u) => ({
      assigneeId: u.id,
      assigneeName: u.name,
      taskCount: taskCountById.get(u.id) ?? 0,
    }))
    .filter((row) => row.taskCount > 0)
    .sort((a, b) => b.taskCount - a.taskCount || a.assigneeName.localeCompare(b.assigneeName, "ko"));
}
