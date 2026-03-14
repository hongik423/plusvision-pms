/**
 * POST /api/v1/projects/:id/drive/rename
 *
 * 프로젝트의 Google Drive 파일을 넘버링 규칙에 따라 일괄 변환합니다.
 *
 * ── 넘버링 규칙 ──
 *  프로젝트: PV-{YYYY}-{NNN}
 *  문서:     {ProjectNumber}-S{SS}-{NNN}
 *  파일명:   [{DocNumber}] {원본파일명}
 *
 * Body (optional):
 *   { dryRun?: boolean }   ← true면 미리보기만 반환, 실제 변경 안 함
 *
 * Response:
 *   {
 *     projectNumber: string,
 *     dryRun: boolean,
 *     totalFiles: number,
 *     renamed: number,
 *     skipped: number,
 *     errors: number,
 *     results: RenameResult[]
 *   }
 */

import { fail, ok } from "@/lib/api-response";
import { requireProjectAccess } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { prismaDrive } from "@/lib/prisma-drive";
import {
  createGoogleDriveAdapter,
  type DriveFileDescriptor,
} from "@/scripts/migration/google-drive-adapter";
import { KNOWN_PROJECT_GROUPS } from "@/lib/drive-config";
import {
  buildDriveFileName,
  extractOriginalFileName,
} from "@/lib/naming-convention";

export const dynamic = "force-dynamic";

type RenameResult = {
  fileId: string;
  oldName: string;
  newName: string;
  stageNumber: number;
  docNumber: string;
  status: "renamed" | "skipped" | "error";
  reason?: string;
};

