/**
 * Google Drive 폴더 탐색 서비스
 *
 * 공유 폴더: 플러스비전 공용 의 실제 폴더 구조를 실시간 탐색합니다.
 *
 * 지원 스코프:
 *  - PERSONAL      : 개인별 (직원별 폴더)
 *  - PROJECT       : 프로젝트 (고객사별 폴더)
 *  - COMPANY_INTRO : 회사 소개서
 *  - GOVERNMENT    : 국책 자료
 *  - OPERATIONS    : 회사 운영
 *  - SOP           : SOP
 *
 * 주요 함수:
 *  1. browseRootScopes     — 전체 스코프(최상위 폴더) 목록
 *  2. browseScopeRoot      — 특정 스코프의 루트 폴더 내용
 *  3. browsePersonalRoot   — 개인별 폴더 목록 (직원별)
 *  4. browsePersonalFolder — 특정 직원의 하위 폴더/파일
 *  5. browseProjectRoot    — 프로젝트 그룹 폴더 목록
 *  6. browseProjectFolder  — 특정 프로젝트 그룹의 하위 폴더/파일
 *  7. browseFolder         — 범용: 임의 폴더 ID로 하위 탐색
 *  8. getDriveFolderMeta   — 폴더 메타데이터 조회
 */

import {
  createGoogleDriveAdapter,
  type DriveFileDescriptor,
} from "@/scripts/migration/google-drive-adapter";
import {
  DRIVE_ROOT,
  DRIVE_ROOT_PERSONAL,
  DRIVE_ROOT_PROJECTS,
  SCOPE_ROOT_MAP,
  SCOPE_LABEL_MAP,
  getAllRootFolders,
  inferStageFromFolderName,
  type DriveFolderScope,
} from "@/lib/drive-config";

// ── 응답 타입 ──
export interface DriveBrowseItem {
  id: string;
  name: string;
  mimeType: string;
  size?: number;
  modifiedTime?: string;
  webViewLink?: string;
  isFolder: boolean;
  /** 폴더인 경우 추론된 PMS 단계 */
  inferredStage?: { stageNumber: number; documentType: string };
}

export interface DriveBrowseResult {
  scope: DriveFolderScope;
  folderId: string;
  folderName: string;
  parentPath: string;
  items: DriveBrowseItem[];
  totalFolders: number;
  totalFiles: number;
}

/** 최상위 스코프 목록 응답 */
export interface DriveRootScopesResult {
  rootFolderId: string;
  scopes: Array<{
    scope: DriveFolderScope;
    label: string;
    folderId: string;
  }>;
}

const FOLDER_MIME = "application/vnd.google-apps.folder";

function toItem(f: DriveFileDescriptor): DriveBrowseItem {
  const isFolder = f.mimeType === FOLDER_MIME;
  return {
    id: f.id,
    name: f.name,
    mimeType: f.mimeType,
    size: f.size,
    modifiedTime: f.modifiedTime,
    webViewLink: f.webViewLink,
    isFolder,
    ...(isFolder ? { inferredStage: inferStageFromFolderName(f.name) } : {}),
  };
}

function sortItems(items: DriveBrowseItem[]): DriveBrowseItem[] {
  return items.sort((a, b) => {
    if (a.isFolder !== b.isFolder) return a.isFolder ? -1 : 1;
    return a.name.localeCompare(b.name, "ko");
  });
}

function buildResult(
  scope: DriveFolderScope,
  folderId: string,
  folderName: string,
  parentPath: string,
  items: DriveBrowseItem[],
): DriveBrowseResult {
  return {
    scope,
    folderId,
    folderName,
    parentPath,
    items: sortItems(items),
    totalFolders: items.filter((i) => i.isFolder).length,
    totalFiles: items.filter((i) => !i.isFolder).length,
  };
}

// ──────────────────────────────────────────
// 1. 전체 스코프(최상위 폴더) 목록
// ──────────────────────────────────────────
export function browseRootScopes(): DriveRootScopesResult {
  return {
    rootFolderId: DRIVE_ROOT,
    scopes: getAllRootFolders(),
  };
}

