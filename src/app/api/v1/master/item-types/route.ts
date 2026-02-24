import { prisma } from "@/lib/prisma";
import { ok } from "@/lib/api-response";
import { requireApiRole } from "@/lib/api-auth";
import { generatePlusPmsId } from "@/lib/id";

export async function GET() {
  const gate = await requireApiRole("VIEWER");
  if (!gate.ok) return gate.response;
  return ok(await prisma.itemType.findMany({ orderBy: { name: "asc" } }));
}

export async function POST(request: Request) {
  const gate = await requireApiRole("ADMIN");
  if (!gate.ok) return gate.response;
  const body = await request.json();
  const row = await prisma.itemType.create({
    data: {
      id: generatePlusPmsId("item_type"),
      ...body,
    },
  });
  return ok(row, { status: 201 });
}

export async function PATCH(request: Request) {
  const gate = await requireApiRole("ADMIN");
  if (!gate.ok) return gate.response;
  const body = await request.json();
  const row = await prisma.itemType.update({
    where: { id: body.id },
    data: body,
  });
  return ok(row);
}
