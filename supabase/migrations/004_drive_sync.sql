-- ============================================================
-- PlusPMS Supabase Migration: Google Drive 실시간 동기화 테이블
-- 실행 순서: 001 → 002 → 003 → 004
-- ============================================================
-- Supabase SQL Editor에서 이 파일 전체 붙여넣기 후 Run
-- ============================================================

-- ── project_drive_links ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS project_drive_links (
  id              TEXT      NOT NULL DEFAULT ('plusPMS_' || replace(gen_random_uuid()::text, '-', '')),
  "projectId"     TEXT      NOT NULL,
  "driveFolderId" TEXT      NOT NULL,
  "folderName"    TEXT,
  "stageNumber"   INTEGER,
  "isActive"      BOOLEAN   NOT NULL DEFAULT true,
  "channelId"     TEXT,
  "channelToken"  TEXT,
  "channelExpiry" TIMESTAMP(3),
  "lastSyncAt"    TIMESTAMP(3),
  "createdById"   TEXT      NOT NULL,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT project_drive_links_pkey PRIMARY KEY (id)
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'project_drive_links_projectid_fkey') THEN
    ALTER TABLE project_drive_links ADD CONSTRAINT project_drive_links_projectId_fkey
      FOREIGN KEY ("projectId") REFERENCES projects(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'project_drive_links_createdbyid_fkey') THEN
    ALTER TABLE project_drive_links ADD CONSTRAINT project_drive_links_createdById_fkey
      FOREIGN KEY ("createdById") REFERENCES users(id);
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS project_drive_links_projectId_driveFolderId_key
  ON project_drive_links ("projectId", "driveFolderId");

CREATE INDEX IF NOT EXISTS project_drive_links_projectId_idx
  ON project_drive_links ("projectId");

CREATE INDEX IF NOT EXISTS project_drive_links_channelId_idx
  ON project_drive_links ("channelId");

-- updatedAt 자동 갱신 트리거
CREATE OR REPLACE FUNCTION update_drive_link_updated_at()
  RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW."updatedAt" = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_drive_link_updated_at ON project_drive_links;
CREATE TRIGGER set_drive_link_updated_at
  BEFORE UPDATE ON project_drive_links
  FOR EACH ROW EXECUTE FUNCTION update_drive_link_updated_at();

-- ── drive_sync_logs ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS drive_sync_logs (
  id             TEXT      NOT NULL DEFAULT ('plusPMS_' || replace(gen_random_uuid()::text, '-', '')),
  "driveLinkId"  TEXT      NOT NULL,
  "projectId"    TEXT      NOT NULL,
  "driveFileId"  TEXT      NOT NULL,
  "fileName"     TEXT      NOT NULL,
  "stageNumber"  INTEGER   NOT NULL,
  "documentType" TEXT      NOT NULL,
  status         TEXT      NOT NULL,
  "documentId"   TEXT,
  reason         TEXT,
  "syncedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT drive_sync_logs_pkey PRIMARY KEY (id)
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'drive_sync_logs_drivelinkid_fkey') THEN
    ALTER TABLE drive_sync_logs ADD CONSTRAINT drive_sync_logs_driveLinkId_fkey
      FOREIGN KEY ("driveLinkId") REFERENCES project_drive_links(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS drive_sync_logs_driveLinkId_idx ON drive_sync_logs ("driveLinkId");
CREATE INDEX IF NOT EXISTS drive_sync_logs_projectId_idx   ON drive_sync_logs ("projectId");
CREATE INDEX IF NOT EXISTS drive_sync_logs_driveFileId_idx ON drive_sync_logs ("driveFileId");
CREATE INDEX IF NOT EXISTS drive_sync_logs_status_idx     ON drive_sync_logs (status);

-- ── RLS 정책 ─────────────────────────────────────────────────
ALTER TABLE project_drive_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE drive_sync_logs     ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "project_drive_links_select" ON project_drive_links;
CREATE POLICY "project_drive_links_select" ON project_drive_links
  FOR SELECT USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "project_drive_links_insert" ON project_drive_links;
CREATE POLICY "project_drive_links_insert" ON project_drive_links
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "project_drive_links_update" ON project_drive_links;
CREATE POLICY "project_drive_links_update" ON project_drive_links
  FOR UPDATE USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "project_drive_links_delete" ON project_drive_links;
CREATE POLICY "project_drive_links_delete" ON project_drive_links
  FOR DELETE USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "drive_sync_logs_select" ON drive_sync_logs;
CREATE POLICY "drive_sync_logs_select" ON drive_sync_logs
  FOR SELECT USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "drive_sync_logs_insert" ON drive_sync_logs;
CREATE POLICY "drive_sync_logs_insert" ON drive_sync_logs
  FOR INSERT WITH CHECK (auth.role() = 'service_role');
