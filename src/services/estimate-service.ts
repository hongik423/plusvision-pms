import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { generatePlusPmsId } from "@/lib/id";

export async function listProjectEstimates(projectId: string) {
  return prisma.estimate.findMany({
    where: { projectId },
    include: { items: true, createdBy: true },
    orderBy: { createdAt: "desc" },
  });
}

async function generateEstimateNumber() {
  const year = new Date().getFullYear();
  const prefix = `EST-${year}-`;
  const count = await prisma.estimate.count({
    where: {
      estimateNumber: { startsWith: prefix },
    },
  });
  return `${prefix}${String(count + 1).padStart(3, "0")}`;
}

export async function createEstimate(input: {
  projectId: string;
  createdById: string;
  title: string;
  notes?: string;
  items: {
    partSpecId?: string;
    itemName: string;
    specification?: string;
    unit: string;
    quantity: number;
    unitPrice: number;
    remarks?: string;
  }[];
}) {
  const estimateNumber = await generateEstimateNumber();
  const totalAmount = input.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const taxAmount = Math.floor(totalAmount * 0.1);
  const grandTotal = totalAmount + taxAmount;

  return prisma.estimate.create({
    data: {
      id: generatePlusPmsId("estimate"),
      projectId: input.projectId,
      estimateNumber,
      title: input.title,
      notes: input.notes,
      createdById: input.createdById,
      totalAmount: new Prisma.Decimal(totalAmount),
      taxAmount: new Prisma.Decimal(taxAmount),
      grandTotal: new Prisma.Decimal(grandTotal),
      items: {
        create: input.items.map((item, index) => ({
          id: generatePlusPmsId("estimate_item"),
          ...item,
          quantity: new Prisma.Decimal(item.quantity),
          unitPrice: new Prisma.Decimal(item.unitPrice),
          amount: new Prisma.Decimal(item.quantity * item.unitPrice),
          sortOrder: index,
        })),
      },
    },
    include: { items: true },
  });
}

export async function getEstimateById(id: string) {
  return prisma.estimate.findUnique({
    where: { id },
    include: { items: { include: { partSpec: true } }, project: true, createdBy: true },
  });
}

export async function updateEstimate(
  id: string,
  input: Partial<{
    title: string;
    notes: string;
    status: string;
  }>,
) {
  return prisma.estimate.update({
    where: { id },
    data: {
      ...(input.title ? { title: input.title } : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
      ...(input.status ? { status: input.status } : {}),
    },
  });
}

export async function deleteEstimate(id: string) {
  return prisma.estimate.delete({ where: { id } });
}
