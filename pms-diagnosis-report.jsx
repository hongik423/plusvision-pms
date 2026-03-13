import React, { useState } from 'react';

const CATEGORIES = {
  SIM: '워크플로우 시뮬레이션',
  SEC: '보안 취약점',
  API: 'API 엔드포인트',
  DATA: '데이터 무결성',
  PERF: '성능/인프라',
  LOGIC: '비즈니스 로직',
};

const SEVERITY_COLORS = {
  CRITICAL: { bg: '#DC2626', text: '#FFF' },
  HIGH: { bg: '#EA580C', text: '#FFF' },
  MEDIUM: { bg: '#D97706', text: '#FFF' },
  LOW: { bg: '#2563EB', text: '#FFF' },
  PASS: { bg: '#16A34A', text: '#FFF' },
  WARN: { bg: '#CA8A04', text: '#FFF' },
  FIXED: { bg: '#059669', text: '#FFF' },
};

// ===== 시뮬레이션 결과 =====
const simResults = [
  { step: '1-DB연결', status: 'PASS', msg: 'Supabase PostgreSQL 연결 성공', time: 1354 },
  { step: '2-스키마', status: 'PASS', msg: '필수 테이블 16개 모두 존재', time: 276 },
  { step: '2-추가테이블', status: 'WARN', msg: 'project_overview, project_storage_usage 뷰가 스키마 미정의 (의도된 설계)' },
  { step: '3-사용자', status: 'PASS', msg: '총 7명 (활성7, ADMIN:1, MANAGER:1, USER:5)', time: 280 },
  { step: '4-마스터', status: 'PASS', msg: '5개 마스터 테이블 데이터 존재', time: 1360 },
  { step: '5-프로젝트', status: 'PASS', msg: '2개 프로젝트, 전체 10단계 정합', time: 274 },
  { step: '6-UUID', status: 'PASS', msg: 'plusPMS_ 접두사 일관성 확인', time: 1373 },
  { step: '7-워크플로우', status: 'WARN', msg: '활성 단계 1에 담당자 미지정', time: 271 },
  { step: '8-견적서', status: 'PASS', msg: '견적 금액 정합성 확인', time: 300 },
  { step: '9-문서', status: 'WARN', msg: '문서 데이터 없음 (아직 업로드 전)' },
  { step: '10-알림', status: 'PASS', msg: '1건 알림 정상 동작', time: 271 },
  { step: '11-감사로그', status: 'PASS', msg: '3건 감사 로그 (고아 없음)', time: 543 },
  { step: '12-동기화', status: 'PASS', msg: 'currentStage 동기화 정상', time: 272 },
  { step: '13-FK정합', status: 'PASS', msg: '전체 외래키 정합성 확인', time: 1744 },
  { step: '14-번호중복', status: 'PASS', msg: '프로젝트/견적 번호 중복 없음', time: 276 },
  { step: '15-인덱스', status: 'PASS', msg: '86개 인덱스 정상', time: 273 },
  { step: '16-스토리지', status: 'PASS', msg: 'projects 버킷 확인', time: 278 },
  { step: '17-RLS', status: 'PASS', msg: '26개 RLS 정책 (16개 테이블)', time: 278 },
  { step: '18-CRUD', status: 'PASS', msg: '프로젝트 CRUD + 단계 진행 시뮬레이션 성공', time: 6355 },
  { step: '19-견적CRUD', status: 'PASS', msg: '견적서 CRUD + 금액 정합 확인', time: 1573 },
  { step: '20-정리', status: 'PASS', msg: '시뮬레이션 데이터 정리 완료', time: 1657 },
];

