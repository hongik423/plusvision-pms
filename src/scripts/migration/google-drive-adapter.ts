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
}

// ─────────────────────────────────────────────
// 공통 Drive API 유틸
// ─────────────────────────────────────────────
async function driveListPage(
  accessToken: string,
  folderId: string,
  pageToken?: string,
): Promise<{ files: DriveFileDescriptor[]; nextPageToken?: string }> {
  const query = encodeURIComponent(`'${folderId}' in parents and trashed=false`);
  const fields = encodeURIComponent("nextPageToken,files(id,name,mimeType,size)");
  let url = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=${fields}&pageSize=1000`;
  if (pageToken) url += `&pageToken=${encodeURIComponent(pageToken)}`;

  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Drive files.list 실패 (${res.status}): ${body}`);
  }

  const payload = (await res.json()) as {
    nextPageToken?: string;
    files?: Array<{ id: string; name: string; mimeType: string; size?: string }>;
  };

  return {
    files: (payload.files ?? []).map((f) => ({
      id: f.id,
      name: f.name,
      mimeType: f.mimeType,
      size: f.size ? Number(f.size) : undefined,
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

  async getAccessToken(): Promise<string> {
    // 만료 2분 전에 갱신
    if (this.cache && this.cache.expiresAt - Date.now() > 120_000) {
      return this.cache.accessToken;
    }

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
      throw new Error(`OAuth2 토큰 갱신 실패: ${data.error ?? res.status}`);
    }

    this.cache = {
      accessToken: data.access_token,
      expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
    };
    return this.cache.accessToken;
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
}

// ─────────────────────────────────────────────
// 재귀 폴더 탐색
// ─────────────────────────────────────────────
async function listRecursive(
  accessToken: string,
  folderId: string,
  basePath: string,
): Promise<DriveFileDescriptor[]> {
  const items = await driveListAll(accessToken, folderId);
  const result: DriveFileDescriptor[] = [];

  for (const item of items) {
    if (item.mimeType === FOLDER_MIME) {
      // 폴더: 재귀 탐색
      const subPath = basePath ? `${basePath}/${item.name}` : item.name;
      const children = await listRecursive(accessToken, item.id, subPath);
      result.push(...children);
    } else {
      result.push({ ...item, relativePath: basePath });
    }
  }

  return result;
}

// ─────────────────────────────────────────────
// 팩토리 함수 (환경 변수 기반 자동 선택)
// ─────────────────────────────────────────────
export function createGoogleDriveAdapter(): GoogleDriveAdapter {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_DRIVE_REFRESH_TOKEN;

  if (clientId && clientSecret && refreshToken) {
    return new OAuth2GoogleDriveAdapter(clientId, clientSecret, refreshToken);
  }

  // 단기 토큰 폴백
  const accessToken = process.env.GOOGLE_DRIVE_ACCESS_TOKEN;
  if (accessToken) {
    return new AccessTokenGoogleDriveAdapter(accessToken);
  }

  return new DisabledGoogleDriveAdapter();
}
