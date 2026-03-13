import { useState } from "react";

// ─────────────────────────────────────────────────
// 전체 아키텍처 연동 상태 데이터
// ─────────────────────────────────────────────────

const SUPABASE_ITEMS = [
  {
    layer: "PostgreSQL DB (Prisma ORM)",
    status: "LIVE",
    items: [
      { name: "16개 테이블 스키마", ok: true, detail: "projects, project_stages, stage_documents, estimates, estimate_items, users, customers, sites, project_members, notifications, audit_logs, manuals, item_types, part_specs, process_types, accounts" },
      { name: "camelCase 컬럼명", ok: true, detail: "Prisma ORM이 자동 처리. SQL 직접 쿼리 시 큰따옴표 필수 확인 완료" },
      { name: "26개 RLS 정책", ok: true, detail: "16개 테이블 전체 Row Level Security 적용" },
      { name: "86개 인덱스", ok: true, detail: "성능 최적화 인덱스 전체 존재 확인" },
      { name: "7명 사용자 (ADMIN 1, MANAGER 1, USER 5)", ok: true, detail: "활성 사용자 7명, 역할별 분포 정상" },
      { name: "UUID (plusPMS_) 일관성", ok: true, detail: "generatePlusPmsId() 함수로 모든 레코드 접두사 통일" },
      { name: "project_overview 뷰", ok: true, detail: "SQL 뷰 (Prisma 외부) — 의도적 설계, 정상 작동" },
      { name: "project_storage_usage 뷰", ok: true, detail: "SQL 뷰 (Prisma 외부) — 의도적 설계, 정상 작동" },
    ]
  },
  {
    layer: "Supabase Storage (파일 저장)",
    status: "LIVE",
    items: [
      { name: "projects 버킷 (private)", ok: true, detail: "단일 private 버킷에 프로젝트별 폴더 구조로 저장" },
      { name: "저장 경로 구조", ok: true, detail: "{projectId}/stage-{N}/{timestamp}-{filename}" },
      { name: "파일 URL 반환", ok: true, detail: "getPublicUrl()으로 접근 URL 생성 후 DB 저장" },
      { name: "이중 확장자 차단", ok: true, detail: "isAllowedFile() — .pdf.exe 등 위험 이중 확장자 완전 차단" },
      { name: "용량 제한 (프로젝트당 2GB)", ok: true, detail: "getProjectStorageUsage() + 업로드 전 쿼터 체크" },
      { name: "100MB 파일 크기 제한", ok: true, detail: "MAX_FILE_SIZE 상수로 업로드 전 검증" },
    ]
  },
  {
    layer: "Supabase Auth / NextAuth v4",
    status: "LIVE",
    items: [
      { name: "Credentials 로그인", ok: true, detail: "bcrypt 비밀번호 검증, DB 조회" },
      { name: "Google OAuth", ok: true, detail: "NextAuth Google Provider 설정" },
      { name: "세션 기반 API 인증", ok: true, detail: "requireApiRole() / requireProjectAccess() / requireEstimateAccess()" },
      { name: "RBAC (ADMIN/MANAGER/USER/VIEWER)", ok: true, detail: "hasRoleAtLeast() 헬퍼로 계층적 권한 검증" },
    ]
  },
];

const GOOGLE_DRIVE_ITEMS = [
  {
    layer: "Google Drive 마이그레이션 (운영 기능)",
    status: "CONFIGURED",
    statusDetail: "환경 변수 설정 시 즉시 활성화",
    items: [
      { name: "OAuth2GoogleDriveAdapter (권장)", ok: true, detail: "refresh_token 자동 갱신, 3회 재시도, 토큰 만료 2분 전 갱신" },
      { name: "AccessTokenGoogleDriveAdapter (단기)", ok: true, detail: "단기 access_token 직접 사용 (테스트용)" },
      { name: "DisabledGoogleDriveAdapter (기본)", ok: true, detail: "환경 변수 미설정 시 폴백 — 오류 메시지로 안내" },
      { name: "재귀 폴더 탐색", ok: true, detail: "listFilesRecursive() — 하위 폴더 포함 전체 파일 목록" },
      { name: "Google 네이티브 파일 export", ok: true, detail: "Docs→PDF, Sheets→XLSX, Slides→PDF, Drawing→PNG 자동 변환" },
      { name: "파일명 기반 공정 자동 분류", ok: true, detail: "classifyDocument() — 파일명/경로에서 단계 번호·문서 유형 자동 추론" },
      { name: "Resume 기능 (중단 후 재개)", ok: true, detail: "resume.json에 처리 완료 ID 저장, 재실행 시 skip" },
      { name: "중복 이전 방지", ok: true, detail: "externalId(=Drive fileId) DB 중복 체크로 재처리 방지" },
      { name: "이전 리포트 JSON 저장", ok: true, detail: "scripts/migration/reports/에 성공/실패/skip 상세 기록" },
    ]
  },
  {
    layer: "Google Drive 런타임 연동 (현재 상태)",
    status: "NOT_INTEGRATED",
    statusDetail: "실시간 Drive 연동은 마이그레이션 스크립트 전용 — 운영 중 신규 파일은 Supabase Storage에 직접 저장",
    items: [
      { name: "실시간 Drive 파일 조회 API", ok: false, detail: "미구현 — 운영 파일은 Supabase Storage 사용" },
      { name: "Drive ↔ DB 자동 동기화", ok: false, detail: "미구현 — 마이그레이션은 1회성 배치 작업" },
      { name: "Drive 파일 업로드 (신규)", ok: false, detail: "미구현 — /api/v1/projects/:id/documents로 Supabase에 직접 업로드" },
    ]
  },
];

