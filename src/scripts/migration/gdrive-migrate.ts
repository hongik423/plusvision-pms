/**
 * Google Drive → Supabase Storage 마이그레이션 실행 스크립트
 *
 * 사용 방법:
 *   npx tsx scripts/migration/gdrive-migrate.ts
 *
 * 필수 환경 변수:
 *   GOOGLE_CLIENT_ID                   (Google OAuth 클라이언트 ID)
 *   GOOGLE_CLIENT_SECRET               (Google OAuth 클라이언트 시크릿)
 *   GOOGLE_DRIVE_REFRESH_TOKEN         (oauth-setup.ts로 발급)
 *   GOOGLE_DRIVE_SOURCE_FOLDER_ID      (이전할 Drive 폴더 ID)
 *   MIGRATION_TARGET_PROJECT_ID        (PlusPMS 프로젝트 ID)
 *   MIGRATION_DEFAULT_UPLOADER_ID      (문서 업로더로 등록할 사용자 ID)
 *
 * 선택 환경 변수:
 *   MIGRATION_LIMIT      (처리 파일 수 제한, 테스트용 - 기본: 0=전체)
 *   MIGRATION_RECURSIVE  (하위 폴더 포함 여부 - "true" 설정 시 활성화)
 *   MIGRATION_RESUME     (resume 파일 경로 - 기본: scripts/migration/resume.json)
 */

