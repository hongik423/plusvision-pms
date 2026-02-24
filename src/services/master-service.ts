import { prisma } from "@/lib/prisma";

export async function getMasterData() {
  const [sites, processTypes, itemTypes, customers, partSpecs] = await Promise.all([
    prisma.site.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.processType.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.itemType.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.customer.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.partSpec.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
  ]);
  return { sites, processTypes, itemTypes, customers, partSpecs };
}
