import { prisma } from "@/lib/prisma";
import { ok } from "@/lib/api-response";
import { requireApiRole } from "@/lib/api-auth";

export async function GET(request: Request) {
  const gate = await requireApiRole("VIEWER");
  if (!gate.ok) {
    return gate.response;
  }

  const url = new URL(request.url);
  const customerId = url.searchParams.get("customerId");
  const siteId = url.searchParams.get("siteId");
  const processTypeId = url.searchParams.get("processTypeId");
  const itemTypeId = url.searchParams.get("itemTypeId");

  const rows = await prisma.project.findMany({
    where: {
      ...(customerId ? { customerId } : {}),
      ...(siteId ? { siteId } : {}),
      ...(processTypeId ? { processTypeId } : {}),
      ...(itemTypeId ? { itemTypeId } : {}),
    },
    include: {
      customer: true,
      site: true,
      processType: true,
      itemType: true,
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return ok(rows);
}