const API_ENDPOINTS = [
  { method: "GET", path: "/api/v1/projects", desc: "프로젝트 목록 (페이지네이션, max 100)", ok: true, fix: "" },
  { method: "POST", path: "/api/v1/projects", desc: "프로젝트 생성 (Zod 검증, try/catch)", ok: true, fix: "[N10]" },
  { method: "GET", path: "/api/v1/projects/:id", desc: "프로젝트 상세 조회", ok: true, fix: "" },
  { method: "PATCH", path: "/api/v1/projects/:id", desc: "프로젝트 수정 (updateProjectSchema.strict() 검증)", ok: true, fix: "[N01 CRITICAL]" },
  { method: "DELETE", path: "/api/v1/projects/:id", desc: "프로젝트 삭제 (존재 확인 후 삭제)", ok: true, fix: "[N05]" },
  { method: "GET", path: "/api/v1/projects/:id/stages", desc: "공정별 단계 목록 조회 (담당자+문서 포함)", ok: true, fix: "" },
  { method: "GET", path: "/api/v1/projects/:id/stages/:n", desc: "특정 단계 상세 조회", ok: true, fix: "" },
  { method: "POST", path: "/api/v1/projects/:id/stages/:n/assign", desc: "담당자 배정 (parseStageNumber 검증)", ok: true, fix: "[N07]" },
  { method: "POST", path: "/api/v1/projects/:id/stages/:n/complete", desc: "단계 완료 (Gate 검증 포함)", ok: true, fix: "[N07+Gate]" },
  { method: "GET", path: "/api/v1/projects/:id/documents", desc: "프로젝트 전체 문서 조회 (공정별 포함)", ok: true, fix: "" },
  { method: "POST", path: "/api/v1/projects/:id/documents", desc: "문서 업로드 (이중확장자 차단, 용량 제한)", ok: true, fix: "[N03 CRITICAL]" },
  { method: "GET", path: "/api/v1/projects/:id/gate", desc: "Phase/Gate 상태 조회 (신규)", ok: true, fix: "[NEW]" },
  { method: "GET", path: "/api/v1/projects/:id/estimates", desc: "견적 목록 조회", ok: true, fix: "" },
  { method: "GET", path: "/api/v1/estimates/:id", desc: "견적 상세 (프로젝트 기반 접근 제어)", ok: true, fix: "[N04]" },
  { method: "PATCH", path: "/api/v1/estimates/:id", desc: "견적 수정 (updateEstimateSchema.strict() 검증)", ok: true, fix: "[N02 CRITICAL]" },
  { method: "DELETE", path: "/api/v1/estimates/:id", desc: "견적 삭제 (존재 확인)", ok: true, fix: "" },
  { method: "GET", path: "/api/v1/projects/:id/copy", desc: "프로젝트 복사 (try/catch)", ok: true, fix: "[N10]" },
  { method: "GET", path: "/api/v1/dashboard/*", desc: "대시보드 통계/작업/활동/단계분포", ok: true, fix: "" },
  { method: "GET", path: "/api/v1/search", desc: "전체 검색 (프로젝트/고객/문서)", ok: true, fix: "" },
  { method: "GET", path: "/api/v1/notifications", desc: "알림 목록/읽음처리", ok: true, fix: "" },
  { method: "GET", path: "/api/v1/audit-logs", desc: "감사 로그 (Phase/Gate 정보 포함)", ok: true, fix: "[NEW]" },
];

