/**
 * Google Drive 실시간 동기화 서비스
 *
 * 기능:
 *  1. linkDriveFolder    — 프로젝트(또는 단계)에 Drive 폴더 연결
 *  2. unlinkDriveFolder  — Drive 폴더 연결 해제
 *  3. listDriveLinks     — 프로젝트에 연결된 Drive 폴더 목록
 *  4. listDriveFiles     — Drive 폴더의 최신 파일 목록 (실시간)
 *  5. syncDriveFolder    — Drive → Supabase Storage + DB 동기화
 *  6. registerDriveWatch — Google Drive Push Notification 채널 등록
 *  7. renewExpiredWatches — 만료된 Watch 채널 자동 갱신
 *  8. handleWebhookSync  — Webhook 수신 후 자동 동기화 트리거
 *  9. listSyncLogs       — 동기화 로그 조회
 */

import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { prismaDrive, type ProjectDriveLink } from "@/lib/prisma-drive";
import { getSupabaseAdmin } from "@/lib/supabase";
import { generatePlusPmsId } from "@/lib/id";
import {
  createGoogleDriveAdapter,
  isGoogleNativeType,
  getExportInfo,
  type DriveFileDescriptor,
} from "@/scripts/migration/google-drive-adapter";
import { KNOWN_PROJECT_GROUPS, DRIVE_ROOT_PROJECTS } from "@/lib/drive-config";
import type { DocumentType } from "@prisma/client";
import { createNotification } from "@/services/notification-service";

const BUCKET = "projects";

// ──────────────────────────────────────────
// 프로젝트 → Drive 폴더 자동 매핑 (고객명/프로젝트명 → KNOWN_PROJECT_GROUPS)
// ──────────────────────────────────────────
export async function discoverDriveFolderByProject(projectId: string): Promise<{
  driveFolderId: string;
  folderName: string;
} | null> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { customer: { select: { name: true } } },
  });
  if (!project) return null;

  const searchNames = [project.customer?.name, project.name].filter(Boolean) as string[];

  for (const searchName of searchNames) {
    const exactMatch = KNOWN_PROJECT_GROUPS[searchName];
    if (exactMatch) return { driveFolderId: exactMatch, folderName: searchName };

    for (const [groupName, groupId] of Object.entries(KNOWN_PROJECT_GROUPS)) {
      if (
        searchName.includes(groupName) ||
        groupName.includes(searchName) ||
        searchName.toLowerCase().includes(groupName.toLowerCase())
      ) {
        return { driveFolderId: groupId, folderName: groupName };
      }
    }
  }

  // KNOWN_PROJECT_GROUPS 매핑 실패 시 Drive 프로젝트 루트에서 폴더 동적 탐색
  if (searchNames.length === 0) return null;
  try {
    const adapter = createGoogleDriveAdapter();
    const items = await adapter.listFiles(DRIVE_ROOT_PROJECTS);
    const folders = items.filter((f) => f.mimeType === "application/vnd.google-apps.folder");

    const matches = (folderName: string): boolean =>
      searchNames.some((s) => {
        const a = s.toLowerCase().trim();
        const b = folderName.toLowerCase().trim();
        return a && b && (a.includes(b) || b.includes(a));
      });

    for (const folder of folders) {
      if (matches(folder.name)) return { driveFolderId: folder.id, folderName: folder.name };
    }
    // "거래 업체", "사람별 프로젝트" 하위 폴더도 검색
    for (const folder of folders) {
      if (folder.name === "거래 업체" || folder.name === "사람별 프로젝트") {
        const subItems = await adapter.listFiles(folder.id);
        const subFolders = subItems.filter((f) => f.mimeType === "application/vnd.google-apps.folder");
        for (const sub of subFolders) {
          if (matches(sub.name)) return { driveFolderId: sub.id, folderName: sub.name };
        }
      }
    }
  } catch {
    // Drive 미연동 또는 API 오류 시 null 반환 (수동 연결 필요)
  }
  return null;
}

