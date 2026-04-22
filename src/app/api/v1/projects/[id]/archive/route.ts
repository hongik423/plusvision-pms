import { fail, ok } from "@/lib/api-response";
import { requireProjectAccess } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

// POST: 보관 / DELETE: 보관 해제
export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const gate = await requireProjectAccess(params.id, "MANAGER");
  if (!gate.ok) return gate.response;

  const row = await prisma.project.update({
    where: { id: params.id },
    data: { isArchived: true },
  });
  return ok(row);
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const gate = await requireProjectAccess(params.id, "MANAGER");
  if (!gate.ok) return gate.response;

  const row = await prisma.project.update({
    where: { id: params.id },
    data: { isArchived: false },
  });
  return ok(row);
}