// ──────────────────────────────────────────
// 2. 특정 스코프의 루트 폴더 내용 탐색
// ──────────────────────────────────────────
export async function browseScopeRoot(
  scope: DriveFolderScope,
): Promise<DriveBrowseResult> {
  const folderId = SCOPE_ROOT_MAP[scope];
  const label = SCOPE_LABEL_MAP[scope];
  const adapter = createGoogleDriveAdapter();
  const files = await adapter.listFiles(folderId);
  const items = files.map(toItem);

  return buildResult(
    scope,
    folderId,
    label,
    `플러스비전 공용 > ${label}`,
    items,
  );
}

// ──────────────────────────────────────────
// 3. 개인별 루트 — 직원 폴더 목록
// ──────────────────────────────────────────
export async function browsePersonalRoot(): Promise<DriveBrowseResult> {
  return browseScopeRoot("PERSONAL");
}

// ──────────────────────────────────────────
// 4. 특정 직원 하위 폴더/파일
// ──────────────────────────────────────────
export async function browsePersonalFolder(
  folderId: string,
  folderName?: string,
): Promise<DriveBrowseResult> {
  const adapter = createGoogleDriveAdapter();
  const files = await adapter.listFiles(folderId);
  const items = files.map(toItem);

  return buildResult(
    "PERSONAL",
    folderId,
    folderName ?? folderId,
    `플러스비전 공용 > 개인별 > ${folderName ?? ""}`,
    items,
  );
}

// ──────────────────────────────────────────
// 5. 프로젝트 루트 — 프로젝트 그룹 폴더 목록
// ──────────────────────────────────────────
export async function browseProjectRoot(): Promise<DriveBrowseResult> {
  return browseScopeRoot("PROJECT");
}

// ──────────────────────────────────────────
// 6. 특정 프로젝트 그룹 하위 폴더/파일
// ──────────────────────────────────────────
export async function browseProjectFolder(
  folderId: string,
  folderName?: string,
): Promise<DriveBrowseResult> {
  const adapter = createGoogleDriveAdapter();
  const files = await adapter.listFiles(folderId);
  const items = files.map(toItem);

  return buildResult(
    "PROJECT",
    folderId,
    folderName ?? folderId,
    `플러스비전 공용 > 프로젝트 > ${folderName ?? ""}`,
    items,
  );
}

// ──────────────────────────────────────────
// 7. 범용 폴더 탐색 (ID 기반)
// ──────────────────────────────────────────
export async function browseFolder(
  folderId: string,
  scope: DriveFolderScope = "PROJECT",
): Promise<DriveBrowseResult> {
  const adapter = createGoogleDriveAdapter();
  const files = await adapter.listFiles(folderId);
  const items = files.map(toItem);

  // 폴더명 가져오기
  const meta = await getDriveFolderMeta(folderId);

  return buildResult(
    scope,
    folderId,
    meta?.name ?? folderId,
    "",
    items,
  );
}

// ──────────────────────────────────────────
// 8. 폴더 메타데이터 조회
// ──────────────────────────────────────────
export async function getDriveFolderMeta(
  folderId: string,
): Promise<{ id: string; name: string; mimeType: string } | null> {
  try {
    const adapter = createGoogleDriveAdapter();
    const token = await adapter.getAccessToken();

    // API Key 방식인 경우 key= 파라미터 사용, OAuth 방식인 경우 Bearer 토큰
    const apiKey = process.env.GOOGLE_DRIVE_API_KEY;
    const url = apiKey
      ? `https://www.googleapis.com/drive/v3/files/${folderId}?fields=id,name,mimeType&supportsAllDrives=true&key=${apiKey}`
      : `https://www.googleapis.com/drive/v3/files/${folderId}?fields=id,name,mimeType&supportsAllDrives=true`;

    const headers: Record<string, string> = {};
    if (!apiKey) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const res = await fetch(url, { headers });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}
