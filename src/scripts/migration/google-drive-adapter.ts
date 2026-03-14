// ============================================================
// Google Drive 어댑터
// - DisabledGoogleDriveAdapter  : 환경 변수 미설정 시 기본값
// - AccessTokenGoogleDriveAdapter : 단기 access_token 직접 사용
// - OAuth2GoogleDriveAdapter    : refresh_token 자동 갱신 (권장)
// ============================================================

export type DriveFileDescriptor = {
  id: string;
  name: string;
  mimeType: string;
  size?: number;
  modifiedTime?: string;
  webViewLink?: string;
  /** 폴더 내 경로 (재귀 탐색 시 설정) */
  relativePath?: string;
};

export interface GoogleDriveAdapter {
  listFiles(folderId: string): Promise<DriveFileDescriptor[]>;
  /** 하위 폴더 포함 재귀 탐색 */
  listFilesRecursive(folderId: string, basePath?: string): Promise<DriveFileDescriptor[]>;
  downloadFile(fileId: string, mimeType?: string): Promise<Buffer>;
  /** 현재 액세스 토큰 반환 (진단/검증용) */
  getAccessToken(): Promise<string>;
  /** Drive 파일명 변경 (OAuth2 필수 — API Key로는 불가) */
  renameFile(fileId: string, newName: string): Promise<{ id: string; name: string }>;
  /** Drive 폴더 생성 */
  createFolder(name: string, parentFolderId: string): Promise<{ id: string; name: string }>;
}

// ─────────────────────────────────────────────
// Google Docs/Sheets/Slides → export mimeType 매핑
// ─────────────────────────────────────────────
const GOOGLE_EXPORT_MAP: Record<string, { exportMimeType: string; ext: string }> = {
  "application/vnd.google-apps.document":     { exportMimeType: "application/pdf", ext: ".pdf" },
  "application/vnd.google-apps.spreadsheet":  { exportMimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", ext: ".xlsx" },
  "application/vnd.google-apps.presentation": { exportMimeType: "application/pdf", ext: ".pdf" },
  "application/vnd.google-apps.drawing":      { exportMimeType: "image/png", ext: ".png" },
};

export function isGoogleNativeType(mimeType: string): boolean {
  return mimeType in GOOGLE_EXPORT_MAP;
}

export function getExportInfo(mimeType: string) {
  return GOOGLE_EXPORT_MAP[mimeType];
}

/** Google 폴더 mimeType */
const FOLDER_MIME = "application/vnd.google-apps.folder";

// ─────────────────────────────────────────────
// DisabledGoogleDriveAdapter
// ─────────────────────────────────────────────
export class DisabledGoogleDriveAdapter implements GoogleDriveAdapter {
  async listFiles(_folderId: string): Promise<DriveFileDescriptor[]> {
    throw new Error("Google Drive 실연동 비활성화: 환경 변수를 설정하세요.");
  }
  async listFilesRecursive(_folderId: string): Promise<DriveFileDescriptor[]> {
    throw new Error("Google Drive 실연동 비활성화: 환경 변수를 설정하세요.");
  }
  async downloadFile(_fileId: string): Promise<Buffer> {
    throw new Error("Google Drive 실연동 비활성화: 환경 변수를 설정하세요.");
  }
  async getAccessToken(): Promise<string> {
    throw new Error("Google Drive 실연동 비활성화");
  }
  async renameFile(_fileId: string, _newName: string): Promise<{ id: string; name: string }> {
    throw new Error("Google Drive 실연동 비활성화: 파일명 변경 불가");
  }
  async createFolder(_name: string, _parentFolderId: string): Promise<{ id: string; name: string }> {
    throw new Error("Google Drive 실연동 비활성화: 폴더 생성 불가");
  }
}

// ─────────────────────────────────────────────
// ApiKeyGoogleDriveAdapter (공유 폴더 전용 — OAuth 불필요)
// ─────────────────────────────────────────────
export class ApiKeyGoogleDriveAdapter implements GoogleDriveAdapter {
  constructor(private readonly apiKey: string) {}

  /** API Key 방식은 access_token이 없음 — apiKey를 반환 */
  async getAccessToken(): Promise<string> {
    return this.apiKey;
  }

  async listFiles(folderId: string): Promise<DriveFileDescriptor[]> {
    return apiKeyListAll(this.apiKey, folderId);
  }

  async listFilesRecursive(folderId: string, basePath = ""): Promise<DriveFileDescriptor[]> {
    return apiKeyListRecursive(this.apiKey, folderId, basePath);
  }

  async downloadFile(fileId: string, mimeType?: string): Promise<Buffer> {
    if (mimeType && isGoogleNativeType(mimeType)) {
      const exportInfo = getExportInfo(mimeType);
      return apiKeyExport(this.apiKey, fileId, exportInfo.exportMimeType);
    }
    return apiKeyDownload(this.apiKey, fileId);
  }

  async renameFile(_fileId: string, _newName: string): Promise<{ id: string; name: string }> {
    throw new Error("API Key 방식은 읽기 전용입니다. 파일명 변경은 OAuth2 인증이 필요합니다.");
  }

  async createFolder(_name: string, _parentFolderId: string): Promise<{ id: string; name: string }> {
    throw new Error("API Key 방식은 읽기 전용입니다. 폴더 생성은 OAuth2 인증이 필요합니다.");
  }
}

// ─────────────────────────────────────────────
// API Key 방식 Drive API 유틸 (공유 폴더 전용)
// ─────────────────────────────────────────────
async function apiKeyListPage(
  apiKey: string,
  folderId: string,
  pageToken?: string,
): Promise<{ files: DriveFileDescriptor[]; nextPageToken?: string }> {
  const query = encodeURIComponent(`'${folderId}' in parents and trashed=false`);
  const fields = encodeURIComponent("nextPageToken,files(id,name,mimeType,size,modifiedTime,webViewLink)");
  // supportsAllDrives + includeItemsFromAllDrives: 공유 드라이브(Shared Drive/Team Drive) 파일 포함
  let url = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=${fields}&pageSize=1000&supportsAllDrives=true&includeItemsFromAllDrives=true&key=${apiKey}`;
  if (pageToken) url += `&pageToken=${encodeURIComponent(pageToken)}`;

  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Drive API Key files.list 실패 (${res.status}): ${body}`);
  }

  const payload = (await res.json()) as {
    nextPageToken?: string;
    files?: Array<{ id: string; name: string; mimeType: string; size?: string; modifiedTime?: string; webViewLink?: string }>;
  };

  return {
    files: (payload.files ?? []).map((f) => ({
      id: f.id,
      name: f.name,
      mimeType: f.mimeType,
      size: f.size ? Number(f.size) : undefined,
      modifiedTime: f.modifiedTime,
      webViewLink: f.webViewLink,
    })),
    nextPageToken: payload.nextPageToken,
  };
}

