/**
 * GET  /api/v1/projects/:id/drive
 *   — 프로젝트에 연결된 Drive 폴더 목록 + 각 폴더의 파일 현황
 *
 * POST /api/v1/projects/:id/drive
 *   — 새 Drive 폴더 연결
 *   Body: { driveFolderId, folderName?, stageNumber?, recursive? }
 */

import { z } from "zod";
import { fail, ok } from "@/lib/api-response";
import { requireProjectAccess } from "@/lib/api-auth";
import {
  linkDriveFolder,
  listDriveLinks,
  listDriveFiles,
} from "@/services/drive-sync-service";

const linkSchema = z.object({
  driveFolderId: z.string().min(1, "Drive 폴더 ID가 필요합니다."),
  folderName:   z.string().optional(),
  stageNumber:  z.number().int().min(1).max(10).optional(),
  recursive:    z.boolean().optional().default(false),
});

// ── GET ──────────────────────────────────
export async function GET(
  request: Request,
  { params }: { params: { id: string } },
) {
  const gate = await requireProjectAccess(params.id, "VIEWER");
  if (!gate.ok) return gate.response;

  try {
    const links = await listDriveLinks(params.id);

    // 각 링크별 Drive 파일 수 + 미동기화 수 포함
    const enriched = await Promise.all(
      links.map(async (link) => {
        try {
          const files = await listDriveFiles(link.id, false);
          return {
            ...link,
            driveFileCount: files.length,
            unsyncedCount:  files.filter((f) => !f.synced).length,
          };
        } catch {
          return { ...link, driveFileCount: null, unsyncedCount: null };
        }
      }),
    );

    return ok(enriched);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Drive 목록 조회 실패";
    return fail({ code: "INTERNAL_ERROR", message }, 500);
  }
}

// ── POST ─────────────────────────────────
export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  const gate = await requireProjectAccess(params.id, "MANAGER");
  if (!gate.ok) return gate.response;

  try {
    const body = await request.json();
    const parsed = linkSchema.safeParse(body);
    if (!parsed.success) {
      return fail(
        { code: "VALIDATION_ERROR", message: "입력값을 확인해 주세요.", details: parsed.error.flatten() },
        400,
      );
    }

    const { driveFolderId, folderName, stageNumber } = parsed.data;

    const link = await linkDriveFolder({
      projectId:     params.id,
      driveFolderId,
      folderName,
      stageNumber,
      userId:        gate.session.user.id,
    });

    return ok(link, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Drive 폴더 연결 실패";
    return fail({ code: "INTERNAL_ERROR", message }, 500);
  }
}
