import { ManualType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { generatePlusPmsId } from "@/lib/id";

export async function listProjectManuals(projectId: string) {
  return prisma.manual.findMany({
    where: { projectId },
    include: { createdBy: true },
    orderBy: [{ type: "asc" }, { updatedAt: "desc" }],
  });
}

export async function createManual(input: {
  projectId: string;
  createdById: string;
  type: ManualType;
  title: string;
  content: string;
}) {
  return prisma.manual.create({
    data: {
      id: generatePlusPmsId("manual"),
      projectId: input.projectId,
      createdById: input.createdById,
      type: input.type,
      title: input.title,
      content: input.content,
    },
    include: { createdBy: true },
  });
}

export async function updateManual(
  manualId: string,
  input: Partial<{
    title: string;
    content: string;
  }>,
) {
  return prisma.manual.update({
    where: { id: manualId },
    data: {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.content !== undefined ? { content: input.content } : {}),
      version: { increment: 1 },
    },
    include: { createdBy: true, project: true },
  });
}

export async function getManualById(manualId: string) {
  return prisma.manual.findUnique({
    where: { id: manualId },
    include: { createdBy: true, project: true },
  });
}