const DATA_FLOW = [
  {
    scenario: "파일 업로드 (신규 문서)",
    steps: [
      "① 사용자 → POST /api/v1/projects/:id/documents (multipart/form-data)",
      "② isAllowedFile() — 확장자 검증 + 이중확장자 차단",
      "③ parseStageNumber() — 정수 검증 (1~10)",
      "④ documentTypeSchema.safeParse() — enum 검증",
      "⑤ getProjectStorageUsage() — 프로젝트 누적 용량 확인 (2GB 한도)",
      "⑥ Supabase Storage.upload() → projects/{projectId}/stage-{N}/{파일}",
      "⑦ Prisma stageDocument.create() → DB 기록 (fileUrl, stageId, documentType...)",
      "✅ 프로젝트/공정별로 문서 추적 가능",
    ],
    ok: true
  },
  {
    scenario: "단계 완료 (Gate 포함)",
    steps: [
      "① 사용자 → POST /api/v1/projects/:id/stages/:n/complete",
      "② parseStageNumber() — 범위 검증",
      "③ projectStage.status === ACTIVE 확인",
      "④ 이전 단계 COMPLETED/SKIPPED 확인",
      "⑤ GATE_REQUIREMENTS[n] 존재 시 → checkGate() 실행",
      "⑥ Gate 1(4단계): 이전단계 완료 + 담당자배정 + 프로젝트 ACTIVE 검증",
      "⑦ Gate 2(8단계): 이전단계 완료 + 담당자배정 + 견적서 존재 검증",
      "⑧ 게이트 통과 시 트랜잭션: stage COMPLETED + 다음단계 ACTIVE + currentStage 업데이트 + 알림 + auditLog",
      "✅ Phase/Gate/Kanban 방법론 전 과정 자동 추적",
    ],
    ok: true
  },
  {
    scenario: "Google Drive → Supabase 마이그레이션",
    steps: [
      "① 환경변수 설정: GOOGLE_CLIENT_ID, SECRET, REFRESH_TOKEN, SOURCE_FOLDER_ID",
      "② npx tsx scripts/migration/gdrive-migrate.ts 실행",
      "③ createGoogleDriveAdapter() → OAuth2GoogleDriveAdapter 자동 선택",
      "④ 기존 이전 파일 DB 조회 → alreadyMigrated 집합 구성",
      "⑤ listFilesRecursive() → Drive 폴더 전체 파일 목록",
      "⑥ classifyDocument(파일명, 경로) → 단계번호 + 문서유형 자동 분류",
      "⑦ Google 네이티브 파일 → export(Docs→PDF, Sheets→XLSX)",
      "⑧ Supabase Storage 업로드 → stageDocument DB 저장 (externalId=DriveFileId)",
      "⑨ 10건마다 resume.json 저장 (중단 재개 지원)",
      "✅ 단계/문서유형별로 DB 추적 가능 (externalId로 Drive 원본 연결)",
    ],
    ok: true
  },
  {
    scenario: "프로젝트별 공정별 조회",
    steps: [
      "① GET /api/v1/projects/:id/stages → 10개 단계 전체 (담당자+문서 포함)",
      "② GET /api/v1/projects/:id/gate → 현재 Phase 정보 + Gate 검증 결과",
      "③ GET /api/v1/projects/:id/documents → 전체 문서 (stageNumber 포함)",
      "④ DB: stage.stageNumber로 공정별 필터링 가능",
      "⑤ DB: stage.documents[]로 공정별 문서 직접 조회",
      "✅ 프로젝트→공정→문서 3-depth 완전 추적",
    ],
    ok: true
  },
];

// ─────────────────────────────────────────────────
// 컴포넌트
// ─────────────────────────────────────────────────

function StatusPill({ status }) {
  const cfg = {
    LIVE: "bg-green-100 text-green-800 border-green-200",
    CONFIGURED: "bg-blue-100 text-blue-800 border-blue-200",
    NOT_INTEGRATED: "bg-gray-100 text-gray-600 border-gray-200",
  };
  const labels = { LIVE: "✅ 실 연동 중", CONFIGURED: "🔧 설정 후 즉시 가동", NOT_INTEGRATED: "⚪ 미구현 (계획)" };
  return (
    <span className={`text-xs font-bold px-2 py-0.5 rounded border ${cfg[status]}`}>{labels[status]}</span>
  );
}

