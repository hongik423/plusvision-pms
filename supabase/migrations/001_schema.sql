-- ============================================================
-- PlusPMS Supabase 스키마 마이그레이션
-- 실행 순서: 001_schema.sql → 002_rls.sql → 003_storage.sql → 004_drive_sync.sql → 005_enable_rls_public.sql
-- Supabase SQL 에디터에서 전체 붙여넣기 후 Run
-- ============================================================

-- ============================================================
-- 0. 확장 기능 활성화
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- 1. ENUM 타입 정의
-- ============================================================

DO $$ BEGIN
  CREATE TYPE "Role" AS ENUM ('ADMIN', 'MANAGER', 'USER', 'VIEWER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "ProjectStatus" AS ENUM ('PENDING', 'ACTIVE', 'COMPLETED', 'HOLD', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "StageStatus" AS ENUM ('INACTIVE', 'ACTIVE', 'COMPLETED', 'SKIPPED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "DocumentType" AS ENUM (
    'PROPOSAL', 'ESTIMATE', 'MANUFACTURE_MANUAL', 'INSTALL_MANUAL',
    'PARTS_LIST', 'SITE_PHOTO', 'DRAWING', 'MEETING_NOTE', 'EXPORT_RECORD', 'OTHER'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "StorageType" AS ENUM ('SUPABASE', 'GOOGLE_DRIVE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "EstimateStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "ManualType" AS ENUM ('MANUFACTURE', 'INSTALL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- 2. updated_at 자동 갱신 트리거 함수
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 3. 사용자 테이블
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id            TEXT        PRIMARY KEY DEFAULT ('plusPMS_'::text || replace(gen_random_uuid()::text, '-', '')),
  email         TEXT        NOT NULL UNIQUE,
  name          TEXT        NOT NULL,
  password      TEXT,
  role          "Role"      NOT NULL DEFAULT 'USER',
  department    TEXT,
  phone         TEXT,
  "profileImage" TEXT,
  "isActive"    BOOLEAN     NOT NULL DEFAULT true,
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS accounts (
  id                  TEXT PRIMARY KEY DEFAULT ('plusPMS_'::text || replace(gen_random_uuid()::text, '-', '')),
  "userId"            TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type                TEXT NOT NULL,
  provider            TEXT NOT NULL,
  "providerAccountId" TEXT NOT NULL,
  refresh_token       TEXT,
  access_token        TEXT,
  expires_at          INTEGER,
  token_type          TEXT,
  scope               TEXT,
  id_token            TEXT,
  UNIQUE (provider, "providerAccountId")
);

-- ============================================================
-- 4. 마스터 데이터 테이블
-- ============================================================
CREATE TABLE IF NOT EXISTS customers (
  id        TEXT        PRIMARY KEY DEFAULT ('plusPMS_'::text || replace(gen_random_uuid()::text, '-', '')),
  name      TEXT        NOT NULL UNIQUE,
  code      TEXT        NOT NULL UNIQUE,
  contact   TEXT,
  phone     TEXT,
  "isActive" BOOLEAN    NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sites (
  id        TEXT        PRIMARY KEY DEFAULT ('plusPMS_'::text || replace(gen_random_uuid()::text, '-', '')),
  name      TEXT        NOT NULL UNIQUE,
  code      TEXT        NOT NULL UNIQUE,
  address   TEXT,
  "isActive" BOOLEAN    NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS process_types (
  id        TEXT        PRIMARY KEY DEFAULT ('plusPMS_'::text || replace(gen_random_uuid()::text, '-', '')),
  name      TEXT        NOT NULL UNIQUE,
  code      TEXT        NOT NULL UNIQUE,
  "isActive" BOOLEAN    NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS item_types (
  id        TEXT        PRIMARY KEY DEFAULT ('plusPMS_'::text || replace(gen_random_uuid()::text, '-', '')),
  name      TEXT        NOT NULL UNIQUE,
  code      TEXT        NOT NULL UNIQUE,
  "isActive" BOOLEAN    NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS part_specs (
  id            TEXT        PRIMARY KEY DEFAULT ('plusPMS_'::text || replace(gen_random_uuid()::text, '-', '')),
  category      TEXT        NOT NULL,
  name          TEXT        NOT NULL,
  specification TEXT        NOT NULL,
  unit          TEXT        NOT NULL DEFAULT 'EA',
  "unitPrice"   DECIMAL(15,2),
  manufacturer  TEXT,
  "isActive"    BOOLEAN     NOT NULL DEFAULT true,
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_part_specs_category ON part_specs(category);

-- ============================================================
-- 5. 프로젝트 핵심 테이블 (UUID 기반 추적 중심)
-- ============================================================
CREATE TABLE IF NOT EXISTS projects (
  id              TEXT            PRIMARY KEY DEFAULT ('plusPMS_'::text || replace(gen_random_uuid()::text, '-', '')),
  "projectNumber" TEXT            NOT NULL UNIQUE,
  name            TEXT            NOT NULL,
  description     TEXT,
  status          "ProjectStatus" NOT NULL DEFAULT 'PENDING',
  "currentStage"  INTEGER         NOT NULL DEFAULT 1,
  "customerId"    TEXT            NOT NULL REFERENCES customers(id),
  "siteId"        TEXT            NOT NULL REFERENCES sites(id),
  "processTypeId" TEXT            NOT NULL REFERENCES process_types(id),
  "itemTypeId"    TEXT            NOT NULL REFERENCES item_types(id),
  "bondNumber"    TEXT,
  "bondRegistered" BOOLEAN        NOT NULL DEFAULT false,
  "startDate"     TIMESTAMPTZ,
  "dueDate"       TIMESTAMPTZ,
  "completedDate" TIMESTAMPTZ,
  "createdById"   TEXT            NOT NULL REFERENCES users(id),
  "copiedFromId"  TEXT            REFERENCES projects(id),
  "createdAt"     TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  "updatedAt"     TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- 프로젝트 조회 최적화 인덱스
CREATE INDEX IF NOT EXISTS idx_projects_status        ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_customer_id   ON projects("customerId");
CREATE INDEX IF NOT EXISTS idx_projects_site_id       ON projects("siteId");
CREATE INDEX IF NOT EXISTS idx_projects_process_type  ON projects("processTypeId");
CREATE INDEX IF NOT EXISTS idx_projects_item_type     ON projects("itemTypeId");
CREATE INDEX IF NOT EXISTS idx_projects_created_at    ON projects("createdAt" DESC);
CREATE INDEX IF NOT EXISTS idx_projects_copied_from   ON projects("copiedFromId");
CREATE INDEX IF NOT EXISTS idx_projects_created_by    ON projects("createdById");

-- ============================================================
-- 6. 프로젝트 단계 테이블 (project_id 기준 추적)
-- ============================================================
CREATE TABLE IF NOT EXISTS project_stages (
  id              TEXT          PRIMARY KEY DEFAULT ('plusPMS_'::text || replace(gen_random_uuid()::text, '-', '')),
  "projectId"     TEXT          NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  "stageNumber"   INTEGER       NOT NULL,
  "stageName"     TEXT          NOT NULL,
  status          "StageStatus" NOT NULL DEFAULT 'INACTIVE',
  "assigneeId"    TEXT          REFERENCES users(id),
  "startDate"     TIMESTAMPTZ,
  "completedDate" TIMESTAMPTZ,
  notes           TEXT,
  "createdAt"     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  "updatedAt"     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE ("projectId", "stageNumber")
);

-- 프로젝트 단계 추적 인덱스 (핵심: project_id 기준)
CREATE INDEX IF NOT EXISTS idx_project_stages_project_id  ON project_stages("projectId");
CREATE INDEX IF NOT EXISTS idx_project_stages_assignee    ON project_stages("assigneeId");
CREATE INDEX IF NOT EXISTS idx_project_stages_status      ON project_stages(status);

-- ============================================================
-- 7. 문서 테이블 (stage → project 추적)
-- ============================================================
CREATE TABLE IF NOT EXISTS stage_documents (
  id              TEXT           PRIMARY KEY DEFAULT ('plusPMS_'::text || replace(gen_random_uuid()::text, '-', '')),
  "stageId"       TEXT           NOT NULL REFERENCES project_stages(id) ON DELETE CASCADE,
  "documentType"  "DocumentType" NOT NULL,
  "fileName"      TEXT           NOT NULL,
  "fileUrl"       TEXT           NOT NULL,
  "fileSize"      INTEGER        NOT NULL,
  "mimeType"      TEXT           NOT NULL,
  version         INTEGER        NOT NULL DEFAULT 1,
  description     TEXT,
  "storageType"   "StorageType"  NOT NULL DEFAULT 'SUPABASE',
  "externalId"    TEXT,
  "uploadedById"  TEXT           NOT NULL REFERENCES users(id),
  "createdAt"     TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  "updatedAt"     TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stage_docs_stage_id     ON stage_documents("stageId");
CREATE INDEX IF NOT EXISTS idx_stage_docs_type         ON stage_documents("documentType");
CREATE INDEX IF NOT EXISTS idx_stage_docs_external_id  ON stage_documents("externalId");
CREATE INDEX IF NOT EXISTS idx_stage_docs_uploaded_by  ON stage_documents("uploadedById");

-- ============================================================
-- 8. 견적서 테이블
-- ============================================================
CREATE TABLE IF NOT EXISTS estimates (
  id               TEXT             PRIMARY KEY DEFAULT ('plusPMS_'::text || replace(gen_random_uuid()::text, '-', '')),
  "projectId"      TEXT             NOT NULL REFERENCES projects(id),
  "estimateNumber" TEXT             NOT NULL UNIQUE,
  version          INTEGER          NOT NULL DEFAULT 1,
  title            TEXT             NOT NULL,
  "totalAmount"    DECIMAL(15,2)    NOT NULL DEFAULT 0,
  "taxAmount"      DECIMAL(15,2)    NOT NULL DEFAULT 0,
  "grandTotal"     DECIMAL(15,2)    NOT NULL DEFAULT 0,
  notes            TEXT,
  status           "EstimateStatus" NOT NULL DEFAULT 'DRAFT',
  "createdById"    TEXT             NOT NULL REFERENCES users(id),
  "createdAt"      TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
  "updatedAt"      TIMESTAMPTZ      NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_estimates_project_id ON estimates("projectId");
CREATE INDEX IF NOT EXISTS idx_estimates_status     ON estimates(status);

CREATE TABLE IF NOT EXISTS estimate_items (
  id             TEXT          PRIMARY KEY DEFAULT ('plusPMS_'::text || replace(gen_random_uuid()::text, '-', '')),
  "estimateId"   TEXT          NOT NULL REFERENCES estimates(id) ON DELETE CASCADE,
  "partSpecId"   TEXT          REFERENCES part_specs(id),
  "itemName"     TEXT          NOT NULL,
  specification  TEXT,
  unit           TEXT          NOT NULL DEFAULT 'EA',
  quantity       DECIMAL(15,3) NOT NULL,
  "unitPrice"    DECIMAL(15,2) NOT NULL,
  amount         DECIMAL(15,2) NOT NULL,
  "sortOrder"    INTEGER       NOT NULL DEFAULT 0,
  remarks        TEXT
);

CREATE INDEX IF NOT EXISTS idx_estimate_items_estimate_id ON estimate_items("estimateId");
CREATE INDEX IF NOT EXISTS idx_estimate_items_part_spec   ON estimate_items("partSpecId");

-- ============================================================
-- 9. 매뉴얼 테이블
-- ============================================================
CREATE TABLE IF NOT EXISTS manuals (
  id           TEXT         PRIMARY KEY DEFAULT ('plusPMS_'::text || replace(gen_random_uuid()::text, '-', '')),
  "projectId"  TEXT         NOT NULL REFERENCES projects(id),
  type         "ManualType" NOT NULL,
  title        TEXT         NOT NULL,
  content      TEXT         NOT NULL,
  version      INTEGER      NOT NULL DEFAULT 1,
  "createdById" TEXT        NOT NULL REFERENCES users(id),
  "createdAt"  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  "updatedAt"  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_manuals_project_id ON manuals("projectId");
CREATE INDEX IF NOT EXISTS idx_manuals_type       ON manuals(type);

-- ============================================================
-- 10. 프로젝트 멤버 테이블
-- ============================================================
CREATE TABLE IF NOT EXISTS project_members (
  id           TEXT        PRIMARY KEY DEFAULT ('plusPMS_'::text || replace(gen_random_uuid()::text, '-', '')),
  "projectId"  TEXT        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  "userId"     TEXT        NOT NULL REFERENCES users(id),
  role         TEXT        NOT NULL DEFAULT 'MEMBER',
  "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE ("projectId", "userId")
);

CREATE INDEX IF NOT EXISTS idx_project_members_project_id ON project_members("projectId");
CREATE INDEX IF NOT EXISTS idx_project_members_user_id    ON project_members("userId");

-- ============================================================
-- 11. 알림 테이블 (project_id 기반 필터링 지원)
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
  id           TEXT        PRIMARY KEY DEFAULT ('plusPMS_'::text || replace(gen_random_uuid()::text, '-', '')),
  "userId"     TEXT        NOT NULL REFERENCES users(id),
  "projectId"  TEXT        REFERENCES projects(id),
  type         TEXT        NOT NULL,
  title        TEXT        NOT NULL,
  message      TEXT        NOT NULL,
  link         TEXT,
  "isRead"     BOOLEAN     NOT NULL DEFAULT false,
  "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_read   ON notifications("userId", "isRead");
CREATE INDEX IF NOT EXISTS idx_notifications_project_id  ON notifications("projectId");
CREATE INDEX IF NOT EXISTS idx_notifications_created_at  ON notifications("createdAt" DESC);

-- ============================================================
-- 12. 감사 로그 테이블 (project_id 기준 변경 이력 추적)
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id           TEXT        PRIMARY KEY DEFAULT ('plusPMS_'::text || replace(gen_random_uuid()::text, '-', '')),
  "userId"     TEXT        NOT NULL REFERENCES users(id),
  "projectId"  TEXT        REFERENCES projects(id),
  action       TEXT        NOT NULL,
  "entityType" TEXT        NOT NULL,
  "entityId"   TEXT        NOT NULL,
  changes      JSONB,
  "ipAddress"  TEXT,
  "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id     ON audit_logs("userId");
CREATE INDEX IF NOT EXISTS idx_audit_logs_project_id  ON audit_logs("projectId");
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity      ON audit_logs("entityType", "entityId");
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at  ON audit_logs("createdAt" DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action      ON audit_logs(action);

-- ============================================================
-- 13. updated_at 트리거 등록
-- ============================================================
DO $$ DECLARE
  t TEXT;
BEGIN
  FOR t IN
    SELECT unnest(ARRAY[
      'users','customers','sites','process_types','item_types','part_specs',
      'projects','project_stages','stage_documents','estimates','manuals'
    ])
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_%s_updated_at ON %I;
       CREATE TRIGGER trg_%s_updated_at
       BEFORE UPDATE ON %I
       FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();',
      t, t, t, t
    );
  END LOOP;
END $$;

-- ============================================================
-- 14. 프로젝트 UUID 기반 통합 추적 뷰
-- (SQL 에디터에서 프로젝트별 전체 현황 조회용)
-- ============================================================
CREATE OR REPLACE VIEW project_overview AS
SELECT
  p.id                                                                          AS project_id,
  p."projectNumber"                                                             AS project_number,
  p.name                                                                        AS project_name,
  p.status                                                                      AS project_status,
  p."currentStage"                                                              AS current_stage,
  c.name                                                                        AS customer_name,
  s.name                                                                        AS site_name,
  pt.name                                                                       AS process_type,
  it.name                                                                       AS item_type,
  u.name                                                                        AS created_by,
  COUNT(DISTINCT ps.id)                                                         AS total_stages,
  COUNT(DISTINCT ps.id) FILTER (WHERE ps.status = 'COMPLETED')                 AS completed_stages,
  COUNT(DISTINCT ps.id) FILTER (WHERE ps.status = 'ACTIVE')                    AS active_stages,
  COUNT(DISTINCT sd.id)                                                         AS total_documents,
  COUNT(DISTINCT e.id)                                                          AS total_estimates,
  COUNT(DISTINCT m.id)                                                          AS total_manuals,
  COUNT(DISTINCT al.id)                                                         AS audit_count,
  p."createdAt",
  p."updatedAt",
  p."completedDate"
FROM projects p
LEFT JOIN customers c       ON c.id = p."customerId"
LEFT JOIN sites s           ON s.id = p."siteId"
LEFT JOIN process_types pt  ON pt.id = p."processTypeId"
LEFT JOIN item_types it     ON it.id = p."itemTypeId"
LEFT JOIN users u           ON u.id = p."createdById"
LEFT JOIN project_stages ps ON ps."projectId" = p.id
LEFT JOIN stage_documents sd ON sd."stageId" = ps.id
LEFT JOIN estimates e       ON e."projectId" = p.id
LEFT JOIN manuals m         ON m."projectId" = p.id
LEFT JOIN audit_logs al     ON al."projectId" = p.id
GROUP BY p.id, c.name, s.name, pt.name, it.name, u.name;

COMMENT ON VIEW project_overview IS
  '프로젝트 UUID 기준 전체 현황 통합 조회 뷰 - SQL 에디터에서 SELECT * FROM project_overview 로 사용';
