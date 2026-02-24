import { prisma } from "@/lib/prisma";
import { normalizeRows } from "@/scripts/migration/normalize";
import type { LegacyProjectRow } from "@/scripts/migration/types";

async function main() {
  const exampleRows: LegacyProjectRow[] = [
    {
      legacyId: "LEG-001",
      name: "샘플 이전 프로젝트",
      customerCode: "SEC",
      siteCode: "GH",
      processCode: "CMP",
      itemCode: "CABLE",
      description: "dry-run 샘플",
    },
  ];

  const normalized = normalizeRows(exampleRows);
  const invalid = normalized.filter((row) => row.errors.length > 0);
  if (invalid.length > 0) {
    console.error("검증 실패:", invalid);
    process.exit(1);
  }

  const masters = await Promise.all([
    prisma.customer.findMany({ select: { code: true } }),
    prisma.site.findMany({ select: { code: true } }),
    prisma.processType.findMany({ select: { code: true } }),
    prisma.itemType.findMany({ select: { code: true } }),
  ]);
  console.log("마스터 코드 로딩 완료");
  console.log("고객사", masters[0].map((x) => x.code));
  console.log("사업장", masters[1].map((x) => x.code));
  console.log("공정", masters[2].map((x) => x.code));
  console.log("품목", masters[3].map((x) => x.code));
  console.log("dry-run 완료 (실데이터 반영 없음)");
}

main()
  .catch((error) => {
    console.error("dry-run 실패:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