import { DocumentType } from "@prisma/client";
import { writeFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { prisma } from "@/lib/prisma";
import { getSupabaseAdmin } from "@/lib/supabase";
import { generatePlusPmsId } from "@/lib/id";
import {
  createGoogleDriveAdapter,
  getExportInfo,
  isGoogleNativeType,
  type DriveFileDescriptor,
} from "@/scripts/migration/google-drive-adapter";

// ─────────────────────────────────────────────
// 문서 분류 규칙
// ─────────────────────────────────────────────
function classifyDocument(fileName: string, relativePath?: string): {
  stageNumber: number;
  documentType: DocumentType;
} {
  const name = fileName.toLowerCase();
  const path = (relativePath ?? "").toLowerCase();

  // 경로 기반 단계 추론
  const stageFromPath = inferStageFromPath(path);

  if (name.includes("견적") || name.includes("estimate")) return { stageNumber: stageFromPath ?? 6, documentType: "ESTIMATE" };
  if (name.includes("제안") || name.includes("proposal")) return { stageNumber: stageFromPath ?? 6, documentType: "PROPOSAL" };
  if ((name.includes("제작") || name.includes("manufacture")) && name.includes("매뉴얼")) return { stageNumber: stageFromPath ?? 7, documentType: "MANUFACTURE_MANUAL" };
  if ((name.includes("설치") || name.includes("install")) && name.includes("매뉴얼")) return { stageNumber: stageFromPath ?? 8, documentType: "INSTALL_MANUAL" };
  if (name.includes("부품") || name.includes("파트") || name.includes("parts")) return { stageNumber: stageFromPath ?? 7, documentType: "PARTS_LIST" };
  if (/\.(jpg|jpeg|png|gif)$/i.test(name) || name.includes("현장") || name.includes("사진")) return { stageNumber: stageFromPath ?? 3, documentType: "SITE_PHOTO" };
  if (/\.(dwg|dxf)$/i.test(name) || name.includes("도면") || name.includes("drawing")) return { stageNumber: stageFromPath ?? 7, documentType: "DRAWING" };
  if (name.includes("회의록") || name.includes("meeting")) return { stageNumber: stageFromPath ?? 3, documentType: "MEETING_NOTE" };
  if (name.includes("반출") || name.includes("export_record")) return { stageNumber: stageFromPath ?? 3, documentType: "EXPORT_RECORD" };

  return { stageNumber: stageFromPath ?? 10, documentType: "OTHER" };
}

function inferStageFromPath(path: string): number | null {
  // "stage-3", "3단계", "step3" 등 경로에서 단계 번호 추출
  const match = path.match(/(?:stage[-_]?|단계[-_]?|step[-_]?)(\d+)/);
  if (match) {
    const n = Number(match[1]);
    if (n >= 1 && n <= 10) return n;
  }
  return null;
}

// ─────────────────────────────────────────────
// Resume 파일 관리
// ─────────────────────────────────────────────
type ResumeData = {
  targetProjectId: string;
  sourceFolderId: string;
  startedAt: string;
  processedFileIds: string[];
  failedFileIds: string[];
};

function loadResume(resumePath: string): ResumeData | null {
  if (!existsSync(resumePath)) return null;
  try {
    return JSON.parse(readFileSync(resumePath, "utf-8")) as ResumeData;
  } catch {
    return null;
  }
}

function saveResume(resumePath: string, data: ResumeData) {
  writeFileSync(resumePath, JSON.stringify(data, null, 2), "utf-8");
}

// ─────────────────────────────────────────────
// 리포트 저장
// ─────────────────────────────────────────────
type ReportEntry = {
  driveFileId: string;
  fileName: string;
  relativePath?: string;
  stageNumber: number;
  documentType: string;
  status: "success" | "skipped" | "failed";
  reason?: string;
  supabaseKey?: string;
};

function saveReport(reportPath: string, entries: ReportEntry[], stats: {
  total: number;
  success: number;
  skipped: number;
  failed: number;
  durationMs: number;
}) {
  const report = { generatedAt: new Date().toISOString(), stats, entries };
  writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf-8");
}

// ─────────────────────────────────────────────
// 메인
// ─────────────────────────────────────────────
async function main() {
  const sourceFolderId = process.env.GOOGLE_DRIVE_SOURCE_FOLDER_ID;
  const targetProjectId = process.env.MIGRATION_TARGET_PROJECT_ID;
  const uploaderId = process.env.MIGRATION_DEFAULT_UPLOADER_ID;
  const limit = Number(process.env.MIGRATION_LIMIT ?? "0");
  const recursive = process.env.MIGRATION_RECURSIVE === "true";
  const resumePath = resolve(
    process.cwd(),
    process.env.MIGRATION_RESUME ?? "scripts/migration/resume.json",
  );
  const reportDir = resolve(process.cwd(), "scripts/migration/reports");
  mkdirSync(reportDir, { recursive: true });
  const reportPath = resolve(reportDir, `migration-report-${Date.now()}.json`);

  // ── 필수 환경 변수 검증 ──────────────────────
  if (!sourceFolderId || !targetProjectId || !uploaderId) {
    console.error("❌ 필수 환경 변수 누락:");
    if (!sourceFolderId) console.error("   GOOGLE_DRIVE_SOURCE_FOLDER_ID");
    if (!targetProjectId) console.error("   MIGRATION_TARGET_PROJECT_ID");
    if (!uploaderId) console.error("   MIGRATION_DEFAULT_UPLOADER_ID");
    process.exit(1);
  }

  // ── 어댑터 생성 ──────────────────────────────
  const adapter = createGoogleDriveAdapter();
  try {
    const token = await adapter.getAccessToken();
    console.log(`✅ Google Drive 인증 성공 (token 앞 20자: ${token.slice(0, 20)}...)`);
  } catch (err) {
    console.error("❌ Google Drive 인증 실패:", err);
    console.error("   GOOGLE_DRIVE_REFRESH_TOKEN 또는 GOOGLE_DRIVE_ACCESS_TOKEN을 확인하세요.");
    process.exit(1);
  }

  // ── DB 단계 정보 로딩 ────────────────────────
  const stageRows = await prisma.projectStage.findMany({
    where: { projectId: targetProjectId },
    select: { id: true, stageNumber: true },
  });
  if (stageRows.length === 0) {
    console.error(`❌ 프로젝트(${targetProjectId})의 단계 정보를 찾을 수 없습니다.`);
    process.exit(1);
  }
  const stageIdByNumber = new Map(stageRows.map((r) => [r.stageNumber, r.id]));

  // ── 이미 이전된 파일 ID 로딩 (중복 방지) ──────
  const existingDocs = await prisma.stageDocument.findMany({
    where: {
      stageId: { in: stageRows.map((r) => r.id) },
      externalId: { not: null },
    },
    select: { externalId: true },
  });
  const alreadyMigrated = new Set(existingDocs.map((d) => d.externalId).filter(Boolean) as string[]);
  console.log(`ℹ️  이미 이전된 파일: ${alreadyMigrated.size}건 (skip 처리)`);

  // ── resume 파일 로딩 ──────────────────────────
  const resume = loadResume(resumePath);
  const processedIds = new Set(resume?.processedFileIds ?? []);
  const failedIds = new Set(resume?.failedFileIds ?? []);
  if (resume) {
    console.log(`ℹ️  Resume 파일 발견: 이전 처리 ${processedIds.size}건, 실패 ${failedIds.size}건`);
  }

  // ── 파일 목록 수집 ────────────────────────────
  console.log(`\n📂 Drive 폴더 파일 목록 조회 중... (재귀: ${recursive})`);
  let files: DriveFileDescriptor[];
  if (recursive) {
    files = await adapter.listFilesRecursive(sourceFolderId);
  } else {
    files = await adapter.listFiles(sourceFolderId);
  }

  // Google 폴더는 다운로드 대상이 아니므로 제외
  files = files.filter((f) => f.mimeType !== "application/vnd.google-apps.folder");

  const targets = limit > 0 ? files.slice(0, limit) : files;
  console.log(`📄 대상 파일: ${targets.length}건 (전체 ${files.length}건)`);

  // ── Supabase 클라이언트 ───────────────────────
  const supabase = getSupabaseAdmin();
  const BUCKET = "projects";

  // ── 이전 실행 ────────────────────────────────
  const startedAt = Date.now();
  const reportEntries: ReportEntry[] = [];
  let successCount = 0;
  let skippedCount = 0;
  let failCount = 0;

  for (const file of targets) {
    // 이미 이전된 파일 skip
    if (alreadyMigrated.has(file.id) || processedIds.has(file.id)) {
      skippedCount += 1;
      reportEntries.push({
        driveFileId: file.id,
        fileName: file.name,
        relativePath: file.relativePath,
        stageNumber: 0,
        documentType: "SKIPPED",
        status: "skipped",
        reason: "이미 이전됨",
      });
      continue;
    }

    const classified = classifyDocument(file.name, file.relativePath);
    const stageId = stageIdByNumber.get(classified.stageNumber);

    if (!stageId) {
      failCount += 1;
      failedIds.add(file.id);
      reportEntries.push({
        driveFileId: file.id,
        fileName: file.name,
        relativePath: file.relativePath,
        stageNumber: classified.stageNumber,
        documentType: classified.documentType,
        status: "failed",
        reason: `단계 ${classified.stageNumber} 정보 없음`,
      });
      console.error(`FAIL [단계없음]: ${file.name}`);
      continue;
    }

    try {
      // Google 네이티브 파일은 export
      const exportInfo = isGoogleNativeType(file.mimeType) ? getExportInfo(file.mimeType) : null;
      const buffer = await adapter.downloadFile(file.id, file.mimeType);

      // 저장 파일명: Google Docs는 확장자 추가
      const finalName = exportInfo ? `${file.name}${exportInfo.ext}` : file.name;
      const finalMimeType = exportInfo ? exportInfo.exportMimeType : file.mimeType;

      // Supabase Storage 업로드
      const key = `${targetProjectId}/stage-${classified.stageNumber}/${Date.now()}-${finalName}`;
      const { error: uploadError } = await supabase.storage.from(BUCKET).upload(key, buffer, {
        contentType: finalMimeType,
        upsert: false,
      });
      if (uploadError) throw new Error(uploadError.message);

      const publicUrl = supabase.storage.from(BUCKET).getPublicUrl(key).data.publicUrl;

      // DB 저장
      await prisma.stageDocument.create({
        data: {
          id: generatePlusPmsId("stage_document"),
          stageId,
          uploadedById: uploaderId,
          documentType: classified.documentType,
          fileName: finalName,
          fileUrl: publicUrl,
          fileSize: buffer.length,
          mimeType: finalMimeType,
          storageType: "SUPABASE",
          externalId: file.id,
          description: `Google Drive 마이그레이션${file.relativePath ? ` (${file.relativePath})` : ""}`,
        },
      });

      processedIds.add(file.id);
      alreadyMigrated.add(file.id);
      successCount += 1;
      reportEntries.push({
        driveFileId: file.id,
        fileName: finalName,
        relativePath: file.relativePath,
        stageNumber: classified.stageNumber,
        documentType: classified.documentType,
        status: "success",
        supabaseKey: key,
      });
      console.log(`OK  [${classified.stageNumber}단계/${classified.documentType}]: ${finalName}`);
    } catch (err) {
      failCount += 1;
      failedIds.add(file.id);
      const reason = err instanceof Error ? err.message : String(err);
      reportEntries.push({
        driveFileId: file.id,
        fileName: file.name,
        relativePath: file.relativePath,
        stageNumber: classified.stageNumber,
        documentType: classified.documentType,
        status: "failed",
        reason,
      });
      console.error(`FAIL: ${file.name} — ${reason}`);
    }

    // 10건마다 resume 파일 저장
    if ((successCount + failCount) % 10 === 0) {
      saveResume(resumePath, {
        targetProjectId,
        sourceFolderId,
        startedAt: new Date(startedAt).toISOString(),
        processedFileIds: Array.from(processedIds),
        failedFileIds: Array.from(failedIds),
      });
    }
  }

  // ── 최종 resume 저장 ─────────────────────────
  saveResume(resumePath, {
    targetProjectId,
    sourceFolderId,
    startedAt: new Date(startedAt).toISOString(),
    processedFileIds: Array.from(processedIds),
    failedFileIds: Array.from(failedIds),
  });

  // ── 리포트 저장 ───────────────────────────────
  const durationMs = Date.now() - startedAt;
  saveReport(reportPath, reportEntries, {
    total: targets.length,
    success: successCount,
    skipped: skippedCount,
    failed: failCount,
    durationMs,
  });

  // ── 결과 출력 ─────────────────────────────────
  console.log("\n" + "=".repeat(50));
  console.log(`✅ 마이그레이션 완료`);
  console.log(`   성공:  ${successCount}건`);
  console.log(`   Skip:  ${skippedCount}건`);
  console.log(`   실패:  ${failCount}건`);
  console.log(`   시간:  ${(durationMs / 1000).toFixed(1)}초`);
  console.log(`   리포트: ${reportPath}`);

  if (failCount > 0) {
    console.warn(`\n⚠️  실패 파일은 리포트를 확인하고 개별 재실행하거나 수동 처리하세요.`);
    process.exit(1);
  }
}

main()
  .catch((err) => {
    console.error("마이그레이션 오류:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
