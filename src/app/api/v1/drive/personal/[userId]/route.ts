/**
 * GET  /api/v1/drive/personal/[userId]
 *   — 특정 사용자의 개인 Drive 폴더 루트 내용
 *   Query: folderId (하위 폴더 탐색 시)
 *          folderName (경로 표시용)
 *
 * GET  /api/v1/drive/personal/[userId]?folderId=xxx
 *   — 특정 하위 폴더 탐색
 *
 * PATCH /api/v1/drive/personal/[userId]
 *   — 사용자의 Drive 폴더 수동 연결 (관리자 전용)
 *   Body: { driveFolderId, driveFolderName }
 *
 * 권한:
 *   - 자기 자신: VIEWER 이상
 *   - 타인 조회: MANAGER 이상
 *   - 폴더 연결 변경: ADMIN만
 */

import { fail, ok } from "@/lib/api-response";
import { requireApiRole } from "@/lib/api-auth";
import { getUserById, updateUserDriveFolder } from "@/services/user-service";
import { browsePersonalFolder } from "@/services/drive-browse-service";
import { KNOWN_PERSONAL_FOLDERS } from "@/lib/drive-config";

// GET — 사용자 개인 Drive 폴더 탐색
export async function GET(
  request: Request,
  { params }: { params: { userId: string } },
) {
  // VIEWER 이상 인증 확인
  const auth = await requireApiRole("VIEWER");
  if (!auth.ok) return auth.response;

  const currentUserId = auth.session.user.id as string;
  const { userId } = params;
  const targetUserId = userId === "me" ? currentUserId : userId;
  const isSelf = currentUserId === targetUserId;

  // 타인 조회는 MANAGER 이상만 가능
  if (!isSelf && auth.role !== "ADMIN" && auth.role !== "MANAGER") {
    return fail({ code: "FORBIDDEN", message: "다른 사용자의 Drive 폴더를 조회할 권한이 없습니다." }, 403);
  }

  // 사용자 정보 조회 (Drive 폴더 필드 포함)
  const user = await getUserById(targetUserId);
  if (!user) return fail({ code: "NOT_FOUND", message: "사용자를 찾을 수 없습니다." }, 404);

  const u = user as typeof user & { driveFolderId?: string | null; driveFolderName?: string | null };
  // Drive 폴더 ID 결정 (DB 저장값 > 이름 자동 매핑 순)
  let folderId = u.driveFolderId;
  let folderName = u.driveFolderName ?? user.name;

  if (!folderId) {
    const knownId = KNOWN_PERSONAL_FOLDERS[user.name];
    if (knownId) {
      folderId = knownId;
      folderName = user.name;
    }
  }

  if (!folderId) {
    return ok({
      userId: user.id,
      userName: user.name,
      driveFolderId: null,
      message: "개인 Drive 폴더가 연결되지 않았습니다.",
      items: [],
      totalFolders: 0,
      totalFiles: 0,
    });
  }

  const { searchParams } = new URL(request.url);
  const subFolderId = searchParams.get("folderId");
  const subFolderName = searchParams.get("folderName") ?? undefined;

  try {
    const browseId = subFolderId ?? folderId;
    const browseName = subFolderName ?? folderName;
    const result = await browsePersonalFolder(browseId, browseName);

    return ok({
      userId: user.id,
      userName: user.name,
      rootFolderId: folderId,
      rootFolderName: folderName,
      ...result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Drive 탐색 실패";
    return fail({ code: "DRIVE_ERROR", message }, 500);
  }
}

// PATCH — 사용자 Drive 폴더 수동 연결 (관리자 전용)
export async function PATCH(
  request: Request,
  { params }: { params: { userId: string } },
) {
  const auth = await requireApiRole("ADMIN");
  if (!auth.ok) return auth.response;

  const { userId } = params;
  const body = await request.json().catch(() => null);
  if (!body) return fail({ code: "VALIDATION_ERROR", message: "요청 본문이 필요합니다." }, 400);

  const { driveFolderId, driveFolderName } = body as {
    driveFolderId?: string | null;
    driveFolderName?: string | null;
  };

  const updated = await updateUserDriveFolder(
    userId,
    driveFolderId ?? null,
    driveFolderName ?? null,
  );

  return ok({
    message: driveFolderId
      ? `${updated.name}의 Drive 폴더가 연결되었습니다.`
      : `${updated.name}의 Drive 폴더 연결이 해제되었습니다.`,
    user: {
      id: updated.id,
      name: updated.name,
      driveFolderId: (updated as any).driveFolderId,
      driveFolderName: (updated as any).driveFolderName,
    },
  });
}