// ===== 발견된 이슈 =====
const allIssues = [
  // 이전 세션에서 이미 수정 완료
  { id: 'F01', cat: 'SEC', sev: 'CRITICAL', status: 'FIXED', title: '프로덕션 데모 계정 접근 가능', desc: 'admin/admin 계정이 프로덕션에서도 사용 가능했음', fix: 'IS_PRODUCTION 가드 추가, DEMO_LOGIN_ENABLED 기본값 false로 변경', file: 'src/lib/auth.ts' },
  { id: 'F02', cat: 'LOGIC', sev: 'CRITICAL', status: 'FIXED', title: 'completeStage 이중 currentStage 업데이트', desc: '단계 완료 시 currentStage가 두 번 업데이트되어 데이터 불일치 발생', fix: 'if/else 블록 내 단일 업데이트로 통합', file: 'src/services/stage-service.ts' },
  { id: 'F03', cat: 'SEC', sev: 'HIGH', status: 'FIXED', title: '견적서 권한 우회', desc: '모든 USER가 타인의 견적서 수정 가능', fix: 'requireEstimateAccess() 함수 추가', file: 'src/lib/api-auth.ts' },
  { id: 'F04', cat: 'DATA', sev: 'HIGH', status: 'FIXED', title: '검색 시 Invalid Date 객체 전달', desc: '유효하지 않은 날짜 문자열이 Prisma로 직접 전달', fix: 'isValidDateString() 유효성 검사 추가', file: 'src/services/search-service.ts' },
  { id: 'F05', cat: 'DATA', sev: 'HIGH', status: 'FIXED', title: '프로젝트/견적 번호 동시성 중복', desc: 'count() 기반 번호 생성으로 동시 요청 시 중복 가능', fix: 'findFirst(orderBy: desc) 방식으로 변경', file: 'src/services/project-service.ts' },
  { id: 'F06', cat: 'SEC', sev: 'HIGH', status: 'FIXED', title: '비밀번호 재설정 토큰 시크릿 누락', desc: '프로덕션에서 NEXTAUTH_SECRET 미설정 시 기본값 사용', fix: '프로덕션 환경 시크릿 필수 체크 추가', file: 'src/lib/reset-token.ts' },
  { id: 'F07', cat: 'PERF', sev: 'MEDIUM', status: 'FIXED', title: 'Google Drive OAuth 토큰 갱신 실패', desc: '장시간 마이그레이션 중 토큰 만료 시 즉시 실패', fix: '최대 3회 지수 백오프 재시도 로직 추가', file: 'src/scripts/migration/google-drive-adapter.ts' },
  { id: 'F08', cat: 'DATA', sev: 'MEDIUM', status: 'FIXED', title: '견적 금액 부동소수점 오차', desc: 'quantity * unitPrice 계산에서 소수점 오차 누적 가능', fix: 'Math.round() 적용 및 taxRate 파라미터화', file: 'src/services/estimate-service.ts' },

  // 이번 진단에서 새로 발견된 미수정 이슈
  { id: 'N01', cat: 'API', sev: 'CRITICAL', title: 'PATCH /projects/[id] 입력 검증 없음', desc: '프로젝트 업데이트 시 raw body 그대로 전달. status, createdById 등 임의 필드 수정 가능', fix: 'Zod 스키마 검증 추가 필요', file: 'src/app/api/v1/projects/[id]/route.ts' },
  { id: 'N02', cat: 'API', sev: 'CRITICAL', title: 'PATCH /estimates/[estId] 입력 검증 없음', desc: '견적서 업데이트 시 raw body 전달. 금액, createdById 등 조작 가능', fix: 'Zod 스키마로 허용 필드 제한 필요', file: 'src/app/api/v1/estimates/[estId]/route.ts' },
  { id: 'N03', cat: 'SEC', sev: 'CRITICAL', title: '파일 업로드 확장자 검증 우회', desc: '.pdf.exe 같은 이중 확장자가 endsWith 검사 통과 가능', fix: '파일명에서 최종 확장자만 추출하는 로직 필요', file: 'src/app/api/v1/projects/[id]/documents/route.ts' },
  { id: 'N04', cat: 'API', sev: 'HIGH', title: 'GET /estimates/[estId] 프로젝트 접근 검증 누락', desc: 'VIEWER가 모든 견적서 조회 가능 (프로젝트 멤버 여부 무관)', fix: 'requireEstimateAccess() 적용 필요', file: 'src/app/api/v1/estimates/[estId]/route.ts' },
  { id: 'N05', cat: 'API', sev: 'HIGH', title: '프로젝트 삭제 NOT_FOUND 미처리', desc: '존재하지 않는 프로젝트 삭제 시 500 에러', fix: '존재 여부 선 확인 후 404 응답', file: 'src/app/api/v1/projects/[id]/route.ts' },
  { id: 'N06', cat: 'API', sev: 'HIGH', title: '문서 업로드 프로젝트 용량 제한 미적용', desc: 'MAX_PROJECT_STORAGE(2GB) 미검증. 100MB × 20+ 가능', fix: '업로드 전 프로젝트별 총 용량 확인 로직', file: 'src/app/api/v1/projects/[id]/documents/route.ts' },
  { id: 'N07', cat: 'API', sev: 'HIGH', title: 'stageNumber NaN 처리 미비', desc: 'Number("abc") = NaN이 서비스까지 전달됨', fix: '라우트 레벨에서 정수 검증 필수', file: 'src/app/api/v1/projects/[id]/stages/*/route.ts' },
  { id: 'N08', cat: 'SEC', sev: 'MEDIUM', title: '파일 MIME 타입 미검증', desc: '확장자만 확인, 실제 파일 내용 미검증', fix: 'magic bytes 검사 또는 파일 헤더 검증', file: 'src/app/api/v1/projects/[id]/documents/route.ts' },
  { id: 'N09', cat: 'API', sev: 'MEDIUM', title: 'documentType enum 미검증', desc: 'as DocumentType 캐스팅만으로 유효성 미보장', fix: 'DocumentType enum 값 목록 대조 필요', file: 'src/app/api/v1/projects/[id]/documents/route.ts' },
  { id: 'N10', cat: 'API', sev: 'MEDIUM', title: 'POST/PATCH 다수 라우트에 try/catch 없음', desc: '5개 이상 라우트에서 에러 핸들링 미비', fix: '공통 에러 핸들러 미들웨어 적용', file: 'src/app/api/v1/projects/*/route.ts' },
  { id: 'N11', cat: 'DATA', sev: 'MEDIUM', title: '활성 단계 담당자 미지정', desc: '시뮬레이션에서 발견: 활성 1단계에 assigneeId 없음', fix: '단계 활성화 시 담당자 필수 검증', file: 'src/services/stage-service.ts' },
  { id: 'N12', cat: 'PERF', sev: 'LOW', title: '페이지네이션 limit 상한 없음', desc: 'limit=999999 요청으로 전체 DB 덤프 가능', fix: 'MAX_PAGE_SIZE = 100 상한 적용', file: 'src/app/api/v1/projects/route.ts' },
  { id: 'N13', cat: 'PERF', sev: 'LOW', title: 'Supabase 스토리지 버킷명 불일치', desc: '코드에서 pms-documents 참조하나 실제 버킷은 projects', fix: '버킷명 상수화 및 일치 확인', file: 'src/lib/supabase.ts' },
];

