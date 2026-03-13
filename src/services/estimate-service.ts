import { EstimateStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { generatePlusPmsId } from "@/lib/id";

export async function listProjectEstimates(projectId: string) {
  return prisma.estimate.findMany({
    where: { projectId },
    include: { items: true, createdBy: true },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * 견적 번호 생성 — 동시성 안전한 방식
 * [수정] count 기반이 아닌 마지막 번호 기반으로 변경
 */
async function generateEstimateNumber() {
  const year = new Date().getFullYear();
  const prefix = `EST-${year}-`;

  const lastEstimate = await prisma.estimate.findFirst({
    where: {
      estimateNumber: { startsWith: prefix },
    },
    orderBy: { estimateNumber: "desc" },
    select: { estimateNumber: true },
  });

  let nextNumber = 1;
  if (lastEstimate?.estimateNumber) {
    const lastNumberStr = lastEstimate.estimateNumber.replace(prefix, "");
    const lastNumber = parseInt(lastNumberStr, 10);
    if (!isNaN(lastNumber)) {
      nextNumber = lastNumber + 1;
    }
  }

  return `${prefix}${String(nextNumber).padStart(3, "0")}`;
}

export async function createEstimate(input: {
  projectId: string;
  createdById: string;
  title: string;
  notes?: string;
  taxRate?: number; // 세율 (기본 10%)
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
  // [수정] 입력 검증 추가
  if (!input.items || input.items.length === 0) {
    throw new Error("견적 항목이 최소 1개 이상 필요합니다.");
  }

  const estimateNumber = await generateEstimateNumber();
  // [수정] 부동소수점 오류 방지: Math.round 사용, 세율 설정 가능
  const taxRate = input.taxRate ?? 0.1;
  const totalAmount = input.items.reduce(
    (sum, item) => sum + Math.round(item.quantity * item.unitPrice),
    0
  );
  const taxAmount = Math.round(totalAmount * taxRate);
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
    status: EstimateStatus;
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