// ── 파일 분류 (stage-files 라우트와 동일 로직 재사용) ──
function inferStageNumber(file: DriveFileDescriptor): number {
  const name = file.name.toLowerCase();
  const path = (file.relativePath ?? "").toLowerCase();

  // 경로 기반 명시적 단계
  const stageMatch = path.match(/(?:stage[-_]?|단계[-_]?|step[-_]?)(\d+)/);
  if (stageMatch) {
    const n = Number(stageMatch[1]);
    if (n >= 1 && n <= 10) return n;
  }

  // 상위 폴더명
  if (file.relativePath) {
    const topFolder = file.relativePath.split("/")[0].toLowerCase();
    if (topFolder.includes("실적") || topFolder.includes("정산") || topFolder.includes("매출")) return 9;
    if (topFolder.includes("견적") || topFolder.includes("발주") || topFolder.includes("단가") || topFolder.includes("y2k")) return 6;
    if (topFolder.includes("제작") || topFolder.includes("보드") || topFolder.includes("선박") || topFolder.includes("dpf") || topFolder.includes("도면") || topFolder.includes("부품") || topFolder.includes("패널") || topFolder.includes("개발")) return 7;
    if (topFolder.includes("설치") || topFolder.includes("납품")) return 8;
    if (topFolder.includes("현장") || topFolder.includes("사진") || topFolder.includes("회의") || topFolder.includes("협의") || topFolder.includes("영광")) return 3;
    if (topFolder.includes("채권") || topFolder.includes("계약")) return 5;
    if (topFolder.includes("의뢰") || topFolder.includes("접수") || topFolder.includes("업무")) return 1;
  }

  // 파일명 기반
  if (name.includes("매출") || name.includes("매입") || name.includes("정산") || name.includes("단가") || name.includes("실적")) return 9;
  if (name.includes("견적") || name.includes("발주") || name.includes("주문") || name.includes("제안")) return 6;
  if (name.includes("회의록")) return 3;
  if (name.includes("현장") || name.includes("사진")) return 3;
  if (name.includes("설치") || name.includes("납품")) return 8;
  if (/\.(dwg|dxf)$/i.test(name) || name.includes("도면")) return 7;
  if (name.includes("배선") || name.includes("레이아웃") || name.includes("패널") || name.includes("보드") || name.includes("릴레이") || name.includes("lcd") || name.includes("차압") || name.includes("dpf") || name.includes("선박") || name.includes("모니터링") || name.includes("매연저감") || name.includes("부품")) return 7;
  if (/\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(name)) return 7;
  if (name.includes("채권") || name.includes("계약")) return 5;
  if (name.includes("업무") || name.includes("진행 내용") || name.includes("진행내용")) return 1;

  return 10;
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  // 권한 확인 (MANAGER 이상)
  const gate = await requireProjectAccess(params.id, "MANAGER");
  if (!gate.ok) return gate.response;

  let dryRun = true; // 기본값: 미리보기
  try {
    const body = await request.json().catch(() => ({}));
    if (typeof body.dryRun === "boolean") dryRun = body.dryRun;
  } catch {
    // body가 없으면 기본값 유지
  }

  try {
    // ── 1. 프로젝트 정보 조회 ──
    const project = await prisma.project.findUnique({
      where: { id: params.id },
      include: { customer: { select: { name: true } } },
    });
    if (!project) {
      return fail({ code: "NOT_FOUND", message: "프로젝트를 찾을 수 없습니다." }, 404);
    }

    const projectNumber = project.projectNumber;
    if (!projectNumber) {
      return fail({
        code: "BAD_REQUEST",
        message: "프로젝트 번호가 아직 할당되지 않았습니다. 프로젝트를 먼저 저장하세요.",
      }, 400);
    }

    // ── 2. Drive 폴더 ID 결정 ──
    let driveFolderId: string | null = null;
    let folderName = "";

    const links = await prismaDrive.driveLink.findMany({
      where: { projectId: params.id, isActive: true },
    });

    if (links.length > 0) {
      const projectLink = links.find((l) => !l.stageNumber) ?? links[0];
      driveFolderId = projectLink.driveFolderId;
      folderName = projectLink.folderName ?? "Drive 폴더";
    }

    if (!driveFolderId) {
      const searchNames = [
        project.customer?.name,
        project.name,
      ].filter(Boolean) as string[];

      for (const searchName of searchNames) {
        if (driveFolderId) break;
        const exactMatch = KNOWN_PROJECT_GROUPS[searchName];
        if (exactMatch) {
          driveFolderId = exactMatch;
          folderName = searchName;
          break;
        }
        for (const [groupName, groupId] of Object.entries(KNOWN_PROJECT_GROUPS)) {
          if (
            searchName.includes(groupName) ||
            groupName.includes(searchName) ||
            searchName.toLowerCase().includes(groupName.toLowerCase())
          ) {
            driveFolderId = groupId;
            folderName = groupName;
            break;
          }
        }
      }
    }

    if (!driveFolderId) {
      return fail({
        code: "NOT_FOUND",
        message: "이 프로젝트에 연결된 Google Drive 폴더가 없습니다.",
      }, 404);
    }

    // ── 3. Drive 파일 재귀 탐색 ──
    const adapter = createGoogleDriveAdapter();
    const allFiles = await adapter.listFilesRecursive(driveFolderId, "");
    const files = allFiles.filter(
      (f) => f.mimeType !== "application/vnd.google-apps.folder",
    );

    // ── 4. 단계별 그룹화 & 넘버링 ──
    const byStage = new Map<number, DriveFileDescriptor[]>();
    for (const file of files) {
      const stageNumber = inferStageNumber(file);
      const group = byStage.get(stageNumber) ?? [];
      group.push(file);
      byStage.set(stageNumber, group);
    }

    const results: RenameResult[] = [];
    let renamed = 0;
    let skipped = 0;
    let errors = 0;

    for (const [stageNumber, stageFiles] of byStage.entries()) {
      const stagePrefix = `S${String(stageNumber).padStart(2, "0")}`;
      let docIndex = 1;

      for (const file of stageFiles) {
        const originalName = extractOriginalFileName(file.name);
        const docNumber = `${projectNumber}-${stagePrefix}-${String(docIndex).padStart(3, "0")}`;
        const newName = buildDriveFileName(docNumber, originalName);
        docIndex++;

        // 이미 같은 이름이면 스킵
        if (file.name === newName) {
          results.push({
            fileId: file.id,
            oldName: file.name,
            newName,
            stageNumber,
            docNumber,
            status: "skipped",
            reason: "이미 넘버링 적용됨",
          });
          skipped++;
          continue;
        }

        if (dryRun) {
          // 미리보기 모드: 실제 변경 안 함
          results.push({
            fileId: file.id,
            oldName: file.name,
            newName,
            stageNumber,
            docNumber,
            status: "renamed",
            reason: "미리보기 (dryRun=true)",
          });
          renamed++;
        } else {
          // 실제 rename 실행
          try {
            await adapter.renameFile(file.id, newName);
            results.push({
              fileId: file.id,
              oldName: file.name,
              newName,
              stageNumber,
              docNumber,
              status: "renamed",
            });
            renamed++;
          } catch (err) {
            const errMsg = err instanceof Error ? err.message : String(err);
            results.push({
              fileId: file.id,
              oldName: file.name,
              newName,
              stageNumber,
              docNumber,
              status: "error",
              reason: errMsg,
            });
            errors++;
          }
        }
      }
    }

    // 결과를 단계순 → 문서순으로 정렬
    results.sort((a, b) =>
      a.stageNumber !== b.stageNumber
        ? a.stageNumber - b.stageNumber
        : a.docNumber.localeCompare(b.docNumber),
    );

    return ok({
      projectNumber,
      folderName,
      driveFolderId,
      dryRun,
      totalFiles: files.length,
      renamed,
      skipped,
      errors,
      results,
    });
  } catch (error) {
    console.error("[DriveRename] 오류:", error);
    const message = error instanceof Error ? error.message : "Drive 파일명 변경 실패";
    return fail({ code: "INTERNAL_ERROR", message }, 500);
  }
}
