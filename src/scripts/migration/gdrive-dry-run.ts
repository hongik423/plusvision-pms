/**
 * Google Drive 마이그레이션 Dry-Run 스크립트
 *
 * 실제 이전 없이 파일 분류 결과와 인증 상태를 확인합니다.
 *
 * 사용 방법:
 *   npx tsx scripts/migration/gdrive-dry-run.ts
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { prisma } from "@/lib/prisma";
import { createGoogleDriveAdapter, type DriveFileDescriptor } from "@/scripts/migration/google-drive-adapter";
import type { DocumentClassification } from "@/scripts/migration/types";

function classifyDocument(fileName: string, relativePath?: string): DocumentClassification {
  const name = fileName.toLowerCase();
  const path = (relativePath ?? "").toLowerCase();

  const stageFromPath = (() => {
    const match = path.match(/(?:stage[-_]?|단계[-_]?|step[-_]?)(\d+)/);
    if (match) {
      const n = Number(match[1]);
      return n >= 1 && n <= 10 ? n : null;
    }
    return null;
  })();

  if (name.includes("견적") || name.includes("estimate")) return { stageNumber: stageFromPath ?? 6, documentType: "ESTIMATE" };
  if (name.includes("제안") || name.includes("proposal")) return { stageNumber: stageFromPath ?? 6, documentType: "PROPOSAL" };
  if ((name.includes("제작") || name.includes("manufacture")) && name.includes("매뉴얼")) return { stageNumber: stageFromPath ?? 7, documentType: "MANUFACTURE_MANUAL" };
  if ((name.includes("설치") || name.includes("install")) && name.includes("매뉴얼")) return { stageNumber: stageFromPath ?? 8, documentType: "INSTALL_MANUAL" };
  if (name.includes("부품") || name.includes("파트") || name.includes("parts")) return { stageNumber: stageFromPath ?? 7, documentType: "PARTS_LIST" };
  if (/\.(jpg|jpeg|png|gif)$/i.test(name) || name.includes("현장") || name.includes("사진")) return { stageNumber: stageFromPath ?? 3, documentType: "SITE_PHOTO" };
  if (/\.(dwg|dxf)$/i.test(name) || name.includes("도면")) return { stageNumber: stageFromPath ?? 7, documentType: "DRAWING" };
  if (name.includes("회의록") || name.includes("meeting")) return { stageNumber: stageFromPath ?? 3, documentType: "MEETING_NOTE" };
  return { stageNumber: stageFromPath ?? 10, documentType: "OTHER" };
}

async function main() {
  const folderId = process.env.GOOGLE_DRIVE_SOURCE_FOLDER_ID;
  const targetProjectId = process.env.MIGRATION_TARGET_PROJECT_ID;
  const recursive = process.env.MIGRATION_RECURSIVE === "true";

  if (!folderId) {
    console.error("❌ GOOGLE_DRIVE_SOURCE_FOLDER_ID 환경 변수가 필요합니다.");
    process.exit(1);
  }

  const adapter = createGoogleDriveAdapter();

  // ── 인증 확인 ──────────────────────────────
  console.log("🔑 Google Drive 인증 확인 중...");
  try {
    const token = await adapter.getAccessToken();
    console.log(`✅ 인증 성공 (token: ${token.slice(0, 20)}...)`);
  } catch (err) {
    console.error("❌ 인증 실패:", err);
    console.error("   oauth-setup.ts를 먼저 실행하여 GOOGLE_DRIVE_REFRESH_TOKEN을 발급받으세요.");
    process.exit(1);
  }

  // ── 파일 목록 수집 ─────────────────────────
  console.log(`\n📂 파일 목록 조회 중... (폴더: ${folderId}, 재귀: ${recursive})`);
  let files: DriveFileDescriptor[];
  if (recursive) {
    files = await adapter.listFilesRecursive(folderId);
  } else {
    files = await adapter.listFiles(folderId);
  }
  files = files.filter((f) => f.mimeType !== "application/vnd.google-apps.folder");
  console.log(`📄 총 파일: ${files.length}건\n`);

  // ── 이미 이전된 파일 확인 ──────────────────
  let alreadyMigratedCount = 0;
  if (targetProjectId) {
    const stageRows = await prisma.projectStage.findMany({
      where: { projectId: targetProjectId },
      select: { id: true },
    });
    const existing = await prisma.stageDocument.findMany({
      where: { stageId: { in: stageRows.map((r) => r.id) }, externalId: { not: null } },
      select: { externalId: true },
    });
    const migratedIds = new Set(existing.map((d) => d.externalId));
    alreadyMigratedCount = files.filter((f) => migratedIds.has(f.id)).length;
  }

  // ── 분류 실행 ──────────────────────────────
  const mappings = files.map((file) => ({
    driveFileId: file.id,
    fileName: file.name,
    relativePath: file.relativePath,
    mimeType: file.mimeType,
    sizeKB: file.size ? Math.ceil(file.size / 1024) : null,
    ...classifyDocument(file.name, file.relativePath),
  }));

  // ── 분류 요약 ──────────────────────────────
  const byType: Record<string, number> = {};
  const byStage: Record<number, number> = {};
  for (const m of mappings) {
    byType[m.documentType] = (byType[m.documentType] ?? 0) + 1;
    byStage[m.stageNumber] = (byStage[m.stageNumber] ?? 0) + 1;
  }

  console.log("=".repeat(50));
  console.log("📊 문서 유형별 분류 요약");
  console.log("=".repeat(50));
  Object.entries(byType).forEach(([type, count]) => {
    console.log(`  ${type.padEnd(25)} ${count}건`);
  });

  console.log("\n📊 단계별 분류 요약");
  console.log("=".repeat(50));
  Object.entries(byStage).sort(([a], [b]) => Number(a) - Number(b)).forEach(([stage, count]) => {
    console.log(`  ${stage}단계${"".padEnd(22)} ${count}건`);
  });

  if (alreadyMigratedCount > 0) {
    console.log(`\nℹ️  이미 이전된 파일 (skip 예정): ${alreadyMigratedCount}건`);
  }

  // ── 샘플 출력 ──────────────────────────────
  console.log("\n📋 샘플 (최대 15건):");
  console.log("=".repeat(50));
  mappings.slice(0, 15).forEach((m) => {
    const sizeStr = m.sizeKB ? `${m.sizeKB}KB` : "Google형식";
    const pathStr = m.relativePath ? ` [${m.relativePath}]` : "";
    console.log(`  ${m.stageNumber}단계 / ${m.documentType.padEnd(20)} ${m.fileName}${pathStr} (${sizeStr})`);
  });

  // ── dry-run 리포트 저장 ────────────────────
  const reportDir = resolve(process.cwd(), "scripts/migration/reports");
  mkdirSync(reportDir, { recursive: true });
  const reportPath = resolve(reportDir, `dry-run-report-${Date.now()}.json`);
  writeFileSync(reportPath, JSON.stringify({
    generatedAt: new Date().toISOString(),
    folderId,
    recursive,
    totalFiles: files.length,
    alreadyMigratedCount,
    remainingCount: files.length - alreadyMigratedCount,
    byType,
    byStage,
    samples: mappings.slice(0, 30),
  }, null, 2), "utf-8");

  console.log(`\n💾 Dry-run 리포트 저장: ${reportPath}`);
  console.log("\n✅ Dry-run 완료 (실제 데이터 변경 없음)");
  console.log("   실제 마이그레이션: npx tsx scripts/migration/gdrive-migrate.ts");
}

main()
  .catch((err) => {
    console.error("Dry-run 오류:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