async function apiKeyListAll(apiKey: string, folderId: string): Promise<DriveFileDescriptor[]> {
  const all: DriveFileDescriptor[] = [];
  let pageToken: string | undefined;
  do {
    const { files, nextPageToken } = await apiKeyListPage(apiKey, folderId, pageToken);
    all.push(...files);
    pageToken = nextPageToken;
  } while (pageToken);
  return all;
}

async function apiKeyDownload(apiKey: string, fileId: string): Promise<Buffer> {
  // supportsAllDrives=true: 공유 드라이브 파일 다운로드 지원
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true&key=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Drive API Key 다운로드 실패 (${res.status}): ${body}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

async function apiKeyExport(apiKey: string, fileId: string, exportMimeType: string): Promise<Buffer> {
  // supportsAllDrives=true: 공유 드라이브 Google Docs/Sheets/Slides export 지원
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=${encodeURIComponent(exportMimeType)}&supportsAllDrives=true&key=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Drive API Key export 실패 (${res.status}): ${body}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

async function apiKeyListRecursive(
  apiKey: string,
  folderId: string,
  basePath: string,
  depth = 0,
): Promise<DriveFileDescriptor[]> {
  // 무한 재귀 방지 (최대 5단계)
  if (depth > 5) return [];

  let items: DriveFileDescriptor[];
  try {
    items = await apiKeyListAll(apiKey, folderId);
  } catch (err) {
    console.warn(`[DriveAdapter] 폴더 ${folderId} 탐색 실패 (depth=${depth}):`, err);
    return [];
  }

  const result: DriveFileDescriptor[] = [];

  for (const item of items) {
    if (item.mimeType === FOLDER_MIME) {
      const subPath = basePath ? `${basePath}/${item.name}` : item.name;
      const children = await apiKeyListRecursive(apiKey, item.id, subPath, depth + 1);
      result.push(...children);
    } else {
      result.push({ ...item, relativePath: basePath || undefined });
    }
  }

  return result;
}

// ─────────────────────────────────────────────
// OAuth 방식 Drive API 유틸 (Bearer 토큰)
// ─────────────────────────────────────────────
async function driveListPage(
  accessToken: string,
  folderId: string,
  pageToken?: string,
): Promise<{ files: DriveFileDescriptor[]; nextPageToken?: string }> {
  const query = encodeURIComponent(`'${folderId}' in parents and trashed=false`);
  const fields = encodeURIComponent("nextPageToken,files(id,name,mimeType,size,modifiedTime,webViewLink)");
  // supportsAllDrives + includeItemsFromAllDrives: 공유 드라이브(Shared Drive/Team Drive) 파일 포함
  let url = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=${fields}&pageSize=1000&supportsAllDrives=true&includeItemsFromAllDrives=true`;
  if (pageToken) url += `&pageToken=${encodeURIComponent(pageToken)}`;

  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Drive files.list 실패 (${res.status}): ${body}`);
  }

  const payload = (await res.json()) as {
    nextPageToken?: string;
    files?: Array<{ id: string; name: string; mimeType: string; size?: string; modifiedTime?: string; webViewLink?: string }>;
  };

  return {
    files: (payload.files ?? []).map((f) => ({
      id: f.id,
      name: f.name,
      mimeType: f.mimeType,
      size: f.size ? Number(f.size) : undefined,
      modifiedTime: f.modifiedTime,
      webViewLink: f.webViewLink,
    })),
    nextPageToken: payload.nextPageToken,
  };
}

