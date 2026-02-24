import { prisma } from "@/lib/prisma";
import { ok } from "@/lib/api-response";
import { requireApiRole } from "@/lib/api-auth";

export async function GET() {
  const gate = await requireApiRole("ADMIN");
  if (!gate.ok) return gate.response;
  const rows = await prisma.auditLog.findMany({
    include: { user: true, project: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return ok(rows);
}
