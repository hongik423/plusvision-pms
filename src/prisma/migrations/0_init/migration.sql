-- ============================================================
-- Prisma baseline migration (shadow DB용)
-- 실제 운영 DB는 supabase/migrations/001_schema.sql로 구축됨
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

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

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

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

CREATE INDEX IF NOT EXISTS idx_projects_status        ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_customer_id   ON projects("customerId");
CREATE INDEX IF NOT EXISTS idx_projects_site_id        ON projects("siteId");
CREATE INDEX IF NOT EXISTS idx_projects_process_type  ON projects("processTypeId");
CREATE INDEX IF NOT EXISTS idx_projects_item_type     ON projects("itemTypeId");
CREATE INDEX IF NOT EXISTS idx_projects_created_at    ON projects("createdAt" DESC);
CREATE INDEX IF NOT EXISTS idx_projects_copied_from   ON projects("copiedFromId");
CREATE INDEX IF NOT EXISTS idx_projects_created_by    ON projects("createdById");

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

CREATE INDEX IF NOT EXISTS idx_project_stages_project_id  ON project_stages("projectId");
CREATE INDEX IF NOT EXISTS idx_project_stages_assignee    ON project_stages("assigneeId");
CREATE INDEX IF NOT EXISTS idx_project_stages_status      ON project_stages(status);

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
CREATE INDEX IF NOT EXISTS idx_stage_docs_external_id   ON stage_documents("externalId");
CREATE INDEX IF NOT EXISTS idx_stage_docs_uploaded_by   ON stage_documents("uploadedById");

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
CREATE INDEX IF NOT EXISTS idx_notifications_project_id   ON notifications("projectId");
CREATE INDEX IF NOT EXISTS idx_notifications_created_at   ON notifications("createdAt" DESC);

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
CREATE INDEX IF NOT EXISTS idx_audit_logs_project_id   ON audit_logs("projectId");
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity      ON audit_logs("entityType", "entityId");
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at  ON audit_logs("createdAt" DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action      ON audit_logs(action);
