-- ============================================================
-- PlusPMS Row Level Security (RLS) 정책
-- 실행 전제: 001_schema.sql 실행 완료
-- ============================================================
-- 참고: NextAuth JWT의 sub 클레임이 users.id와 일치하는 구조
-- Supabase Auth를 사용하지 않고 NextAuth를 사용하므로
-- 서버사이드 API(Prisma)는 service_role key로 RLS를 우회하고
-- RLS는 클라이언트 직접 접근(anon key) 차단 목적으로 사용
-- ============================================================

-- ============================================================
-- 1. 모든 테이블 RLS 활성화
-- ============================================================
ALTER TABLE users             ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts          ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers         ENABLE ROW LEVEL SECURITY;
ALTER TABLE sites             ENABLE ROW LEVEL SECURITY;
ALTER TABLE process_types     ENABLE ROW LEVEL SECURITY;
ALTER TABLE item_types        ENABLE ROW LEVEL SECURITY;
ALTER TABLE part_specs        ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects          ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_stages    ENABLE ROW LEVEL SECURITY;
ALTER TABLE stage_documents   ENABLE ROW LEVEL SECURITY;
ALTER TABLE estimates         ENABLE ROW LEVEL SECURITY;
ALTER TABLE estimate_items    ENABLE ROW LEVEL SECURITY;
ALTER TABLE manuals           ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_members   ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications     ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs        ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 2. service_role 는 RLS를 우회 (Prisma / 서버 사이드)
--    anon / authenticated role 차단 정책 설정
-- ============================================================

-- ============================================================
-- users: 본인 정보만 직접 조회 가능
-- ============================================================
DROP POLICY IF EXISTS "users_select_own" ON users;
CREATE POLICY "users_select_own" ON users
  FOR SELECT USING (auth.uid()::text = id);

DROP POLICY IF EXISTS "users_no_insert" ON users;
CREATE POLICY "users_no_insert" ON users
  FOR INSERT WITH CHECK (false);

DROP POLICY IF EXISTS "users_no_update" ON users;
CREATE POLICY "users_no_update" ON users
  FOR UPDATE USING (false);

DROP POLICY IF EXISTS "users_no_delete" ON users;
CREATE POLICY "users_no_delete" ON users
  FOR DELETE USING (false);

-- ============================================================
-- accounts: 직접 접근 차단 (NextAuth 내부 전용)
-- ============================================================
DROP POLICY IF EXISTS "accounts_deny_all" ON accounts;
CREATE POLICY "accounts_deny_all" ON accounts
  FOR ALL USING (false);

-- ============================================================
-- 마스터 데이터: 인증된 사용자 읽기 가능, 쓰기 차단
-- (쓰기는 ADMIN만 → 서버 API 경유 강제)
-- ============================================================
DO $$ DECLARE t TEXT; BEGIN
  FOR t IN SELECT unnest(ARRAY['customers','sites','process_types','item_types','part_specs'])
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "master_%s_select" ON %I', t, t);
    EXECUTE format(
      'CREATE POLICY "master_%s_select" ON %I FOR SELECT USING (auth.role() IN (''authenticated'', ''anon''))',
      t, t
    );
    EXECUTE format('DROP POLICY IF EXISTS "master_%s_write" ON %I', t, t);
    EXECUTE format(
      'CREATE POLICY "master_%s_write" ON %I FOR INSERT WITH CHECK (false)',
      t, t
    );
  END LOOP;
END $$;

-- ============================================================
-- projects: 역할 기반 접근 제어
-- ============================================================

-- 조회: ADMIN/MANAGER 전체, USER는 자신이 생성/배정/멤버인 것만
DROP POLICY IF EXISTS "projects_select" ON projects;
CREATE POLICY "projects_select" ON projects
  FOR SELECT USING (
    -- 서비스 역할(Prisma)은 항상 허용됨 (RLS bypass)
    -- 클라이언트 직접 접근 시 완전 차단 (service_role로만 접근)
    false
  );

DROP POLICY IF EXISTS "projects_write" ON projects;
CREATE POLICY "projects_write" ON projects
  FOR ALL USING (false);

-- ============================================================
-- project_stages: 직접 접근 차단
-- ============================================================
DROP POLICY IF EXISTS "stages_deny" ON project_stages;
CREATE POLICY "stages_deny" ON project_stages
  FOR ALL USING (false);

-- ============================================================
-- stage_documents: 직접 접근 차단
-- ============================================================
DROP POLICY IF EXISTS "docs_deny" ON stage_documents;
CREATE POLICY "docs_deny" ON stage_documents
  FOR ALL USING (false);

-- ============================================================
-- estimates / estimate_items: 직접 접근 차단
-- ============================================================
DROP POLICY IF EXISTS "estimates_deny" ON estimates;
CREATE POLICY "estimates_deny" ON estimates
  FOR ALL USING (false);

DROP POLICY IF EXISTS "estimate_items_deny" ON estimate_items;
CREATE POLICY "estimate_items_deny" ON estimate_items
  FOR ALL USING (false);

-- ============================================================
-- manuals: 직접 접근 차단
-- ============================================================
DROP POLICY IF EXISTS "manuals_deny" ON manuals;
CREATE POLICY "manuals_deny" ON manuals
  FOR ALL USING (false);

-- ============================================================
-- project_members: 직접 접근 차단
-- ============================================================
DROP POLICY IF EXISTS "members_deny" ON project_members;
CREATE POLICY "members_deny" ON project_members
  FOR ALL USING (false);

-- ============================================================
-- notifications: 본인 것만 읽기 가능
-- ============================================================
DROP POLICY IF EXISTS "notifications_select_own" ON notifications;
CREATE POLICY "notifications_select_own" ON notifications
  FOR SELECT USING (auth.uid()::text = "userId");

DROP POLICY IF EXISTS "notifications_write_deny" ON notifications;
CREATE POLICY "notifications_write_deny" ON notifications
  FOR ALL WITH CHECK (false);

-- ============================================================
-- audit_logs: 직접 접근 차단 (관리자도 API 경유)
-- ============================================================
DROP POLICY IF EXISTS "audit_logs_deny" ON audit_logs;
CREATE POLICY "audit_logs_deny" ON audit_logs
  FOR ALL USING (false);

-- ============================================================
-- project_overview 뷰: 직접 조회 차단
-- ============================================================
REVOKE SELECT ON project_overview FROM anon, authenticated;

-- ============================================================
-- 확인 쿼리 (실행 후 검증용)
-- ============================================================
-- SELECT schemaname, tablename, rowsecurity
-- FROM pg_tables
-- WHERE schemaname = 'public'
-- ORDER BY tablename;
