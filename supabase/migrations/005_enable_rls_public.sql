-- ============================================================
-- Supabase Advisor: rls_disabled_in_public 대응
-- ============================================================
-- PostgREST에 노출된 public 스키마 테이블에 RLS가 꺼져 있으면
-- anon/authenticated 키로 데이터가 노출될 수 있습니다.
--
-- Prisma migrate만 적용하고 002_rls.sql / 004_drive_sync.sql 을
-- 실행하지 않은 경우 등, RLS가 빠진 테이블이 남을 수 있으므로
-- public 의 모든 일반 테이블에 대해 RLS를 켭니다.
--
-- 실행 후에도 정책(POLICY)은 002·004 를 반드시 적용해야 합니다.
-- (정책 없이 RLS만 켜진 테이블은 anon API 접근이 기본 거부됩니다.)
-- ============================================================

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT c.relname AS tbl
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND NOT c.relrowsecurity
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', r.tbl);
    RAISE NOTICE 'RLS enabled: public.%', r.tbl;
  END LOOP;
END $$;

-- 검증 (Advisor와 동일한 관점: public 테이블의 row security 여부)
-- SELECT tablename, rowsecurity
-- FROM pg_tables
-- WHERE schemaname = 'public'
-- ORDER BY tablename;