// ──────────────────────────────────────────
// 파일명/경로 기반 문서 유형·단계 자동 분류
// ──────────────────────────────────────────
function classifyFile(
  fileName: string,
  relativePath?: string,
  linkedStageNumber?: number | null,
): { stageNumber: number; documentType: DocumentType } {
  const name = fileName.toLowerCase();
  const path = (relativePath ?? "").toLowerCase();

  const stageFromPath = (() => {
    const m = path.match(/(?:stage[-_]?|단계[-_]?|step[-_]?)(\d+)/);
    if (m) { const n = Number(m[1]); if (n >= 1 && n <= 10) return n; }
    return null;
  })();

  const fallback = (linked: number | null | undefined, stage: number) =>
    stageFromPath ?? linkedStageNumber ?? stage;

  if (name.includes("견적") || name.includes("estimate"))   return { stageNumber: fallback(linkedStageNumber, 6), documentType: "ESTIMATE" };
  if (name.includes("제안") || name.includes("proposal"))   return { stageNumber: fallback(linkedStageNumber, 6), documentType: "PROPOSAL" };
  if ((name.includes("제작") || name.includes("manufacture")) && name.includes("매뉴얼")) return { stageNumber: fallback(linkedStageNumber, 7), documentType: "MANUFACTURE_MANUAL" };
  if ((name.includes("설치") || name.includes("install")) && name.includes("매뉴얼"))    return { stageNumber: fallback(linkedStageNumber, 8), documentType: "INSTALL_MANUAL" };
  if (name.includes("부품") || name.includes("파트") || name.includes("parts"))          return { stageNumber: fallback(linkedStageNumber, 7), documentType: "PARTS_LIST" };
  if (/\.(jpg|jpeg|png|gif)$/i.test(name) || name.includes("현장") || name.includes("사진")) return { stageNumber: fallback(linkedStageNumber, 3), documentType: "SITE_PHOTO" };
  if (/\.(dwg|dxf)$/i.test(name) || name.includes("도면") || name.includes("drawing"))  return { stageNumber: fallback(linkedStageNumber, 7), documentType: "DRAWING" };
  if (name.includes("회의록") || name.includes("meeting"))  return { stageNumber: fallback(linkedStageNumber, 3), documentType: "MEETING_NOTE" };
  if (name.includes("반출") || name.includes("export_record")) return { stageNumber: fallback(linkedStageNumber, 3), documentType: "EXPORT_RECORD" };

  return { stageNumber: linkedStageNumber ?? stageFromPath ?? 10, documentType: "OTHER" };
}

// ──────────────────────────────────────────
// 1. Drive 폴더 연결
// ──────────────────────────────────────────
export async function linkDriveFolder(params: {
  projectId: string;
  driveFolderId: string;
  folderName?: string;
  stageNumber?: number;
  userId: string;
}): Promise<ProjectDriveLink> {
  const existing = await prismaDrive.driveLink.findUnique({
    where: {
      projectId_driveFolderId: {
        projectId:     params.projectId,
        driveFolderId: params.driveFolderId,
      },
    },
  });

  if (existing) {
    if (!existing.isActive) {
      return prismaDrive.driveLink.update({
        where: { id: existing.id },
        data: { isActive: true, folderName: params.folderName ?? existing.folderName },
      });
    }
    return existing;
  }

  return prismaDrive.driveLink.create({
    data: {
      id:            generatePlusPmsId("drive_link"),
      projectId:     params.projectId,
      driveFolderId: params.driveFolderId,
      folderName:    params.folderName ?? null,
      stageNumber:   params.stageNumber ?? null,
      createdById:   params.userId,
    },
  });
}

// ──────────────────────────────────────────
// 2. Drive 폴더 연결 해제
// ──────────────────────────────────────────
export async function unlinkDriveFolder(linkId: string): Promise<ProjectDriveLink | null> {
  const link = await prismaDrive.driveLink.findUnique({ where: { id: linkId } });
  if (!link) return null;

  if (link.channelId && link.channelToken) {
    await stopDriveWatch(link.channelId, link.channelToken).catch(() => {/* 무시 */});
  }

  return prismaDrive.driveLink.update({
    where: { id: linkId },
    data: { isActive: false, channelId: null, channelToken: null, channelExpiry: null },
  });
}

// ──────────────────────────────────────────
// 3. 프로젝트에 연결된 Drive 링크 목록
// ──────────────────────────────────────────
export async function listDriveLinks(projectId: string): Promise<ProjectDriveLink[]> {
  return prismaDrive.driveLink.findMany({
    where: { projectId, isActive: true },
    orderBy: { createdAt: "asc" },
  });
}

