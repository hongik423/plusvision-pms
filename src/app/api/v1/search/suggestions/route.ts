import { prisma } from "@/lib/prisma";
import { ok } from "@/lib/api-response";
import { requireApiRole } from "@/lib/api-auth";

export async function GET(request: Request) {
  const gate = await requireApiRole("VIEWER");
  if (!gate.ok) return gate.response;

  const q = new URL(request.url).searchParams.get("q") ?? "";
  if (!q) return ok([]);

  const projects = await prisma.project.findMany({
    where: { name: { contains: q, mode: "insensitive" } },
    select: { id: true, name: true, projectNumber: true },
    take: 10,
  });

  return ok(projects.map((p) => ({ id: p.id, label: `${p.projectNumber} - ${p.name}` })));
}
