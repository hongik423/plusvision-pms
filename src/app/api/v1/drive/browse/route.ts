/**
 * GET  /api/v1/drive/browse
 *   — Google Drive 공유 폴더 탐색
 *
 * Query Parameters:
 *   scope      = "personal" | "project" | "company_intro" | "government" | "operations" | "sop" | "all"
 *                (기본: project)
 *   folderId   = 특정 폴더 ID (없으면 해당 스코프 루트)
 *   folderName = 폴더명 (경로 표시용, 선택)
 *
 * 예시:
 *   GET /api/v1/drive/browse?scope=all
 *     → 전체 스코프 목록 (최상위 메뉴)
 *
 *   GET /api/v1/drive/browse?scope=personal
 *     → 개인별 루트 (직원 폴더 목록)
 *
 *   GET /api/v1/drive/browse?scope=personal&folderId=1NyFdEfenaIzmVKKNDUa8e88Wqmp2QMJF&folderName=김남용
 *     → 김남용 하위 폴더/파일
 *
 *   GET /api/v1/drive/browse?scope=project
 *     → 프로젝트 루트 (삼성, 바이코 등)
 *
 *   GET /api/v1/drive/browse?scope=sop
 *     → SOP 폴더 내용
 */

import { fail, ok } from "@/lib/api-response";
import { requireApiRole } from "@/lib/api-auth";
import {
  browseRootScopes,
  browseScopeRoot,
  browsePersonalFolder,
  browseProjectFolder,
  browseFolder,
} from "@/services/drive-browse-service";
import type { DriveFolderScope } from "@/lib/drive-config";

const VALID_SCOPES: Record<string, DriveFolderScope> = {
  personal:      "PERSONAL",
  project:       "PROJECT",
  company_intro: "COMPANY_INTRO",
  government:    "GOVERNMENT",
  operations:    "OPERATIONS",
  sop:           "SOP",
};

export async function GET(request: Request) {
  const auth = await requireApiRole("VIEWER");
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const scopeParam = searchParams.get("scope") ?? "project";
  const folderId = searchParams.get("folderId");
  const folderName = searchParams.get("folderName") ?? undefined;

  try {
    // scope=all → 최상위 스코프 목록
    if (scopeParam === "all") {
      return ok(browseRootScopes());
    }

    const scope = VALID_SCOPES[scopeParam];
    if (!scope) {
      return fail(
        {
          code: "VALIDATION_ERROR",
          message: `scope는 다음 중 하나여야 합니다: all, ${Object.keys(VALID_SCOPES).join(", ")}`,
        },
        400,
      );
    }

    // 특정 폴더 ID가 있으면 하위 탐색
    if (folderId) {
      // personal/project는 기존 전용 함수 사용 (parentPath 표시를 위해)
      if (scope === "PERSONAL") {
        return ok(await browsePersonalFolder(folderId, folderName));
      }
      if (scope === "PROJECT") {
        return ok(await browseProjectFolder(folderId, folderName));
      }
      // 나머지 스코프는 범용 탐색
      return ok(await browseFolder(folderId, scope));
    }

    // 스코프 루트 탐색
    return ok(await browseScopeRoot(scope));

  } catch (error) {
    const message = error instanceof Error ? error.message : "Drive 폴더 탐색 실패";
    return fail({ code: "INTERNAL_ERROR", message }, 500);
  }
}