// ──────────────────────────────────────────
// 3-b. 매핑 기반 자동 동기화 (폴더 연결 없이 KNOWN_PROJECT_GROUPS로 자동 탐지)
// ──────────────────────────────────────────
export async function syncDriveByProjectMapping(
  projectId: string,
  uploadedById: string,
  options: { recursive?: boolean; stageNumber?: number } = {},
): Promise<SyncResult> {
  const discovered = await discoverDriveFolderByProject(projectId);
  if (!discovered) {
    throw new Error("고객명/프로젝트명에 해당하는 Drive 폴더 매핑이 없습니다.");
  }
  const link = await linkDriveFolder({
    projectId:     projectId,
    driveFolderId: discovered.driveFolderId,
    folderName:    discovered.folderName,
    userId:        uploadedById,
  });
  return syncDriveFolder(link.id, uploadedById, {
    recursive:   options.recursive ?? true,
    stageNumber: options.stageNumber,
  });
}

// ──────────────────────────────────────────
// 4. Drive 폴더의 실시간 파일 목록 조회
// ──────────────────────────────────────────
export type DriveFileSyncStatus = DriveFileDescriptor & {
  classified: { stageNumber: number; documentType: string };
  synced: boolean;
  documentId: string | null;
  lastSyncedAt: Date | null;
};

export async function listDriveFiles(
  linkId: string,
  recursive = false,
): Promise<DriveFileSyncStatus[]> {
  const link = await prismaDrive.driveLink.findUnique({ where: { id: linkId } });
  if (!link || !link.isActive) throw new Error("연결된 Drive 폴더를 찾을 수 없습니다.");

  const adapter = createGoogleDriveAdapter();
  const rawFiles = recursive
    ? await adapter.listFilesRecursive(link.driveFolderId)
    : await adapter.listFiles(link.driveFolderId);

  const files = rawFiles.filter((f) => f.mimeType !== "application/vnd.google-apps.folder");

  const driveFileIds = files.map((f) => f.id);
  const syncedLogs = await prismaDrive.syncLog.findMany({
    where: { driveLinkId: linkId, driveFileId: { in: driveFileIds }, status: "SYNCED" },
    orderBy: { syncedAt: "desc" },
  });
  const syncedMap = new Map(syncedLogs.map((l) => [l.driveFileId, l]));

  return files.map((file) => {
    const classified = classifyFile(file.name, file.relativePath, link.stageNumber);
    const syncLog = syncedMap.get(file.id);
    return {
      ...file,
      classified,
      synced:       !!syncLog,
      documentId:   syncLog?.documentId ?? null,
      lastSyncedAt: syncLog?.syncedAt ?? null,
    };
  });
}

// ──────────────────────────────────────────
// 5. Drive → Supabase 동기화 (신규 파일만)
// ──────────────────────────────────────────
export type SyncResult = {
  success: number;
  skipped: number;
  failed:  number;
  logs: Array<{
    fileName:   string;
    status:     "SYNCED" | "SKIPPED" | "FAILED";
    reason?:    string;
    documentId?: string;
  }>;
};

