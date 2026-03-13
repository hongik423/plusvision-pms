/**
 * Google Drive 연동 모델용 Prisma 타입 어댑터
 *
 * ⚠️  `prisma generate` 실행 전까지 신규 모델(ProjectDriveLink, DriveSyncLog)이
 *     PrismaClient 타입에 포함되지 않기 때문에 `(prisma as any)` 캐스팅을 사용합니다.
 *
 * 마이그레이션 실행 방법:
 *   npx prisma db push              ← 스키마 즉시 반영 (개발 전용)
 *   npx prisma migrate dev --name add_drive_sync  ← 공식 마이그레이션
 *
 * 마이그레이션 후 이 파일은 prisma.projectDriveLink / prisma.driveSyncLog 로
 * 교체하고 이 어댑터는 삭제해도 됩니다.
 */

import { prisma } from "@/lib/prisma";

// ── 타입 정의 ──────────────────────────────────────────────
export type ProjectDriveLink = {
  id:             string;
  projectId:      string;
  driveFolderId:  string;
  folderName:     string | null;
  stageNumber:    number | null;
  isActive:       boolean;
  channelId:      string | null;
  channelToken:   string | null;
  channelExpiry:  Date | null;
  lastSyncAt:     Date | null;
  createdById:    string;
  createdAt:      Date;
  updatedAt:      Date;
};

export type DriveSyncLog = {
  id:           string;
  driveLinkId:  string;
  projectId:    string;
  driveFileId:  string;
  fileName:     string;
  stageNumber:  number;
  documentType: string;
  status:       "SYNCED" | "SKIPPED" | "FAILED";
  documentId:   string | null;
  reason:       string | null;
  syncedAt:     Date;
};

// ── 타입 안전 접근자 ────────────────────────────────────────
// eslint-disable-next-line -- Prisma generate 전까지 임시 any 캐스팅
const db = prisma as unknown as {
  projectDriveLink: Record<string, unknown>;
  driveSyncLog: Record<string, unknown>;
};

export const prismaDrive = {
  /** ProjectDriveLink 모델 접근자 */
  driveLink: db.projectDriveLink as {
    findUnique:   (args: object) => Promise<ProjectDriveLink | null>;
    findFirst:    (args: object) => Promise<ProjectDriveLink | null>;
    findMany:     (args: object) => Promise<ProjectDriveLink[]>;
    create:       (args: object) => Promise<ProjectDriveLink>;
    update:       (args: object) => Promise<ProjectDriveLink>;
    upsert:       (args: object) => Promise<ProjectDriveLink>;
  },

  /** DriveSyncLog 모델 접근자 */
  syncLog: db.driveSyncLog as {
    findMany:     (args: object) => Promise<DriveSyncLog[]>;
    create:       (args: object) => Promise<DriveSyncLog>;
  },
};
