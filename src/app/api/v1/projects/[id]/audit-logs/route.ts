import { prisma } from "@/lib/prisma";
import { ok } from "@/lib/api-response";
import { requireProjectAccess } from "@/lib/api-auth";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const gate = await requireProjectAccess(params.id, "MANAGER");
  if (!gate.ok) return gate.response;
  const rows = await prisma.auditLog.findMany({
    where: { projectId: params.id },
    include: { user: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return ok(rows);
}