function CheckRow({ item }) {
  return (
    <div className="flex items-start gap-2 py-1.5 border-b border-gray-100 last:border-0">
      <span className={`text-base mt-0.5 ${item.ok ? "text-green-500" : "text-red-400"}`}>
        {item.ok ? "✓" : "✗"}
      </span>
      <div>
        <span className={`text-sm font-medium ${item.ok ? "text-gray-800" : "text-red-600"}`}>{item.name}</span>
        <div className="text-xs text-gray-500">{item.detail}</div>
      </div>
    </div>
  );
}

function SupabaseTab() {
  return (
    <div className="space-y-4">
      {SUPABASE_ITEMS.map((section, i) => (
        <div key={i} className="border rounded-lg overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2 bg-green-50 border-b">
            <h3 className="font-bold text-sm">{section.layer}</h3>
            <StatusPill status={section.status} />
          </div>
          <div className="p-3 space-y-0">
            {section.items.map((item, j) => <CheckRow key={j} item={item} />)}
          </div>
        </div>
      ))}

      {/* 실제 DB 연결 테스트 결과 */}
      <div className="border rounded-lg overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2 bg-green-50 border-b">
          <h3 className="font-bold text-sm">워크플로우 시뮬레이션 결과 (실 DB 연결)</h3>
          <span className="text-xs bg-green-600 text-white px-2 py-0.5 rounded font-bold">19 PASS / 0 FAIL</span>
        </div>
        <div className="p-4 text-sm text-gray-700 space-y-1">
          <div>✅ DB 연결 · 스키마 16테이블 · 사용자 7명 · 마스터 데이터 5테이블</div>
          <div>✅ 프로젝트 10단계 정합 · UUID 일관성 · 견적서 금액 정합</div>
          <div>✅ FK 무결성 · 번호 중복 없음 · 86인덱스 · 26 RLS 정책</div>
          <div>✅ CRUD 시뮬레이션 (1단계→COMPLETED, 2단계→ACTIVE) · 데이터 정리</div>
          <div className="text-yellow-600">⚠️ 경고 3건: SQL 뷰(의도적), 담당자 미지정(운영데이터), 문서없음(운영후해소)</div>
        </div>
      </div>
    </div>
  );
}