export async function syncDriveFolder(
  linkId: string,
  uploadedById: string,
  options: { recursive?: boolean; forceResync?: boolean; stageNumber?: number } = {},
): Promise<SyncResult> {
  const link = await prismaDrive.driveLink.findUnique({ where: { id: linkId } });
  if (!link || !link.isActive) throw new Error("연결된 Drive 폴더를 찾을 수 없습니다.");

  const adapter = createGoogleDriveAdapter();
  const supabase = getSupabaseAdmin();

  const rawFiles = options.recursive
    ? await adapter.listFilesRecursive(link.driveFolderId)
    : await adapter.listFiles(link.driveFolderId);
  const files = rawFiles.filter((f) => f.mimeType !== "application/vnd.google-apps.folder");

  // 이미 동기화된 파일 ID 집합
  const alreadySynced = options.forceResync
    ? new Set<string>()
    : new Set(
        (await prismaDrive.syncLog.findMany({
          where: { driveLinkId: linkId, status: "SYNCED" },
          select: { driveFileId: true },
        })).map((l) => l.driveFileId),
      );

  // 프로젝트 단계 ID 맵
  const stageRows = await prisma.projectStage.findMany({
    where: { projectId: link.projectId },
    select: { id: true, stageNumber: true },
  });
  const stageIdByNumber = new Map(stageRows.map((s) => [s.stageNumber, s.id]));

  const result: SyncResult = { success: 0, skipped: 0, failed: 0, logs: [] };

  const filterStage = options.stageNumber;

  for (const file of files) {
    const classified = classifyFile(file.name, file.relativePath, link.stageNumber);

    // 단계 필터: 해당 단계에 매핑된 파일만 처리
    if (filterStage != null && classified.stageNumber !== filterStage) {
      continue;
    }

    if (alreadySynced.has(file.id)) {
      result.skipped++;
      result.logs.push({ fileName: file.name, status: "SKIPPED", reason: "이미 동기화됨" });
      continue;
    }

    const stageId = stageIdByNumber.get(classified.stageNumber);

    if (!stageId) {
      result.failed++;
      const reason = `단계 ${classified.stageNumber} 정보 없음`;
      result.logs.push({ fileName: file.name, status: "FAILED", reason });
      await prismaDrive.syncLog.create({
        data: {
          id: generatePlusPmsId("drive_sync"),
          driveLinkId:  linkId,
          projectId:    link.projectId,
          driveFileId:  file.id,
          fileName:     file.name,
          stageNumber:  classified.stageNumber,
          documentType: classified.documentType,
          status:       "FAILED",
          reason,
        },
      });
      continue;
    }

    try {
      const exportInfo = isGoogleNativeType(file.mimeType) ? getExportInfo(file.mimeType) : null;
      const buffer = await adapter.downloadFile(file.id, file.mimeType);
      const finalName     = exportInfo ? `${file.name}${exportInfo.ext}` : file.name;
      const finalMimeType = exportInfo ? exportInfo.exportMimeType : file.mimeType;

      // Supabase Storage 업로드
      const key = `${link.projectId}/stage-${classified.stageNumber}/${Date.now()}-${finalName}`;
      const { error: uploadErr } = await supabase.storage.from(BUCKET).upload(key, buffer, {
        contentType: finalMimeType,
        upsert:      false,
      });
      if (uploadErr) throw new Error(uploadErr.message);

      const fileUrl = supabase.storage.from(BUCKET).getPublicUrl(key).data.publicUrl;

      // DB 저장
      const doc = await prisma.stageDocument.create({
        data: {
          id:           generatePlusPmsId("stage_document"),
          stageId,
          uploadedById,
          documentType: classified.documentType as DocumentType,
          fileName:     finalName,
          fileUrl,
          fileSize:     buffer.length,
          mimeType:     finalMimeType,
          storageType:  "GOOGLE_DRIVE",
          externalId:   file.id,
          description:  `Drive 동기화${file.relativePath ? ` (${file.relativePath})` : ""}`,
        },
      });

      await prismaDrive.syncLog.create({
        data: {
          id:           generatePlusPmsId("drive_sync"),
          driveLinkId:  linkId,
          projectId:    link.projectId,
          driveFileId:  file.id,
          fileName:     finalName,
          stageNumber:  classified.stageNumber,
          documentType: classified.documentType,
          status:       "SYNCED",
          documentId:   doc.id,
        },
      });

      result.success++;
      result.logs.push({ fileName: finalName, status: "SYNCED", documentId: doc.id });
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      result.failed++;
      result.logs.push({ fileName: file.name, status: "FAILED", reason });
      await prismaDrive.syncLog.create({
        data: {
          id:           generatePlusPmsId("drive_sync"),
          driveLinkId:  linkId,
          projectId:    link.projectId,
          driveFileId:  file.id,
          fileName:     file.name,
          stageNumber:  classified.stageNumber,
          documentType: classified.documentType,
          status:       "FAILED",
          reason,
        },
      });
    }
  }

  // lastSyncAt 갱신
  await prismaDrive.driveLink.update({
    where: { id: linkId },
    data:  { lastSyncAt: new Date() },
  });

  // ── 동기화 실패 알림 ──────────────────────────────────
  if (result.failed > 0) {
    try {
      const failedNames = result.logs
        .filter((l) => l.status === "FAILED")
        .map((l) => l.fileName)
        .slice(0, 5);
      const preview = failedNames.join(", ") + (result.failed > 5 ? ` 외 ${result.failed - 5}건` : "");

      // 프로젝트 매니저와 링크 생성자에게 알림 전송
      const project = await prisma.project.findUnique({
        where: { id: link.projectId },
        select: { id: true, name: true, createdById: true },
      });

      const notifyUserIds = new Set<string>();
      notifyUserIds.add(uploadedById);
      if (project?.createdById) notifyUserIds.add(project.createdById);

      for (const uid of notifyUserIds) {
        await createNotification({
          userId:    uid,
          projectId: link.projectId,
          type:      "DRIVE_SYNC_FAILED",
          title:     `Drive 동기화 실패 (${result.failed}건)`,
          message:   `프로젝트 "${project?.name ?? link.projectId}" — ${preview}`,
          link:      `/projects/${link.projectId}/documents`,
        });
      }
    } catch (notifyErr) {
      console.error("[DriveSyncNotify] 알림 생성 실패:", notifyErr);
    }
  }

  return result;
}

