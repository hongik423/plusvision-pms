# PlusPMS Supabase 구축 가이드

## 실행 순서

Supabase 대시보드 → **SQL Editor** 에서 아래 순서대로 각 파일의 전체 내용을 붙여넣고 **Run** 클릭.

| 순서 | 파일 | 내용 |
|------|------|------|
| 1 | `migrations/001_schema.sql` | 전체 테이블 DDL, 인덱스, 트리거, 추적 뷰 |
| 2 | `migrations/002_rls.sql` | Row Level Security 정책 |
| 3 | `migrations/003_storage.sql` | `projects` 버킷 생성 + Storage 정책 |
| 4 | `migrations/004_drive_sync.sql` | Drive 동기화 테이블 + 해당 RLS |
| 5 | `migrations/005_enable_rls_public.sql` | **Advisor 경고용** — `public` 내 RLS 미적용 테이블 일괄 활성화 |

**Supabase 이메일(rls_disabled_in_public) 대응:** 대시보드 **SQL Editor**에서 `005_enable_rls_public.sql` 전체 실행 후, 아직 적용하지 않았다면 `002_rls.sql`·`004_drive_sync.sql`도 실행해 정책을 맞춥니다. **Advisors**에서 동일 항목이 사라지는지 확인합니다.

---

## 핵심 설계 원칙

### 프로젝트 UUID 기반 데이터 추적

모든 테이블은 `projects.id` (형식: `plusPMS_project_<uuid32>`)를 기준으로 연결됩니다.

```
projects (id)
├── project_stages    → projectId FK (CASCADE DELETE)
│   └── stage_documents → stageId FK (CASCADE DELETE)
├── estimates         → projectId FK
│   └── estimate_items → estimateId FK (CASCADE DELETE)
├── manuals           → projectId FK
├── project_members   → projectId FK (CASCADE DELETE)
├── notifications     → projectId FK (optional)
└── audit_logs        → projectId FK (optional)
```

### Storage 경로 구조
```
projects/
  {projectId}/
    stage-1/   → 의뢰 접수 문서
    stage-3/   → 현장 사진
    stage-6/   → 견적서
    stage-7/   → 제작 매뉴얼
    stage-8/   → 설치 매뉴얼
    ...
```

---

## SQL 에디터 추적 쿼리

### 프로젝트 전체 현황 조회
```sql
SELECT * FROM project_overview ORDER BY "createdAt" DESC;
```

### 특정 프로젝트 단계별 진행 상황
```sql
SELECT
  ps."stageNumber",
  ps."stageName",
  ps.status,
  ps."assigneeId",
  ps."startDate",
  ps."completedDate",
  COUNT(sd.id) AS doc_count
FROM project_stages ps
LEFT JOIN stage_documents sd ON sd."stageId" = ps.id
WHERE ps."projectId" = 'plusPMS_project_여기에ID입력'
GROUP BY ps.id
ORDER BY ps."stageNumber";
```

### 프로젝트별 스토리지 사용량
```sql
SELECT * FROM project_storage_usage WHERE project_id = 'plusPMS_project_여기에ID입력';
```

### 특정 프로젝트 변경 이력 (Audit Log)
```sql
SELECT
  al."createdAt",
  u.name AS user_name,
  al.action,
  al."entityType",
  al.changes
FROM audit_logs al
JOIN users u ON u.id = al."userId"
WHERE al."projectId" = 'plusPMS_project_여기에ID입력'
ORDER BY al."createdAt" DESC;
```

### 단계가 지연된 프로젝트 조회 (ACTIVE 단계가 7일 이상)
```sql
SELECT
  p."projectNumber",
  p.name,
  ps."stageNumber",
  ps."stageName",
  ps."startDate",
  NOW() - ps."startDate" AS elapsed,
  u.name AS assignee
FROM project_stages ps
JOIN projects p ON p.id = ps."projectId"
LEFT JOIN users u ON u.id = ps."assigneeId"
WHERE ps.status = 'ACTIVE'
  AND ps."startDate" < NOW() - INTERVAL '7 days'
ORDER BY ps."startDate" ASC;
```

### 미배정 단계 (담당자 없는 ACTIVE 단계)
```sql
SELECT
  p."projectNumber",
  p.name,
  ps."stageNumber",
  ps."stageName",
  ps."startDate"
FROM project_stages ps
JOIN projects p ON p.id = ps."projectId"
WHERE ps.status = 'ACTIVE'
  AND ps."assigneeId" IS NULL
ORDER BY ps."startDate" ASC;
```

---

## 환경 변수 확인

`.env.local` 에 아래 값이 올바르게 설정되어야 합니다:

```env
DATABASE_URL=postgresql://postgres.<PROJECT_REF>:<PASSWORD>@aws-1-ap-northeast-2.pooler.supabase.com:5432/postgres
NEXT_PUBLIC_SUPABASE_URL=https://<PROJECT_REF>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<ANON_KEY>
SUPABASE_SERVICE_ROLE_KEY=<SERVICE_ROLE_KEY>
NEXTAUTH_URL=https://plusvision-pms.vercel.app
NEXTAUTH_SECRET=<32자 이상 랜덤 문자열>
```

### Vercel 배포 시 필수 환경 변수

Vercel 대시보드 → 프로젝트 → **Settings** → **Environment Variables** 에서 설정:

| 변수 | 필수 | 설명 |
|------|------|------|
| `NEXTAUTH_URL` | ✅ | 배포 URL (예: `https://plusvision-pms.vercel.app`) |
| `NEXTAUTH_SECRET` | ✅ | `openssl rand -base64 32`로 생성한 32자 이상 문자열 |
| `DATABASE_URL` | ✅ | Supabase Connection String (Transaction pooler 6543 권장) |
| `DEMO_LOGIN_ENABLED` | - | DB 사용자 없을 때 `true`면 테스트 계정 허용. **Vercel 배포는 자동 허용** |

- **Vercel 배포**에서는 `VERCEL=1`이 자동 설정되어, DB에 사용자가 없거나 연결 실패 시 데모 계정(admin/manager/test)으로 로그인 가능합니다.
- 로그인 실패 시: `NEXTAUTH_URL`, `NEXTAUTH_SECRET` 값과 DB 연결을 확인하세요.

---

## 시드 데이터 재생성

테이블 생성 후 초기 데이터를 넣으려면:
```bash
cd src
npm run db:seed
```
