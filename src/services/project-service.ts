import { Prisma, ProjectStatus, StageStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { STAGE_NAMES } from "@/lib/constants";
import { generatePlusPmsId } from "@/lib/id";

type CreateProjectInput = {
  name: string;
  description?: string;
  customerId: string;
  siteId: string;
  processTypeId: string;
  itemTypeId: string;
  startDate?: string;
  dueDate?: string;
  createdById: string;
  copyFromId?: string;
};

export async function listProjects(params: {
  page: number;
  limit: number;
  status?: ProjectStatus;
  q?: string;
  customerId?: string;
  siteId?: string;
  processTypeId?: string;
  itemTypeId?: string;
  assigneeId?: string;
  startDate?: string;
  endDate?: string;
  sort?: "createdAt" | "name" | "dueDate" | "status";
  order?: "asc" | "desc";
  role?: "ADMIN" | "MANAGER" | "USER" | "VIEWER";
  userId?: string;
}) {
  const {
    page,
    limit,
    status,
    q,
    customerId,
    siteId,
    processTypeId,
    itemTypeId,
    assigneeId,
    startDate,
    endDate,
    sort = "createdAt",
    order = "desc",
    role = "VIEWER",
    userId,
  } = params;
  const where: Prisma.ProjectWhereInput = {
    ...(role === "USER" && userId
      ? {
          OR: [
            { createdById: userId },
            { members: { some: { userId } } },
            { stages: { some: { assigneeId: userId } } },
          ],
        }
      : {}),
    ...(status ? { status } : {}),
    ...(customerId ? { customerId } : {}),
    ...(siteId ? { siteId } : {}),
    ...(processTypeId ? { processTypeId } : {}),
    ...(itemTypeId ? { itemTypeId } : {}),
    ...(assigneeId
      ? {
          stages: {
            some: {
              assigneeId,
            },
          },
        }
      : {}),
    ...(startDate || endDate
      ? {
          createdAt: {
            ...(startDate ? { gte: new Date(startDate) } : {}),
            ...(endDate ? { lte: new Date(endDate) } : {}),
          },
        }
      : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { projectNumber: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.project.findMany({
      where,
      include: {
        customer: true,
        site: true,
        processType: true,
        itemType: true,
        stages: { include: { assignee: { select: { id: true, name: true } } }, orderBy: { stageNumber: "asc" } },
      },
      orderBy: { [sort]: order },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.project.count({ where }),
  ]);

  return { rows, total };
}

export async function generateProjectNumber() {
  const year = new Date().getFullYear();
  const prefix = `PV-${year}-`;
  const count = await prisma.project.count({
    where: {
      projectNumber: {
        startsWith: prefix,
      },
    },
  });
  return `${prefix}${String(count + 1).padStart(3, "0")}`;
}

export async function createProject(input: CreateProjectInput) {
  const projectNumber = await generateProjectNumber();
  return prisma.$transaction(async (tx) => {
    const project = await tx.project.create({
      data: {
        id: generatePlusPmsId("project"),
        projectNumber,
        name: input.name,
        description: input.description,
        customerId: input.customerId,
        siteId: input.siteId,
        processTypeId: input.processTypeId,
        itemTypeId: input.itemTypeId,
        status: ProjectStatus.ACTIVE,
        startDate: input.startDate ? new Date(input.startDate) : null,
        dueDate: input.dueDate ? new Date(input.dueDate) : null,
        createdById: input.createdById,
        copiedFromId: input.copyFromId,
      },
    });

    await tx.projectStage.createMany({
      data: Array.from({ length: 10 }, (_, index) => ({
        id: generatePlusPmsId("project_stage"),
        projectId: project.id,
        stageNumber: index + 1,
        stageName: STAGE_NAMES[index + 1],
        status: index === 0 ? StageStatus.ACTIVE : StageStatus.INACTIVE,
      })),
    });

    await tx.auditLog.create({
      data: {
        id: generatePlusPmsId("audit_log"),
        userId: input.createdById,
        projectId: project.id,
        action: "PROJECT_CREATED",
        entityType: "Project",
        entityId: project.id,
        changes: {
          after: {
            projectNumber: project.projectNumber,
            name: project.name,
          },
        },
      },
    });

    return project;
  });
}

export async function getProjectById(id: string) {
  return prisma.project.findUnique({
    where: { id },
    include: {
      customer: true,
      site: true,
      processType: true,
      itemType: true,
      createdBy: true,
      stages: {
        include: { assignee: true, documents: true },
        orderBy: { stageNumber: "asc" },
      },
      members: { include: { user: true } },
      estimates: true,
      manuals: true,
    },
  });
}

export async function updateProject(
  id: string,
  input: Partial<{
    name: string;
    description: string;
    status: ProjectStatus;
    dueDate: string;
    completedDate: string;
  }>,
) {
  return prisma.project.update({
    where: { id },
    data: {
      ...(input.name ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.status ? { status: input.status } : {}),
      ...(input.dueDate ? { dueDate: new Date(input.dueDate) } : {}),
      ...(input.completedDate ? { completedDate: new Date(input.completedDate) } : {}),
    },
  });
}

export async function deleteProject(id: string) {
  return prisma.project.delete({ where: { id } });
}

export async function copyProject(projectId: string, createdById: string) {
  const source = await prisma.project.findUnique({
    where: { id: projectId },
    include: { stages: true },
  });
  if (!source) {
    return null;
  }

  const copy = await createProject({
    name: `${source.name} (복사본)`,
    description: source.description ?? undefined,
    customerId: source.customerId,
    siteId: source.siteId,
    processTypeId: source.processTypeId,
    itemTypeId: source.itemTypeId,
    createdById,
    copyFromId: source.id,
  });

  return copy;
}