// ──────────────────────────────────────────
// 6. Google Drive Watch 채널 등록 (Webhook)
// ──────────────────────────────────────────
const WATCH_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7일

export async function registerDriveWatch(
  linkId: string,
  webhookBaseUrl: string,
): Promise<{ channelId: string; expiry: Date }> {
  const link = await prismaDrive.driveLink.findUnique({ where: { id: linkId } });
  if (!link || !link.isActive) throw new Error("연결된 Drive 폴더를 찾을 수 없습니다.");

  const adapter      = createGoogleDriveAdapter();
  const accessToken  = await adapter.getAccessToken();
  const channelId    = crypto.randomUUID();
  const channelToken = crypto.randomBytes(32).toString("hex");
  const expiry       = Date.now() + WATCH_TTL_MS;
  const webhookUrl   = `${webhookBaseUrl}/api/v1/drive/webhook`;

  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${link.driveFolderId}/watch`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        id:         channelId,
        token:      channelToken,
        type:       "web_hook",
        address:    webhookUrl,
        expiration: expiry.toString(),
        payload:    true,
      }),
    },
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Drive Watch 등록 실패 (${res.status}): ${body}`);
  }

  const expiryDate = new Date(expiry);
  await prismaDrive.driveLink.update({
    where: { id: linkId },
    data:  { channelId, channelToken, channelExpiry: expiryDate },
  });

  return { channelId, expiry: expiryDate };
}

// ──────────────────────────────────────────
// 7. Drive Watch 채널 중지
// ──────────────────────────────────────────
async function stopDriveWatch(channelId: string, channelToken: string) {
  const adapter     = createGoogleDriveAdapter();
  const accessToken = await adapter.getAccessToken();

  await fetch("https://www.googleapis.com/drive/v3/channels/stop", {
    method:  "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ id: channelId, token: channelToken }),
  });
}

// ──────────────────────────────────────────
// 8. Webhook 수신 — 채널 검증 후 자동 동기화
// ──────────────────────────────────────────
export async function handleWebhookSync(
  channelId: string,
  channelToken: string,
  resourceState: string,
): Promise<{ synced: boolean; linkId?: string; result?: SyncResult }> {
  if (!["sync", "update", "add", "change"].includes(resourceState)) {
    return { synced: false };
  }

  const link = await prismaDrive.driveLink.findFirst({
    where: { channelId, channelToken, isActive: true },
  });
  if (!link) return { synced: false };

  const result = await syncDriveFolder(link.id, link.createdById, { recursive: true });
  return { synced: true, linkId: link.id, result };
}

// ──────────────────────────────────────────
// 9. 만료된 Watch 채널 자동 갱신 (배치용)
// ──────────────────────────────────────────
export async function renewExpiredWatches(webhookBaseUrl: string): Promise<{ renewed: number; failed: number }> {
  const soon = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const expiring = await prismaDrive.driveLink.findMany({
    where: {
      isActive:      true,
      channelId:     { not: null },
      channelExpiry: { lte: soon },
    },
  });

  let renewed = 0;
  let failed = 0;

  for (const link of expiring) {
    try {
      if (link.channelId && link.channelToken) {
        await stopDriveWatch(link.channelId, link.channelToken).catch(() => {});
      }
      await registerDriveWatch(link.id, webhookBaseUrl);
      renewed++;
    } catch (err) {
      failed++;
      // Watch 갱신 실패 알림
      try {
        await createNotification({
          userId:    link.createdById,
          projectId: link.projectId,
          type:      "DRIVE_WATCH_EXPIRED",
          title:     "Drive Watch 채널 갱신 실패",
          message:   `폴더 "${link.folderName ?? link.driveFolderId}"의 실시간 감시가 중단되었습니다. 수동으로 재등록해 주세요.`,
          link:      `/projects/${link.projectId}/documents`,
        });
      } catch {
        console.error("[WatchRenew] 갱신 실패 알림 생성 오류");
      }
    }
  }
  return { renewed, failed };
}

// ──────────────────────────────────────────
// 10. 동기화 로그 조회
// ──────────────────────────────────────────
export async function listSyncLogs(
  projectId: string,
  options: { status?: string; limit?: number } = {},
) {
  return prismaDrive.syncLog.findMany({
    where: {
      projectId,
      ...(options.status ? { status: options.status } : {}),
    },
    orderBy: { syncedAt: "desc" },
    take:    options.limit ?? 50,
  });
}
