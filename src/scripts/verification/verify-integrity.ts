import { prisma } from "@/lib/prisma";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

async function main() {
  const projects = await prisma.project.findMany({
    include: {
      stages: true,
      members: true,
    },
  });

  const errors: string[] = [];
  const warnings: string[] = [];
  for (const project of projects) {
    if (project.stages.length !== 10) {
      errors.push(`${project.projectNumber}: 단계 개수(${project.stages.length}) 오류`);
    }
  }

  const documents = await prisma.stageDocument.findMany({
    include: {
      stage: {
        include: {
          project: {
            select: { projectNumber: true },
          },
        },
      },
    },
  });
  documents.forEach((doc) => {
    if (!doc.fileUrl) {
      errors.push(`${doc.id}: fileUrl 누락`);
    }
    if (doc.storageType === "GOOGLE_DRIVE" && !doc.externalId) {
      warnings.push(`${doc.id}: GOOGLE_DRIVE 문서인데 externalId가 없습니다.`);
    }
  });

  const report = {
    generatedAt: new Date().toISOString(),
    projectCount: projects.length,
    documentCount: documents.length,
    errorCount: errors.length,
    warningCount: warnings.length,
    errors,
    warnings,
  };
  const reportDir = resolve(process.cwd(), "scripts", "verification", "reports");
  mkdirSync(reportDir, { recursive: true });
  const reportFile = resolve(reportDir, `integrity-report-${Date.now()}.json`);
  writeFileSync(reportFile, `${JSON.stringify(report, null, 2)}\n`, "utf-8");

  if (errors.length > 0) {
    console.error("무결성 검증 실패");
    for (const error of errors) {
      console.error("-", error);
    }
    process.exit(1);
  }

  if (warnings.length > 0) {
    console.warn("무결성 경고");
    for (const warning of warnings) {
      console.warn("-", warning);
    }
  }

  console.log(`리포트 저장: ${reportFile}`);
  console.log(`무결성 검증 통과: 프로젝트 ${projects.length}건`);
}

main()
  .catch((error) => {
    console.error("무결성 검증 실패:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