const StatusBadge = ({ status, size = 'sm' }) => {
  const colors = SEVERITY_COLORS[status] || { bg: '#6B7280', text: '#FFF' };
  const pad = size === 'sm' ? '2px 8px' : '4px 12px';
  const fontSize = size === 'sm' ? '11px' : '13px';
  return (
    <span style={{
      background: colors.bg, color: colors.text,
      padding: pad, borderRadius: '4px', fontWeight: 700, fontSize, letterSpacing: '0.5px'
    }}>
      {status}
    </span>
  );
};

export default function DiagnosisReport() {
  const [activeTab, setActiveTab] = useState('overview');
  const [filterSev, setFilterSev] = useState('ALL');
  const [filterCat, setFilterCat] = useState('ALL');
  const [expandedIssue, setExpandedIssue] = useState(null);

  const passCount = simResults.filter(r => r.status === 'PASS').length;
  const warnCount = simResults.filter(r => r.status === 'WARN').length;
  const failCount = simResults.filter(r => r.status === 'FAIL').length;

  const fixedCount = allIssues.filter(i => i.status === 'FIXED').length;
  const openIssues = allIssues.filter(i => i.status !== 'FIXED');
  const critCount = openIssues.filter(i => i.sev === 'CRITICAL').length;
  const highCount = openIssues.filter(i => i.sev === 'HIGH').length;
  const medCount = openIssues.filter(i => i.sev === 'MEDIUM').length;
  const lowCount = openIssues.filter(i => i.sev === 'LOW').length;

  const filteredIssues = allIssues.filter(i =>
    (filterSev === 'ALL' || i.sev === filterSev) &&
    (filterCat === 'ALL' || i.cat === filterCat)
  );

  const tabs = [
    { id: 'overview', label: '종합 현황' },
    { id: 'simulation', label: '시뮬레이션 결과' },
    { id: 'issues', label: `이슈 목록 (${allIssues.length})` },
    { id: 'infra', label: '인프라 상태' },
  ];

  return (
    <div style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', background: '#F1F5F9', minHeight: '100vh', padding: '24px' }}>
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #1E293B 0%, #334155 100%)', borderRadius: '12px', padding: '32px', marginBottom: '24px', color: '#FFF' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 800, letterSpacing: '-0.5px' }}>PlusPMS 종합 오류 진단 보고서</h1>
            <p style={{ margin: '8px 0 0', color: '#94A3B8', fontSize: '14px' }}>프로젝트 관리 시스템 | 전체 워크플로우 시뮬레이션 + API 감사 + 데이터 무결성 검증</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '12px', color: '#94A3B8' }}>진단 일시</div>
            <div style={{ fontSize: '16px', fontWeight: 600 }}>2026-03-13</div>
          </div>
        </div>

        {/* Summary Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px', marginTop: '24px' }}>
          {[
            { label: '시뮬레이션', value: `${passCount}/${simResults.length}`, sub: '통과', color: '#22C55E' },
            { label: '수정 완료', value: fixedCount, sub: '건', color: '#06B6D4' },
            { label: 'CRITICAL', value: critCount, sub: '미해결', color: critCount > 0 ? '#EF4444' : '#22C55E' },
            { label: 'HIGH', value: highCount, sub: '미해결', color: highCount > 0 ? '#F97316' : '#22C55E' },
            { label: 'MEDIUM+LOW', value: medCount + lowCount, sub: '미해결', color: '#EAB308' },
          ].map((card, i) => (
            <div key={i} style={{ background: 'rgba(255,255,255,0.1)', borderRadius: '8px', padding: '16px', backdropFilter: 'blur(4px)' }}>
              <div style={{ fontSize: '12px', color: '#94A3B8', marginBottom: '4px' }}>{card.label}</div>
              <div style={{ fontSize: '28px', fontWeight: 800, color: card.color }}>{card.value}</div>
              <div style={{ fontSize: '11px', color: '#64748B' }}>{card.sub}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', background: '#E2E8F0', borderRadius: '8px', padding: '4px' }}>
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
            flex: 1, padding: '10px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, fontSize: '13px',
            background: activeTab === tab.id ? '#FFF' : 'transparent',
            color: activeTab === tab.id ? '#1E293B' : '#64748B',
            boxShadow: activeTab === tab.id ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
          }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ===== 종합 현황 탭 ===== */}
      {activeTab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          {/* 테스트 현황 도넛 */}
          <div style={{ background: '#FFF', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: '16px', color: '#1E293B' }}>테스트 결과 요약</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
              <svg width="120" height="120" viewBox="0 0 120 120">
                <circle cx="60" cy="60" r="50" fill="none" stroke="#E2E8F0" strokeWidth="12" />
                <circle cx="60" cy="60" r="50" fill="none" stroke="#22C55E" strokeWidth="12"
                  strokeDasharray={`${(passCount / simResults.length) * 314} 314`}
                  strokeDashoffset="0" transform="rotate(-90 60 60)" strokeLinecap="round" />
                <text x="60" y="55" textAnchor="middle" fontSize="24" fontWeight="800" fill="#1E293B">{Math.round((passCount / simResults.length) * 100)}%</text>
                <text x="60" y="72" textAnchor="middle" fontSize="11" fill="#64748B">통과율</text>
              </svg>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#22C55E' }} />
                  <span style={{ fontSize: '14px' }}>통과: {passCount}건</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#EAB308' }} />
                  <span style={{ fontSize: '14px' }}>경고: {warnCount}건</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#EF4444' }} />
                  <span style={{ fontSize: '14px' }}>실패: {failCount}건</span>
                </div>
              </div>
            </div>
          </div>

          {/* 이슈 현황 */}
          <div style={{ background: '#FFF', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: '16px', color: '#1E293B' }}>이슈 심각도 분포</h3>
            {[
              { label: 'CRITICAL', total: allIssues.filter(i=>i.sev==='CRITICAL').length, fixed: allIssues.filter(i=>i.sev==='CRITICAL'&&i.status==='FIXED').length, color: '#DC2626' },
              { label: 'HIGH', total: allIssues.filter(i=>i.sev==='HIGH').length, fixed: allIssues.filter(i=>i.sev==='HIGH'&&i.status==='FIXED').length, color: '#EA580C' },
              { label: 'MEDIUM', total: allIssues.filter(i=>i.sev==='MEDIUM').length, fixed: allIssues.filter(i=>i.sev==='MEDIUM'&&i.status==='FIXED').length, color: '#D97706' },
              { label: 'LOW', total: allIssues.filter(i=>i.sev==='LOW').length, fixed: allIssues.filter(i=>i.sev==='LOW'&&i.status==='FIXED').length, color: '#2563EB' },
            ].map((item, i) => (
              <div key={i} style={{ marginBottom: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '4px' }}>
                  <span style={{ fontWeight: 600 }}>{item.label}</span>
                  <span style={{ color: '#64748B' }}>{item.fixed}/{item.total} 수정</span>
                </div>
                <div style={{ background: '#F1F5F9', borderRadius: '4px', height: '8px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${item.total > 0 ? (item.fixed / item.total) * 100 : 0}%`, background: item.color, borderRadius: '4px', transition: 'width 0.5s' }} />
                </div>
              </div>
            ))}
          </div>

          {/* 카테고리별 현황 */}
          <div style={{ background: '#FFF', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', gridColumn: '1/3' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: '16px', color: '#1E293B' }}>카테고리별 이슈 현황</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '12px' }}>
              {Object.entries(CATEGORIES).map(([key, label]) => {
                const catIssues = allIssues.filter(i => i.cat === key);
                const catFixed = catIssues.filter(i => i.status === 'FIXED').length;
                return (
                  <div key={key} style={{ background: '#F8FAFC', borderRadius: '8px', padding: '16px', textAlign: 'center', border: '1px solid #E2E8F0' }}>
                    <div style={{ fontSize: '11px', color: '#64748B', marginBottom: '8px' }}>{label}</div>
                    <div style={{ fontSize: '24px', fontWeight: 800, color: '#1E293B' }}>{catIssues.length}</div>
                    <div style={{ fontSize: '11px', color: catFixed === catIssues.length ? '#16A34A' : '#D97706' }}>
                      {catFixed}/{catIssues.length} 수정
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ===== 시뮬레이션 결과 탭 ===== */}
      {activeTab === 'simulation' && (
        <div style={{ background: '#FFF', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ margin: 0, fontSize: '16px', color: '#1E293B' }}>Supabase DB 워크플로우 시뮬레이션 (22개 테스트)</h3>
            <div style={{ display: 'flex', gap: '8px' }}>
              <StatusBadge status="PASS" /> <span style={{ fontSize: '13px' }}>{passCount}</span>
              <StatusBadge status="WARN" /> <span style={{ fontSize: '13px' }}>{warnCount}</span>
            </div>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #E2E8F0' }}>
                <th style={{ padding: '10px 12px', textAlign: 'left', color: '#64748B', fontWeight: 600 }}>단계</th>
                <th style={{ padding: '10px 12px', textAlign: 'center', color: '#64748B', fontWeight: 600, width: '80px' }}>결과</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', color: '#64748B', fontWeight: 600 }}>상세</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', color: '#64748B', fontWeight: 600, width: '80px' }}>시간</th>
              </tr>
            </thead>
            <tbody>
              {simResults.map((r, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #F1F5F9', background: r.status === 'WARN' ? '#FFFBEB' : i % 2 === 0 ? '#FFF' : '#F8FAFC' }}>
                  <td style={{ padding: '10px 12px', fontWeight: 600, fontFamily: 'monospace' }}>{r.step}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'center' }}><StatusBadge status={r.status} /></td>
                  <td style={{ padding: '10px 12px', color: '#374151' }}>{r.msg}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace', color: '#64748B' }}>{r.time ? `${r.time}ms` : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ===== 이슈 목록 탭 ===== */}
      {activeTab === 'issues' && (
        <div>
          {/* Filters */}
          <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
            <select value={filterSev} onChange={e => setFilterSev(e.target.value)} style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #D1D5DB', fontSize: '13px', background: '#FFF' }}>
              <option value="ALL">전체 심각도</option>
              {['CRITICAL','HIGH','MEDIUM','LOW'].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={filterCat} onChange={e => setFilterCat(e.target.value)} style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #D1D5DB', fontSize: '13px', background: '#FFF' }}>
              <option value="ALL">전체 카테고리</option>
              {Object.entries(CATEGORIES).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <div style={{ marginLeft: 'auto', fontSize: '13px', color: '#64748B', alignSelf: 'center' }}>
              {filteredIssues.length}건 표시
            </div>
          </div>

          {/* Issue Cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {filteredIssues.map((issue) => (
              <div key={issue.id} onClick={() => setExpandedIssue(expandedIssue === issue.id ? null : issue.id)}
                style={{
                  background: '#FFF', borderRadius: '8px', padding: '16px', cursor: 'pointer',
                  borderLeft: `4px solid ${SEVERITY_COLORS[issue.sev]?.bg || '#6B7280'}`,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                  opacity: issue.status === 'FIXED' ? 0.7 : 1,
                }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontFamily: 'monospace', fontSize: '12px', color: '#64748B', width: '36px' }}>{issue.id}</span>
                    <StatusBadge status={issue.sev} />
                    {issue.status === 'FIXED' && <StatusBadge status="FIXED" />}
                    <span style={{ fontWeight: 600, fontSize: '14px', color: '#1E293B' }}>{issue.title}</span>
                  </div>
                  <span style={{ fontSize: '11px', color: '#94A3B8', background: '#F1F5F9', padding: '2px 8px', borderRadius: '4px' }}>
                    {CATEGORIES[issue.cat]}
                  </span>
                </div>
                {expandedIssue === issue.id && (
                  <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #F1F5F9' }}>
                    <div style={{ fontSize: '13px', color: '#374151', marginBottom: '8px' }}>{issue.desc}</div>
                    <div style={{ fontSize: '13px', marginBottom: '4px' }}>
                      <span style={{ color: '#64748B' }}>수정 방안: </span>
                      <span style={{ color: '#059669', fontWeight: 500 }}>{issue.fix}</span>
                    </div>
                    <div style={{ fontSize: '12px', fontFamily: 'monospace', color: '#94A3B8' }}>{issue.file}</div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===== 인프라 상태 탭 ===== */}
      {activeTab === 'infra' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <div style={{ background: '#FFF', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: '16px', color: '#1E293B' }}>데이터베이스</h3>
            {[
              { label: 'DB 엔진', value: 'PostgreSQL (Supabase)' },
              { label: 'ORM', value: 'Prisma 5.22' },
              { label: '테이블 수', value: '18개 (16 테이블 + 2 뷰)' },
              { label: '인덱스 수', value: '86개' },
              { label: 'RLS 정책', value: '26개 (16개 테이블)' },
              { label: '데이터 현황', value: '프로젝트 2건, 사용자 7명' },
            ].map((item, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #F1F5F9', fontSize: '13px' }}>
                <span style={{ color: '#64748B' }}>{item.label}</span>
                <span style={{ fontWeight: 600, color: '#1E293B' }}>{item.value}</span>
              </div>
            ))}
          </div>

          <div style={{ background: '#FFF', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: '16px', color: '#1E293B' }}>어플리케이션</h3>
            {[
              { label: '프레임워크', value: 'Next.js 14 (App Router)' },
              { label: '인증', value: 'NextAuth v4 (Credentials + Google)' },
              { label: 'API 라우트', value: '47개 엔드포인트' },
              { label: '유닛 테스트', value: '203/203 통과 (Vitest)' },
              { label: 'TypeScript', value: '0 에러' },
              { label: '스토리지', value: 'Supabase Storage (projects 버킷)' },
            ].map((item, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #F1F5F9', fontSize: '13px' }}>
                <span style={{ color: '#64748B' }}>{item.label}</span>
                <span style={{ fontWeight: 600, color: '#1E293B' }}>{item.value}</span>
              </div>
            ))}
          </div>

          <div style={{ background: '#FFF', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', gridColumn: '1/3' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: '16px', color: '#1E293B' }}>마스터 데이터 현황</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px' }}>
              {[
                { label: '고객사', count: 1, table: 'customers' },
                { label: '현장', count: 4, table: 'sites' },
                { label: '공정유형', count: 6, table: 'process_types' },
                { label: '품목유형', count: 6, table: 'item_types' },
                { label: '부품규격', count: 10, table: 'part_specs' },
              ].map((item, i) => (
                <div key={i} style={{ textAlign: 'center', background: '#F0FDF4', borderRadius: '8px', padding: '16px' }}>
                  <div style={{ fontSize: '24px', fontWeight: 800, color: '#16A34A' }}>{item.count}</div>
                  <div style={{ fontSize: '12px', color: '#64748B', marginTop: '4px' }}>{item.label}</div>
                  <div style={{ fontSize: '10px', fontFamily: 'monospace', color: '#94A3B8' }}>{item.table}</div>
                </div>
              ))}
            </div>
          </div>

          {/* 우선 수정 권고 */}
          <div style={{ background: 'linear-gradient(135deg, #FEF2F2, #FFF)', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', gridColumn: '1/3', border: '1px solid #FEE2E2' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: '16px', color: '#DC2626' }}>우선 수정 권고 (CRITICAL 미해결 3건)</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
              {openIssues.filter(i => i.sev === 'CRITICAL').map((issue, i) => (
                <div key={i} style={{ background: '#FFF', borderRadius: '8px', padding: '16px', border: '1px solid #FECACA' }}>
                  <div style={{ fontWeight: 700, fontSize: '14px', color: '#DC2626', marginBottom: '8px' }}>{issue.id}: {issue.title}</div>
                  <div style={{ fontSize: '12px', color: '#374151', marginBottom: '8px' }}>{issue.desc}</div>
                  <div style={{ fontSize: '12px', color: '#059669' }}>→ {issue.fix}</div>
                  <div style={{ fontSize: '11px', fontFamily: 'monospace', color: '#94A3B8', marginTop: '6px' }}>{issue.file}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div style={{ textAlign: 'center', marginTop: '32px', padding: '16px', color: '#94A3B8', fontSize: '12px' }}>
        PlusPMS 종합 오류 진단 보고서 | 진단 일시: 2026-03-13 | Supabase PostgreSQL 직접 시뮬레이션 + 코드 감사 + 데이터 무결성 검증
      </div>
    </div>
  );
}
