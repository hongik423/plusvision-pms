-- ============================================================
-- PlusPMS Supabase Storage 설정
-- 실행 전제: 001_schema.sql, 002_rls.sql 실행 완료
-- ============================================================
-- 파일 경로 구조: {projectId}/stage-{n}/{timestamp}-{filename}
-- 예: plusPMS_project_abc123/stage-7/1708765432100-manual.pdf
-- ============================================================

-- ============================================================
-- 1. projects 버킷 생성 (비공개)
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'projects',
  'projects',
  false,
  104857600,  -- 100MB per file (PRD F-005)
  ARRAY[
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.hancom.hwp',
    'application/vnd.hancom.hwpx',
    'application/acad',
    'application/dxf',
    'image/vnd.dxf',
    'application/octet-stream',
    'text/plain',
    'text/csv'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit  = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ============================================================
-- 2. Storage 정책 설정
-- 참고: Supabase는 storage.objects, storage.buckets 테이블에
--       이미 RLS가 활성화되어 있으므로 ALTER TABLE 불필요
-- ============================================================

-- ============================================================
-- 3. storage.objects 정책
-- 경로 규칙: {projectId}/stage-{stageNumber}/{filename}
-- ============================================================

-- 업로드(INSERT): 인증된 사용자만 (실제 권한 검증은 서버 API에서)
DROP POLICY IF EXISTS "projects_storage_insert" ON storage.objects;
CREATE POLICY "projects_storage_insert" ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'projects'
    AND auth.role() = 'authenticated'
  );

-- 조회(SELECT): 인증된 사용자만
DROP POLICY IF EXISTS "projects_storage_select" ON storage.objects;
CREATE POLICY "projects_storage_select" ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'projects'
    AND auth.role() = 'authenticated'
  );

-- 수정(UPDATE): 업로더 본인만
DROP POLICY IF EXISTS "projects_storage_update" ON storage.objects;
CREATE POLICY "projects_storage_update" ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'projects'
    AND owner = auth.uid()
  );

-- 삭제(DELETE): 업로더 본인 또는 service_role
DROP POLICY IF EXISTS "projects_storage_delete" ON storage.objects;
CREATE POLICY "projects_storage_delete" ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'projects'
    AND (owner = auth.uid() OR auth.role() = 'service_role')
  );

-- ============================================================
-- 4. storage.buckets 정책 (버킷 메타데이터 조회)
-- ============================================================
DROP POLICY IF EXISTS "buckets_select_authenticated" ON storage.buckets;
CREATE POLICY "buckets_select_authenticated" ON storage.buckets
  FOR SELECT
  USING (
    id = 'projects'
    AND auth.role() IN ('authenticated', 'service_role')
  );

-- ============================================================
-- 5. 프로젝트별 스토리지 사용량 추적 뷰
-- (SQL 에디터에서 파일 용량 모니터링용)
-- ============================================================
CREATE OR REPLACE VIEW project_storage_usage AS
SELECT
  split_part(name, '/', 1)            AS project_id,
  split_part(name, '/', 2)            AS stage_folder,
  COUNT(*)                            AS file_count,
  SUM(metadata->>'size')::BIGINT      AS total_bytes,
  ROUND(SUM(metadata->>'size')::BIGINT / 1048576.0, 2) AS total_mb,
  MIN(created_at)                     AS first_upload,
  MAX(created_at)                     AS last_upload
FROM storage.objects
WHERE bucket_id = 'projects'
  AND name IS NOT NULL
GROUP BY
  split_part(name, '/', 1),
  split_part(name, '/', 2)
ORDER BY project_id, stage_folder;

COMMENT ON VIEW project_storage_usage IS
  '프로젝트별/단계별 파일 용량 추적 뷰 - SELECT * FROM project_storage_usage WHERE project_id = ''plusPMS_project_...'';';

-- ============================================================
-- 사용 예시 쿼리
-- ============================================================
-- -- 특정 프로젝트 전체 파일 조회:
-- SELECT name, metadata->>'size' AS size, created_at
-- FROM storage.objects
-- WHERE bucket_id = 'projects'
--   AND name LIKE 'plusPMS_project_<ID>/%'
-- ORDER BY created_at DESC;
--
-- -- 프로젝트별 스토리지 사용량 확인:
-- SELECT project_id, SUM(total_mb) AS total_mb
-- FROM project_storage_usage
-- GROUP BY project_id
-- ORDER BY total_mb DESC;
