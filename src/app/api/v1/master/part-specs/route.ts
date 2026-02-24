import { prisma } from "@/lib/prisma";
import { ok } from "@/lib/api-response";
import { requireApiRole } from "@/lib/api-auth";
import { generatePlusPmsId } from "@/lib/id";

export async function GET() {
  const gate = await requireApiRole("VIEWER");
  if (!gate.ok) return gate.response;
  return ok(await prisma.partSpec.findMany({ orderBy: { name: "asc" } }));
}

export async function POST(request: Request) {
  const gate = await requireApiRole("ADMIN");
  if (!gate.ok) return gate.response;
  const body = await request.json();
  const row = await prisma.partSpec.create({
    data: {
      id: generatePlusPmsId("part_spec"),
      ...body,
    },
  });
  return ok(row, { status: 201 });
}