async function driveListAll(accessToken: string, folderId: string): Promise<DriveFileDescriptor[]> {
  const all: DriveFileDescriptor[] = [];
  let pageToken: string | undefined;
  do {
    const { files, nextPageToken } = await driveListPage(accessToken, folderId, pageToken);
    all.push(...files);
    pageToken = nextPageToken;
  } while (pageToken);
  return all;
}

async function driveDownload(accessToken: string, fileId: string): Promise<Buffer> {
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Drive files.get 다운로드 실패 (${res.status}): ${body}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

async function driveExport(accessToken: string, fileId: string, exportMimeType: string): Promise<Buffer> {
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=${encodeURIComponent(exportMimeType)}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Drive files.export 실패 (${res.status}): ${body}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

// ─────────────────────────────────────────────
// OAuth 방식 파일명 변경 / 폴더 생성
// ─────────────────────────────────────────────
async function driveRenameFile(
  accessToken: string,
  fileId: string,
  newName: string,
): Promise<{ id: string; name: string }> {
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}?supportsAllDrives=true`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name: newName }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Drive files.update(rename) 실패 (${res.status}): ${body}`);
  }
  const data = (await res.json()) as { id: string; name: string };
  return { id: data.id, name: data.name };
}

async function driveCreateFolder(
  accessToken: string,
  name: string,
  parentFolderId: string,
): Promise<{ id: string; name: string }> {
  const url = "https://www.googleapis.com/drive/v3/files?supportsAllDrives=true";
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name,
      mimeType: FOLDER_MIME,
      parents: [parentFolderId],
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Drive files.create(folder) 실패 (${res.status}): ${body}`);
  }
  const data = (await res.json()) as { id: string; name: string };
  return { id: data.id, name: data.name };
}

// ─────────────────────────────────────────────
// AccessTokenGoogleDriveAdapter (단기 토큰)
// ─────────────────────────────────────────────
export class AccessTokenGoogleDriveAdapter implements GoogleDriveAdapter {
  constructor(private readonly accessToken: string) {}

  async getAccessToken() { return this.accessToken; }

  async listFiles(folderId: string): Promise<DriveFileDescriptor[]> {
    return driveListAll(this.accessToken, folderId);
  }

  async listFilesRecursive(folderId: string, basePath = ""): Promise<DriveFileDescriptor[]> {
    return listRecursive(this.accessToken, folderId, basePath);
  }

  async downloadFile(fileId: string, mimeType?: string): Promise<Buffer> {
    if (mimeType && isGoogleNativeType(mimeType)) {
      const exportInfo = getExportInfo(mimeType);
      return driveExport(this.accessToken, fileId, exportInfo.exportMimeType);
    }
    return driveDownload(this.accessToken, fileId);
  }

  async renameFile(fileId: string, newName: string): Promise<{ id: string; name: string }> {
    return driveRenameFile(this.accessToken, fileId, newName);
  }

  async createFolder(name: string, parentFolderId: string): Promise<{ id: string; name: string }> {
    return driveCreateFolder(this.accessToken, name, parentFolderId);
  }
}

// ─────────────────────────────────────────────
// OAuth2GoogleDriveAdapter (refresh_token 자동 갱신) ← 권장
// ─────────────────────────────────────────────
type TokenCache = { accessToken: string; expiresAt: number };

export class OAuth2GoogleDriveAdapter implements GoogleDriveAdapter {
  private cache: TokenCache | null = null;

  constructor(
    private readonly clientId: string,
    private readonly clientSecret: string,
    private readonly refreshToken: string,
  ) {}

  /**
   * 토큰 갱신 (최대 3회 재시도)
   * [수정] 재시도 로직 추가로 장시간 마이그레이션 안정성 향상
   */
  async getAccessToken(): Promise<string> {
    // 만료 2분 전에 갱신
    if (this.cache && this.cache.expiresAt - Date.now() > 120_000) {
      return this.cache.accessToken;
    }

    const MAX_RETRIES = 3;
    const RETRY_DELAY_MS = 2000;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const res = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: this.clientId,
            client_secret: this.clientSecret,
            refresh_token: this.refreshToken,
            grant_type: "refresh_token",
          }),
        });

        const data = (await res.json()) as {
          access_token?: string;
          expires_in?: number;
          error?: string;
        };

        if (!res.ok || !data.access_token) {
          const errorMsg = `OAuth2 토큰 갱신 실패 (시도 ${attempt}/${MAX_RETRIES}): ${data.error ?? res.status}`;
          if (attempt === MAX_RETRIES) {
            throw new Error(errorMsg);
          }
          console.warn(`[OAuth2] ${errorMsg} — ${RETRY_DELAY_MS}ms 후 재시도...`);
          await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * attempt));
          continue;
        }

        this.cache = {
          accessToken: data.access_token,
          expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
        };
        return this.cache.accessToken;
      } catch (error) {
        if (attempt === MAX_RETRIES) {
          throw error;
        }
        console.warn(`[OAuth2] 네트워크 오류 (시도 ${attempt}/${MAX_RETRIES}):`, error);
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * attempt));
      }
    }

    throw new Error("OAuth2 토큰 갱신 최대 재시도 횟수 초과");
  }

  async listFiles(folderId: string): Promise<DriveFileDescriptor[]> {
    return driveListAll(await this.getAccessToken(), folderId);
  }

  async listFilesRecursive(folderId: string, basePath = ""): Promise<DriveFileDescriptor[]> {
    return listRecursive(await this.getAccessToken(), folderId, basePath);
  }

  async downloadFile(fileId: string, mimeType?: string): Promise<Buffer> {
    const token = await this.getAccessToken();
    if (mimeType && isGoogleNativeType(mimeType)) {
      const exportInfo = getExportInfo(mimeType);
      return driveExport(token, fileId, exportInfo.exportMimeType);
    }
    return driveDownload(token, fileId);
  }

  async renameFile(fileId: string, newName: string): Promise<{ id: string; name: string }> {
    const token = await this.getAccessToken();
    return driveRenameFile(token, fileId, newName);
  }

  async createFolder(name: string, parentFolderId: string): Promise<{ id: string; name: string }> {
    const token = await this.getAccessToken();
    return driveCreateFolder(token, name, parentFolderId);
  }
}

// ─────────────────────────────────────────────
// 재귀 폴더 탐색
// ─────────────────────────────────────────────
async function listRecursive(
  accessToken: string,
  folderId: string,
  basePath: string,
  depth = 0,
): Promise<DriveFileDescriptor[]> {
  if (depth > 5) return [];

  let items: DriveFileDescriptor[];
  try {
    items = await driveListAll(accessToken, folderId);
  } catch (err) {
    console.warn(`[DriveAdapter] OAuth 폴더 ${folderId} 탐색 실패 (depth=${depth}):`, err);
    return [];
  }

  const result: DriveFileDescriptor[] = [];

  for (const item of items) {
    if (item.mimeType === FOLDER_MIME) {
      // 폴더: 재귀 탐색
      const subPath = basePath ? `${basePath}/${item.name}` : item.name;
      const children = await listRecursive(accessToken, item.id, subPath, depth + 1);
      result.push(...children);
    } else {
      result.push({ ...item, relativePath: basePath || undefined });
    }
  }

  return result;
}

// ─────────────────────────────────────────────
// 팩토리 함수 (환경 변수 기반 자동 선택)
// 우선순위: OAuth2 → API Key → AccessToken → Disabled
// OAuth2가 있으면 읽기+쓰기 모두 가능하므로 최우선 사용
// ─────────────────────────────────────────────
export function createGoogleDriveAdapter(): GoogleDriveAdapter {
  // 1순위: OAuth2 (파일명 변경/폴더 생성 등 쓰기 작업 포함 — 최우선)
  // GOOGLE_DRIVE_CLIENT_ID 는 Drive 전용 (로그인용 GOOGLE_CLIENT_ID와 구분)
  const clientId     = process.env.GOOGLE_DRIVE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_DRIVE_REFRESH_TOKEN;

  if (clientId && clientSecret && refreshToken) {
    return new OAuth2GoogleDriveAdapter(clientId, clientSecret, refreshToken);
  }

  // 2순위: API Key (읽기 전용 — 파일명 변경 불가)
  const apiKey = process.env.GOOGLE_DRIVE_API_KEY;
  if (apiKey) {
    return new ApiKeyGoogleDriveAdapter(apiKey);
  }

  // 3순위: 단기 토큰
  const accessToken = process.env.GOOGLE_DRIVE_ACCESS_TOKEN;
  if (accessToken) {
    return new AccessTokenGoogleDriveAdapter(accessToken);
  }

  return new DisabledGoogleDriveAdapter();
}
