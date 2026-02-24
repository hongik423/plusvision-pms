import { prisma } from "@/lib/prisma";
import { ok } from "@/lib/api-response";
import { requireApiRole } from "@/lib/api-auth";

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const gate = await requireApiRole("ADMIN");
  if (!gate.ok) return gate.response;
  const body = await request.json();
  const row = await prisma.partSpec.update({
    where: { id: params.id },
    data: body,
  });
  return ok(row);
}