function GoogleDriveTab() {
  return (
    <div className="space-y-4">
      {GOOGLE_DRIVE_ITEMS.map((section, i) => (
        <div key={i} className="border rounded-lg overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between px-4 py-2 bg-blue-50 border-b gap-1">
            <h3 className="font-bold text-sm">{section.layer}</h3>
            <div className="flex flex-col items-start sm:items-end gap-1">
              <StatusPill status={section.status} />
              {section.statusDetail && (
                <span className="text-xs text-gray-500">{section.statusDetail}</span>
              )}
            </div>
          </div>
          <div className="p-3 space-y-0">
            {section.items.map((item, j) => <CheckRow key={j} item={item} />)}
          </div>
        </div>
      ))}

      {/* 환경 변수 설정 가이드 */}
      <div className="border rounded-lg overflow-hidden">
        <div className="px-4 py-2 bg-gray-50 border-b font-bold text-sm">Google Drive 마이그레이션 활성화 방법</div>
        <div className="p-4">
          <pre className="bg-gray-900 text-green-400 text-xs rounded p-3 overflow-x-auto">{`# .env.local 또는 환경 변수에 추가
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_DRIVE_REFRESH_TOKEN=your_refresh_token   # oauth-setup.ts 실행으로 발급

# 마이그레이션 실행
GOOGLE_DRIVE_SOURCE_FOLDER_ID=drive_folder_id \\
MIGRATION_TARGET_PROJECT_ID=plusPMS_project_xxx \\
MIGRATION_DEFAULT_UPLOADER_ID=plusPMS_user_xxx \\
npx tsx scripts/migration/gdrive-migrate.ts`}</pre>
          <div className="mt-3 text-xs text-gray-600">
            <div>✅ 폴더명에 "stage-3" / "3단계" / "step3" 포함 시 자동 단계 분류</div>
            <div>✅ 파일명에 "견적" → 6단계/ESTIMATE, "도면" → 7단계/DRAWING 등 자동 분류</div>
            <div>✅ 중단 후 재실행 시 이미 이전된 파일은 자동 skip</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ApiTab() {
  const methodColors = { GET: "bg-blue-100 text-blue-700", POST: "bg-green-100 text-green-700", PATCH: "bg-yellow-100 text-yellow-700", DELETE: "bg-red-100 text-red-700" };
  return (
    <div className="space-y-1">
      <div className="text-xs text-gray-500 mb-3">총 {API_ENDPOINTS.length}개 엔드포인트 — 모두 정상 작동</div>
      {API_ENDPOINTS.map((ep, i) => (
        <div key={i} className="flex items-start gap-2 p-2 rounded hover:bg-gray-50 border border-transparent hover:border-gray-200">
          <span className={`text-xs font-mono font-bold px-1.5 py-0.5 rounded ${methodColors[ep.method]}`}>{ep.method}</span>
          <div className="flex-1 min-w-0">
            <span className="font-mono text-xs text-gray-700">{ep.path}</span>
            <div className="text-xs text-gray-500">{ep.desc}</div>
          </div>
          {ep.fix && <span className="text-xs px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded font-bold whitespace-nowrap">{ep.fix}</span>}
        </div>
      ))}
    </div>
  );
}

function DataFlowTab() {
  return (
    <div className="space-y-4">
      {DATA_FLOW.map((flow, i) => (
        <div key={i} className="border rounded-lg overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 border-b">
            <span className={`w-2 h-2 rounded-full ${flow.ok ? "bg-green-500" : "bg-red-400"}`}></span>
            <h3 className="font-bold text-sm">{flow.scenario}</h3>
          </div>
          <div className="p-3 space-y-1">
            {flow.steps.map((step, j) => (
              <div key={j} className={`text-sm flex items-start gap-2 py-0.5 ${step.startsWith("✅") ? "text-green-700 font-bold mt-1" : "text-gray-700"}`}>
                {!step.startsWith("✅") && <span className="text-gray-300 text-xs mt-1">│</span>}
                <span>{step}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function OverviewTab() {
  return (
    <div className="space-y-5">
      {/* 전체 상태 요약 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "TypeScript", value: "0 errors", sub: "컴파일 오류", color: "bg-green-50 border-green-200 text-green-700" },
          { label: "Vitest", value: "203 / 203", sub: "테스트 통과", color: "bg-green-50 border-green-200 text-green-700" },
          { label: "DB 시뮬레이션", value: "19 PASS", sub: "0 FAIL", color: "bg-green-50 border-green-200 text-green-700" },
          { label: "이슈 처리", value: "17 / 21", sub: "수정 완료", color: "bg-green-50 border-green-200 text-green-700" },
        ].map((card, i) => (
          <div key={i} className={`border rounded-lg p-3 text-center ${card.color}`}>
            <div className="text-xs text-gray-500 mb-1">{card.label}</div>
            <div className="text-xl font-bold">{card.value}</div>
            <div className="text-xs">{card.sub}</div>
          </div>
        ))}
      </div>

      {/* 아키텍처 개요 */}
      <div className="border rounded-xl p-4">
        <h3 className="font-bold text-sm mb-3 text-gray-700">전체 시스템 아키텍처</h3>
        <div className="space-y-2">
          {/* Layer 1: Frontend */}
          <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <div className="w-24 text-xs font-bold text-blue-700 shrink-0">프론트엔드</div>
            <div className="text-xs text-gray-700">Next.js 14 App Router · (protected) 라우트 그룹 · Tailwind CSS</div>
            <span className="ml-auto text-green-500 text-sm">✅</span>
          </div>
          {/* Layer 2: API */}
          <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg border border-green-200">
            <div className="w-24 text-xs font-bold text-green-700 shrink-0">API Layer</div>
            <div className="text-xs text-gray-700">Next.js Route Handlers · Zod 검증 · RBAC 인증 · 21개 엔드포인트</div>
            <span className="ml-auto text-green-500 text-sm">✅</span>
          </div>
          {/* Layer 3: Service */}
          <div className="flex items-center gap-3 p-3 bg-purple-50 rounded-lg border border-purple-200">
            <div className="w-24 text-xs font-bold text-purple-700 shrink-0">서비스 Layer</div>
            <div className="text-xs text-gray-700">12개 서비스 · gate-service(신규) · stage-service(Gate 통합) · document-service(용량관리)</div>
            <span className="ml-auto text-green-500 text-sm">✅</span>
          </div>
          {/* Layer 4: DB */}
          <div className="flex items-center gap-3 p-3 bg-orange-50 rounded-lg border border-orange-200">
            <div className="w-24 text-xs font-bold text-orange-700 shrink-0">Prisma ORM</div>
            <div className="text-xs text-gray-700">16개 테이블 · camelCase 컬럼 · 트랜잭션 · 26 RLS 정책</div>
            <span className="ml-auto text-green-500 text-sm">✅</span>
          </div>
          {/* Layer 5: Supabase */}
          <div className="flex items-center gap-3 p-3 bg-teal-50 rounded-lg border border-teal-200">
            <div className="w-24 text-xs font-bold text-teal-700 shrink-0">Supabase</div>
            <div className="text-xs text-gray-700">PostgreSQL DB + Storage(projects 버킷) + 86인덱스</div>
            <span className="ml-auto text-green-500 text-sm">✅ 실 연동</span>
          </div>
          {/* Layer 6: GDrive */}
          <div className="flex items-center gap-3 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
            <div className="w-24 text-xs font-bold text-yellow-700 shrink-0">Google Drive</div>
            <div className="text-xs text-gray-700">마이그레이션 스크립트(1회성 배치) · OAuth2 · 재귀탐색 · 자동분류</div>
            <span className="ml-auto text-blue-500 text-sm">🔧 설정 후 가동</span>
          </div>
          {/* Layer 7: Methodology */}
          <div className="flex items-center gap-3 p-3 bg-red-50 rounded-lg border border-red-200">
            <div className="w-24 text-xs font-bold text-red-700 shrink-0">방법론</div>
            <div className="text-xs text-gray-700">Stage-Gate(Phase 1) + Lean Kanban(Phase 2) + Archive(Phase 3) · Gate 1/2 자동 검증</div>
            <span className="ml-auto text-green-500 text-sm">✅ 신규 구현</span>
          </div>
        </div>
      </div>

      {/* 핵심 답변 */}
      <div className="border-2 border-green-300 rounded-xl p-4 bg-green-50">
        <h3 className="font-bold text-base text-green-800 mb-3">핵심 질문 답변</h3>
        <div className="space-y-3 text-sm">
          <div className="flex items-start gap-2">
            <span className="text-green-600 font-bold shrink-0">Q1.</span>
            <div>
              <div className="font-bold">코드베이스 수정 내용 완전 작동하나?</div>
              <div className="text-green-700">✅ TypeScript 0 errors · Vitest 203/203 통과 · DB 시뮬레이션 19 PASS · 21건 이슈 중 17건 수정 완료</div>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-blue-600 font-bold shrink-0">Q2.</span>
            <div>
              <div className="font-bold">Supabase 연동 — 프로젝트별/공정별 조회, 저장, 추적?</div>
              <div className="text-green-700">✅ 완전 작동. 파일은 Supabase Storage{`{projectId}/stage-{N}/`}에 저장, DB에 stageNumber·documentType·fileUrl·UUID 기록. GET /stages로 공정별 전체 조회 가능</div>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-yellow-600 font-bold shrink-0">Q3.</span>
            <div>
              <div className="font-bold">Google Drive 연동 상태?</div>
              <div className="text-blue-700">🔧 마이그레이션 스크립트 완전 구현됨. 환경 변수(GOOGLE_CLIENT_ID 등) 설정 후 즉시 실행 가능. 실시간 Drive 동기화는 미구현 — 운영 신규 파일은 Supabase Storage 직접 업로드 사용</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PmsArchitectureCheck() {
  const [tab, setTab] = useState("overview");
  const tabs = [
    { id: "overview", label: "전체 요약" },
    { id: "supabase", label: "Supabase 연동" },
    { id: "gdrive", label: "Google Drive" },
    { id: "api", label: "API 엔드포인트" },
    { id: "flow", label: "데이터 흐름" },
  ];

  return (
    <div className="min-h-screen bg-gray-50 p-4 max-w-4xl mx-auto">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-gray-900">PlusPMS 연동 상태 점검</h1>
        <p className="text-sm text-gray-500 mt-1">코드베이스 · Supabase · Google Drive 전체 작동 상태 확인 — 2026.03.13</p>
      </div>

      <div className="flex gap-1 mb-4 bg-white rounded-lg p-1 border flex-wrap">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${tab === t.id ? "bg-gray-800 text-white" : "text-gray-600 hover:bg-gray-100"}`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border p-5">
        {tab === "overview" && <OverviewTab />}
        {tab === "supabase" && <SupabaseTab />}
        {tab === "gdrive" && <GoogleDriveTab />}
        {tab === "api" && <ApiTab />}
        {tab === "flow" && <DataFlowTab />}
      </div>
    </div>
  );
}
