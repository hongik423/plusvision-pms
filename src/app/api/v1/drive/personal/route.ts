/**
 * GET  /api/v1/drive/personal
 *   — Drive 개인 폴더가 연결된 전체 사용자 목록
 *   — 관리자/매니저: 전원 조회 가능
 *   — 일반 사용자: 자기 자신만 조회
 *
 * POST /api/v1/drive/personal/auto-link
 *   — 이름 기반 Drive 폴더 자동 연결 (관리자 전용)
 */

import { fail, ok } from "@/lib/api-response";
import { requireApiRole } from "@/lib/api-auth";
import {
  listUsersWithDriveFolder,
  autoLinkPersonalFolders,
} from "@/services/user-service";

// GET — 개인 폴더 연결 사용자 목록
export async function GET(request: Request) {
  const auth = await requireApiRole("VIEWER");
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action");

  // ?action=auto-link — 자동 연결 결과만 조회 (미연결 사용자 확인용)
  if (action === "preview") {
    const users = await listUsersWithDriveFolder();
    return ok({
      users,
      totalLinked: users.length,
    });
  }

  const users = await listUsersWithDriveFolder();
  return ok({ users });
}

// POST — 자동 폴더 연결 실행 (관리자 전용)
export async function POST(request: Request) {
  const auth = await requireApiRole("ADMIN");
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => ({}));
  const action = body?.action ?? "auto-link";

  if (action === "auto-link") {
    const result = await autoLinkPersonalFolders();
    return ok({
      message: `Drive 폴더 자동 연결 완료: ${result.linked}명 연결, ${result.skipped}명 건너뜀`,
      ...result,
    });
  }

  return fail({ code: "VALIDATION_ERROR", message: "알 수 없는 action입니다." }, 400);
}
