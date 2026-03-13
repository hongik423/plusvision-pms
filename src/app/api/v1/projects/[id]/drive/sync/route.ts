/**
 * POST /api/v1/projects/:id/drive/sync
 *   — 프로젝트에 연결된 Drive 폴더를 수동으로 동기화
 *
 * Body (optional):
 *   {
 *     linkId?:      string   // 특정 링크만 동기화 (없으면 전체 링크 동기화)
 *     recursive?:   boolean  // 하위 폴더 포함 (default: false)
 *     forceResync?: boolean  // 기존 동기화 파일 재처리 (default: false)
 *   }
 *
 * GET /api/v1/projects/:id/drive/sync
 *   — 최근 동기화 로그 조회
 *   Query: ?status=SYNCED|SKIPPED|FAILED&limit=50
 */

import { z } from "zod";
import { fail, ok } from "@/lib/api-response";
import { requireProjectAccess } from "@/lib/api-auth";
import {
  syncDriveFolder,
  listSyncLogs,
  listDriveLinks,
} from "@/services/drive-sync-service";

const syncSchema = z.object({
  linkId:      z.string().optional(),
  recursive:   z.boolean().optional().default(false),
  forceResync: z.boolean().optional().default(false),
});

// ── POST — 동기화 실행 ────────────────────
export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  const gate = await requireProjectAccess(params.id, "MANAGER");
  if (!gate.ok) return gate.response;

  try {
    const body = await request.json().catch(() => ({}));
    const parsed = syncSchema.safeParse(body);
    if (!parsed.success) {
      return fail(
        { code: "VALIDATION_ERROR", message: "입력값을 확인해 주세요.", details: parsed.error.flatten() },
        400,
      );
    }

    const { linkId, recursive, forceResync } = parsed.data;
    const uploadedById = gate.session.user.id;

    // 특정 링크 또는 전체 링크 동기화
    let targetLinks: string[];
    if (linkId) {
      targetLinks = [linkId];
    } else {
      const allLinks = await listDriveLinks(params.id);
      targetLinks = allLinks.map((l) => l.id);
    }

    if (targetLinks.length === 0) {
      return fail({ code: "NO_DRIVE_LINK", message: "연결된 Drive 폴더가 없습니다." }, 422);
    }

    // 모든 링크 병렬 동기화
    const results = await Promise.all(
      targetLinks.map(async (id) => {
        try {
          const result = await syncDriveFolder(id, uploadedById, { recursive, forceResync });
          return { linkId: id, ...result };
        } catch (err) {
          return {
            linkId: id,
            success: 0,
            skipped: 0,
            failed: 0,
            error: err instanceof Error ? err.message : String(err),
            logs: [],
          };
        }
      }),
    );

    // 전체 통계 합산
    const totals = results.reduce(
      (acc, r) => ({
        success: acc.success + r.success,
        skipped: acc.skipped + r.skipped,
        failed:  acc.failed  + r.failed,
      }),
      { success: 0, skipped: 0, failed: 0 },
    );

    return ok({ ...totals, results }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "동기화 실패";
    return fail({ code: "INTERNAL_ERROR", message }, 500);
  }
}

// ── GET — 동기화 로그 조회 ────────────────
export async function GET(
  request: Request,
  { params }: { params: { id: string } },
) {
  const gate = await requireProjectAccess(params.id, "VIEWER");
  if (!gate.ok) return gate.response;

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") ?? undefined;
    const limit  = Math.min(Number(searchParams.get("limit") ?? "50"), 200);

    const logs = await listSyncLogs(params.id, { status, limit });
    return ok(logs);
  } catch (error) {
    const message = error instanceof Error ? error.message : "동기화 로그 조회 실패";
    return fail({ code: "INTERNAL_ERROR", message }, 500);
  }
}
