/**
 * GET    /api/v1/projects/:id/drive/link/:linkId
 *   — Drive 링크 상세 + 파일 목록 (실시간 Drive 조회)
 *   Query: ?recursive=true
 *
 * DELETE /api/v1/projects/:id/drive/link/:linkId
 *   — Drive 폴더 연결 해제 (Watch 채널 포함)
 *
 * POST   /api/v1/projects/:id/drive/link/:linkId/watch
 *   — Google Drive Push Notification Watch 채널 등록
 */

import { fail, ok } from "@/lib/api-response";
import { requireProjectAccess } from "@/lib/api-auth";
import {
  listDriveFiles,
  unlinkDriveFolder,
  registerDriveWatch,
} from "@/services/drive-sync-service";
import { prismaDrive } from "@/lib/prisma-drive";

// ── GET ──────────────────────────────────
export async function GET(
  request: Request,
  { params }: { params: { id: string; linkId: string } },
) {
  const gate = await requireProjectAccess(params.id, "VIEWER");
  if (!gate.ok) return gate.response;

  const { searchParams } = new URL(request.url);
  const recursive = searchParams.get("recursive") === "true";

  try {
    // 링크가 이 프로젝트에 속하는지 확인
    const link = await prismaDrive.driveLink.findFirst({
      where: { id: params.linkId, projectId: params.id, isActive: true },
    });
    if (!link) return fail({ code: "NOT_FOUND", message: "Drive 링크를 찾을 수 없습니다." }, 404);

    const files = await listDriveFiles(params.linkId, recursive);
    return ok({ link, files });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Drive 파일 목록 조회 실패";
    return fail({ code: "INTERNAL_ERROR", message }, 500);
  }
}

// ── DELETE ───────────────────────────────
export async function DELETE(
  _request: Request,
  { params }: { params: { id: string; linkId: string } },
) {
  const gate = await requireProjectAccess(params.id, "MANAGER");
  if (!gate.ok) return gate.response;

  try {
    const link = await prismaDrive.driveLink.findFirst({
      where: { id: params.linkId, projectId: params.id },
    });
    if (!link) return fail({ code: "NOT_FOUND", message: "Drive 링크를 찾을 수 없습니다." }, 404);

    const updated = await unlinkDriveFolder(params.linkId);
    return ok({ id: params.linkId, unlinked: true, updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Drive 연결 해제 실패";
    return fail({ code: "INTERNAL_ERROR", message }, 500);
  }
}

// ── POST (Watch 등록) ─────────────────────
export async function POST(
  request: Request,
  { params }: { params: { id: string; linkId: string } },
) {
  const gate = await requireProjectAccess(params.id, "MANAGER");
  if (!gate.ok) return gate.response;

  try {
    const link = await prismaDrive.driveLink.findFirst({
      where: { id: params.linkId, projectId: params.id, isActive: true },
    });
    if (!link) return fail({ code: "NOT_FOUND", message: "Drive 링크를 찾을 수 없습니다." }, 404);

    const webhookBaseUrl =
      process.env.NEXTAUTH_URL ??
      process.env.NEXT_PUBLIC_APP_URL ??
      "http://localhost:3001";

    const result = await registerDriveWatch(params.linkId, webhookBaseUrl);
    return ok({
      channelId:  result.channelId,
      expiry:     result.expiry,
      webhookUrl: `${webhookBaseUrl}/api/v1/drive/webhook`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Watch 채널 등록 실패";
    return fail({ code: "INTERNAL_ERROR", message }, 500);
  }
}
