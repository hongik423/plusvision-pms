import { useState, useMemo } from "react";

// ─── 데이터 정의 ────────────────────────────────────────────
const CURRENT_GDRIVE = {
  title: "현재 Google Drive 폴더 양식",
  structure: [
    { num: 1, name: "제안서", type: "영업 문서" },
    { num: 2, name: "견적서 & 발주서 (User)", type: "재무 문서" },
    { num: 3, name: "관련 자료", type: "참조 문서" },
    { num: 4, name: "협력업체 견적서", type: "외주 문서" },
    { num: 5, name: "협력업체 발주서", type: "외주 문서" },
    { num: 6, name: "작업일지", type: "작업 기록" },
    { num: 7, name: "관련 사진", type: "현장 기록" },
    { num: 8, name: "도면", type: "설계 문서" },
    { num: 9, name: "파트리스트", type: "자재 관리" },
    { num: 10, name: "작업 매뉴얼", type: "기술 문서" },
  ],
};

const CURRENT_PMS = {
  title: "현재 PMS 10단계 프로세스",
  stages: [
    { num: 1, name: "의뢰 접수", desc: "의뢰 내용을 접수하고 기록", docs: ["접수 폼", "의뢰 내용 기록"] },
    { num: 2, name: "담당자 지정", desc: "프로젝트 각 단계의 담당자를 지정", docs: [] },
    { num: 3, name: "고객 협의", desc: "고객(담당자)과 협의하고 현장 확인", docs: ["현장 사진", "반출 기록", "회의록"] },
    { num: 4, name: "진행 여부 결정", desc: "프로젝트 진행 여부 결정 (진행/보류/취소)", docs: [] },
    { num: 5, name: "채권 등록", desc: "채권을 등록하거나 신규 채권 처리", docs: ["채권 등록 서류"] },
    { num: 6, name: "견적 작성", desc: "견적서를 작성 (부품 선택, 금액 산정)", docs: ["견적서"] },
    { num: 7, name: "제작", desc: "제작을 진행하고 매뉴얼과 부품 리스트 정리", docs: ["제작 매뉴얼", "부품 리스트", "도면"] },
    { num: 8, name: "납품/설치", desc: "납품 및 설치를 진행하고 설치 매뉴얼 작성", docs: ["설치 매뉴얼", "납품 확인서"] },
    { num: 9, name: "실적 입력", desc: "실적 데이터를 입력", docs: ["실적 데이터"] },
    { num: 10, name: "최종 문서 정리", desc: "전체 문서를 정리하고 프로젝트 완료 처리", docs: ["전체 문서 아카이브"] },
  ],
};

const GAP_ANALYSIS = [
  {
    id: 1,
    category: "폴더-단계 불일치",
    severity: "high",
    issue: "Google Drive 9개 폴더 양식이 PMS 10단계와 1:1 매핑되지 않음",
    detail: "Drive의 '제안서' 폴더는 PMS 1~4단계에 걸쳐 있고, '도면'과 '파트리스트'는 PMS 7단계에만 해당. 문서가 어느 단계 산출물인지 추적 불가.",
    solution: "Stage-Gate 매핑 테이블을 도입하여 각 Drive 폴더가 PMS의 어느 단계에 매핑되는지 명확히 정의",
  },
  {
    id: 2,
    category: "네이밍 규칙 부재",
    severity: "high",
    issue: "프로젝트 폴더명이 통일되지 않음 (예: '공정 라인 담당자 UR 번호일자')",
    detail: "삼성/IMK/OBPH 등 고객사별로 프로젝트 네이밍이 다르고, 일부는 '공정별 프로젝트', '노부장자료' 등 개인 기준으로 분류됨.",
    solution: "PV-YYYY-NNN 프로젝트 번호를 폴더명에 반영하는 표준 네이밍 규칙 적용",
  },
  {
    id: 3,
    category: "협력업체 관리 분리",
    severity: "medium",
    issue: "PMS에는 협력업체 견적/발주 관리 기능이 없으나 Drive에는 별도 폴더 존재",
    detail: "Drive의 4번(협력업체 견적서), 5번(협력업체 발주서)에 해당하는 PMS 기능이 부재. 외주 비용 추적 불가.",
    solution: "PMS에 외주/협력업체 관리 모듈 추가 또는 견적서에 외주 항목 구분 필드 추가",
  },
  {
    id: 4,
    category: "작업일지 미연동",
    severity: "medium",
    issue: "Drive의 '작업일지' 폴더가 PMS 어느 단계에도 매핑되지 않음",
    detail: "작업일지는 7단계(제작)와 8단계(설치) 전반에 걸쳐 작성되지만, PMS에서는 별도 관리되지 않음.",
    solution: "스테이지별 '작업일지' 문서 유형을 추가하여 일일 작업 기록을 시스템에서 추적",
  },
  {
    id: 5,
    category: "사람별 프로젝트 폴더",
    severity: "medium",
    issue: "'사람별 프로젝트' 폴더가 PMS의 역할 기반 접근과 충돌",
    detail: "개인별로 프로젝트를 분류하는 폴더가 있으나, PMS에서는 담당자 배정으로 관리. 이중 관리 발생.",
    solution: "PMS의 '내 작업' 대시보드로 대체하고, Drive에서 개인 폴더 구조를 단계적 폐지",
  },
  {
    id: 6,
    category: "문서 버전 관리 부재",
    severity: "low",
    issue: "Drive에서 문서 버전 관리가 Google Drive 자체 기능에만 의존",
    detail: "견적서 수정 시 PMS에서는 새 레코드를 생성하지만, Drive에서는 같은 파일을 덮어쓰기. 이력 추적 불일치.",
    solution: "PMS에서 문서 업로드 시 버전 번호를 자동 부여하고, externalId로 Drive 파일과 연결",
  },
];

const STANDARDIZED_MAPPING = [
  {
    pmsStage: 1,
    pmsName: "의뢰 접수",
    gdriveFolder: "1. 제안서",
    documentTypes: ["접수 폼", "의뢰서", "RFQ"],
    gate: "의뢰 내용 확인 및 등록 완료",
    uuid: "프로젝트 UUID 자동 생성",
  },
  {
    pmsStage: 2,
    pmsName: "담당자 지정",
    gdriveFolder: "—",
    documentTypes: ["담당자 배정표"],
    gate: "전 단계 담당자 배정 완료",
    uuid: "담당자 UUID 연결",
  },
  {
    pmsStage: 3,
    pmsName: "고객 협의",
    gdriveFolder: "3. 관련 자료 + 7. 관련 사진",
    documentTypes: ["회의록", "현장 사진", "기술 사양서"],
    gate: "고객 요구사항 확정",
    uuid: "회의 UUID / 사진 UUID",
  },
  {
    pmsStage: 4,
    pmsName: "진행 여부 결정",
    gdriveFolder: "—",
    documentTypes: ["의사결정 기록"],
    gate: "GO / NO-GO 결정",
    uuid: "결정 이력 UUID",
  },
  {
    pmsStage: 5,
    pmsName: "채권 등록",
    gdriveFolder: "—",
    documentTypes: ["채권 등록 서류"],
    gate: "채권 번호 발급 완료",
    uuid: "채권 UUID",
  },
  {
    pmsStage: 6,
    pmsName: "견적 작성",
    gdriveFolder: "2. 견적서 & 발주서 + 4. 협력업체 견적서",
    documentTypes: ["견적서", "협력업체 견적서", "비교 견적표"],
    gate: "견적 승인 및 발주서 발행",
    uuid: "견적 UUID (EST-YYYY-NNN)",
  },
  {
    pmsStage: 7,
    pmsName: "제작",
    gdriveFolder: "8. 도면 + 9. 파트리스트 + 작업 매뉴얼 + 6. 작업일지",
    documentTypes: ["도면(CAD)", "파트리스트", "제작 매뉴얼", "작업일지"],
    gate: "제작 완료 및 QC 검사 통과",
    uuid: "도면 UUID / 파트 UUID",
  },
  {
    pmsStage: 8,
    pmsName: "납품/설치",
    gdriveFolder: "5. 협력업체 발주서 + 6. 작업일지 + 7. 관련 사진",
    documentTypes: ["설치 매뉴얼", "납품확인서", "설치 사진", "작업일지"],
    gate: "고객 검수 완료",
    uuid: "납품 UUID",
  },
  {
    pmsStage: 9,
    pmsName: "실적 입력",
    gdriveFolder: "—",
    documentTypes: ["실적 데이터", "비용 정산서"],
    gate: "실적 데이터 입력 및 검증 완료",
    uuid: "실적 UUID",
  },
  {
    pmsStage: 10,
    pmsName: "최종 문서 정리",
    gdriveFolder: "전체 폴더 아카이빙",
    documentTypes: ["프로젝트 종합 보고서", "완료 확인서"],
    gate: "전체 문서 검증 및 아카이빙 완료",
    uuid: "아카이브 UUID",
  },
];

const METHODOLOGIES = [
  {
    id: "stage-gate",
    name: "Stage-Gate® 모델",
    icon: "🚪",
    fit: 95,
    description: "단계별 게이트(관문) 검증 후 다음 단계 진행. 플러스비젼의 현재 10단계와 가장 적합.",
    strengths: [
      "현재 PMS 10단계 구조와 자연스럽게 호환",
      "각 단계 완료 시 게이트 검토로 품질 보증",
      "Google Drive 문서를 게이트 산출물로 연결",
      "제조업 프로젝트에 가장 널리 검증된 방법론",
    ],
    weaknesses: ["유연성이 낮아 긴급 프로젝트 시 병행 진행 어려움"],
    recommendation: "★ 최적 추천",
  },
  {
    id: "pmbok",
    name: "PMBOK (PMI)",
    icon: "📐",
    fit: 75,
    description: "프로젝트 관리 지식 체계. 착수→계획→실행→감시→종료 5개 프로세스 그룹.",
    strengths: [
      "국제 표준(ISO 21500)과 호환",
      "WBS(작업 분류 체계)로 체계적 관리",
      "리스크 관리, 의사소통 관리 등 부가 영역 커버",
    ],
    weaknesses: ["10단계와 직접 매핑이 어려움", "소규모 팀에는 과도한 문서 부담"],
    recommendation: "부분 적용 추천",
  },
  {
    id: "lean",
    name: "Lean + Kanban",
    icon: "📋",
    fit: 60,
    description: "낭비 제거와 시각적 작업 흐름 관리. 칸반 보드로 진행 상황 실시간 추적.",
    strengths: [
      "작업 흐름 시각화에 탁월",
      "WIP(진행중 작업) 제한으로 병목 해소",
      "유연한 우선순위 조정 가능",
    ],
    weaknesses: ["단계별 게이트 검증 개념 약함", "문서 관리 체계 부재"],
    recommendation: "보조 도구로 활용",
  },
  {
    id: "hybrid",
    name: "하이브리드 (Stage-Gate + Lean)",
    icon: "🔄",
    fit: 90,
    description: "Stage-Gate의 구조적 장점과 Lean의 유연성을 결합한 맞춤형 모델.",
    strengths: [
      "10단계 게이트로 품질 보증 + 칸반으로 일일 작업 관리",
      "Google Drive 문서를 각 게이트 산출물로 자동 연결",
      "Supabase UUID로 문서-단계-프로젝트 완전 추적",
      "긴급 프로젝트 시 게이트 스킵(SKIPPED) 기능 활용",
    ],
    weaknesses: ["초기 구축 시 팀 교육 필요"],
    recommendation: "★ 실전 최적 추천",
  },
];

const FOLDER_STANDARD = {
  naming: "{고객사}/{PV-YYYY-NNN}_{공정}_{라인}_{담당자}_{UR번호}_{일자}",
  example: "삼성/PV-2026-045_ETCH_A1_김철수_UR-12345_20260313",
  subfolders: [
    "01_의뢰접수",
    "02_고객협의",
    "03_견적발주",
    "04_협력업체",
    "05_도면CAD",
    "06_파트리스트",
    "07_작업일지",
    "08_현장사진",
    "09_매뉴얼",
    "10_최종아카이브",
  ],
};

// ─── 컴포넌트 ────────────────────────────────────────────

const SeverityBadge = ({ severity }) => {
  const colors = {
    high: "bg-red-100 text-red-700 border-red-200",
    medium: "bg-amber-100 text-amber-700 border-amber-200",
    low: "bg-blue-100 text-blue-700 border-blue-200",
  };
  const labels = { high: "높음", medium: "중간", low: "낮음" };
  return (
    <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded border ${colors[severity]}`}>
      {labels[severity]}
    </span>
  );
};

const FitBar = ({ value }) => (
  <div className="flex items-center gap-2">
    <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-all ${
          value >= 90 ? "bg-green-500" : value >= 70 ? "bg-blue-500" : "bg-amber-500"
        }`}
        style={{ width: `${value}%` }}
      />
    </div>
    <span className="text-sm font-semibold w-10 text-right">{value}%</span>
  </div>
);

const tabs = [
  { id: "overview", label: "현황 진단" },
  { id: "gap", label: "GAP 분석" },
  { id: "methodology", label: "표준화 방법론" },
  { id: "mapping", label: "Stage-Gate 매핑" },
  { id: "folder", label: "폴더 표준" },
  { id: "roadmap", label: "구현 로드맵" },
];

export default function PlusVisionStandardization() {
  const [activeTab, setActiveTab] = useState("overview");

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* 헤더 */}
      <header className="bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-5">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">
                PlusVision PMS 프로젝트 관리 표준화 설계서
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Google Drive 폴더 구조 × PMS 10단계 × Supabase UUID 추적 — 최적 통합 표준화 방안
              </p>
            </div>
            <div className="text-right text-xs text-slate-400">
              <p>2026년 3월 13일</p>
              <p>Version 1.0</p>
            </div>
          </div>
        </div>
      </header>

      {/* 탭 네비게이션 */}
      <nav className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 flex gap-1 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeTab === tab.id
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* ── 1. 현황 진단 ──────────────────────── */}
        {activeTab === "overview" && (
          <div className="space-y-8">
            {/* 현재 GDrive 구조 */}
            <section className="bg-white rounded-xl border shadow-sm p-6">
              <h2 className="text-lg font-bold text-slate-800 mb-4">
                📁 현재 Google Drive 폴더 양식 (프로젝트 템플릿)
              </h2>
              <p className="text-sm text-slate-600 mb-4">
                폴더 경로: <code className="bg-slate-100 px-2 py-0.5 rounded text-xs">플러스비젼 공용 &gt; 프로젝트 &gt; 폴더 양식 &gt; 공정 라인 담당자 UR 번호일자</code>
              </p>
              <div className="grid grid-cols-2 gap-3">
                {CURRENT_GDRIVE.structure.map((item) => (
                  <div key={item.num} className="flex items-center gap-3 bg-blue-50 rounded-lg p-3">
                    <span className="w-8 h-8 rounded-lg bg-blue-600 text-white text-sm font-bold flex items-center justify-center">
                      {item.num}
                    </span>
                    <div>
                      <p className="text-sm font-medium text-slate-800">{item.name}</p>
                      <p className="text-xs text-slate-500">{item.type}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* 현재 PMS 10단계 */}
            <section className="bg-white rounded-xl border shadow-sm p-6">
              <h2 className="text-lg font-bold text-slate-800 mb-4">
                ⚙️ 현재 PMS 10단계 프로세스
              </h2>
              <div className="space-y-2">
                {CURRENT_PMS.stages.map((stage) => (
                  <div key={stage.num} className="flex gap-3 items-start bg-slate-50 rounded-lg p-3">
                    <span className={`w-8 h-8 rounded-lg text-white text-sm font-bold flex items-center justify-center flex-shrink-0 ${
                      stage.num <= 4 ? "bg-amber-500" : stage.num <= 6 ? "bg-blue-500" : stage.num <= 8 ? "bg-green-500" : "bg-purple-500"
                    }`}>
                      {stage.num}
                    </span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-slate-800">{stage.name}</p>
                        <span className={`px-2 py-0.5 rounded text-xs ${
                          stage.num <= 4 ? "bg-amber-100 text-amber-700" : stage.num <= 6 ? "bg-blue-100 text-blue-700" : stage.num <= 8 ? "bg-green-100 text-green-700" : "bg-purple-100 text-purple-700"
                        }`}>
                          {stage.num <= 4 ? "기획" : stage.num <= 6 ? "계약" : stage.num <= 8 ? "실행" : "마감"}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">{stage.desc}</p>
                      {stage.docs.length > 0 && (
                        <div className="flex gap-1 mt-1 flex-wrap">
                          {stage.docs.map((doc) => (
                            <span key={doc} className="px-2 py-0.5 bg-white border rounded text-xs text-slate-600">{doc}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* 고객사별 구조 */}
            <section className="bg-white rounded-xl border shadow-sm p-6">
              <h2 className="text-lg font-bold text-slate-800 mb-4">🏢 고객사별 프로젝트 폴더 현황</h2>
              <div className="grid grid-cols-3 gap-3">
                {["삼성", "디티에스", "바이코", "벨류", "원익포이스", "테트라다인", "포이스", "거래 업체"].map((name) => (
                  <div key={name} className="bg-slate-50 rounded-lg p-3">
                    <p className="text-sm font-medium text-slate-800">📂 {name}</p>
                    <p className="text-xs text-slate-500 mt-1">
                      {name === "삼성" ? "IMK, OBPH OGPMS, 적산, 홀드 프로젝트" :
                       name === "거래 업체" ? "협력업체 관리" : "프로젝트 문서"}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {/* ── 2. GAP 분석 ──────────────────────── */}
        {activeTab === "gap" && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl border shadow-sm p-6">
              <h2 className="text-lg font-bold text-slate-800 mb-2">🔍 GAP 분석: Google Drive ↔ PMS 불일치 항목</h2>
              <p className="text-sm text-slate-500 mb-6">
                현재 Google Drive 폴더 구조와 PMS 10단계 간의 불일치를 분석하고 해결 방안을 제시합니다.
              </p>
              <div className="space-y-4">
                {GAP_ANALYSIS.map((gap) => (
                  <div key={gap.id} className="border rounded-lg overflow-hidden">
                    <div className="bg-slate-50 px-4 py-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-lg font-bold text-slate-400">#{gap.id}</span>
                        <div>
                          <p className="text-sm font-semibold text-slate-800">{gap.category}</p>
                          <p className="text-xs text-slate-500">{gap.issue}</p>
                        </div>
                      </div>
                      <SeverityBadge severity={gap.severity} />
                    </div>
                    <div className="p-4 space-y-3">
                      <div>
                        <p className="text-xs font-medium text-slate-500 mb-1">상세 현황</p>
                        <p className="text-sm text-slate-700">{gap.detail}</p>
                      </div>
                      <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                        <p className="text-xs font-medium text-green-700 mb-1">✅ 해결 방안</p>
                        <p className="text-sm text-green-800">{gap.solution}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── 3. 표준화 방법론 ──────────────────── */}
        {activeTab === "methodology" && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl border shadow-sm p-6">
              <h2 className="text-lg font-bold text-slate-800 mb-2">📊 프로젝트 관리 표준화 방법론 비교</h2>
              <p className="text-sm text-slate-500 mb-6">
                플러스비젼의 반도체 장비 제조/설치 프로젝트에 최적합한 방법론을 분석합니다.
              </p>
              <div className="space-y-4">
                {METHODOLOGIES.map((m) => (
                  <div key={m.id} className={`border rounded-xl overflow-hidden ${m.fit >= 90 ? "ring-2 ring-blue-400" : ""}`}>
                    <div className={`px-5 py-4 ${m.fit >= 90 ? "bg-blue-50" : "bg-slate-50"}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{m.icon}</span>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="text-base font-bold text-slate-800">{m.name}</h3>
                              {m.recommendation.includes("★") && (
                                <span className="px-2 py-0.5 bg-blue-600 text-white text-xs font-medium rounded">
                                  {m.recommendation}
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-slate-600 mt-0.5">{m.description}</p>
                          </div>
                        </div>
                      </div>
                      <div className="mt-3">
                        <p className="text-xs text-slate-500 mb-1">플러스비젼 적합도</p>
                        <FitBar value={m.fit} />
                      </div>
                    </div>
                    <div className="p-5 grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs font-medium text-green-600 mb-2">강점</p>
                        <ul className="space-y-1">
                          {m.strengths.map((s, i) => (
                            <li key={i} className="text-sm text-slate-700 flex items-start gap-1.5">
                              <span className="text-green-500 mt-0.5">✓</span> {s}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-red-600 mb-2">약점</p>
                        <ul className="space-y-1">
                          {m.weaknesses.map((w, i) => (
                            <li key={i} className="text-sm text-slate-700 flex items-start gap-1.5">
                              <span className="text-red-500 mt-0.5">✗</span> {w}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 최종 추천 */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl p-6 text-white">
              <h3 className="text-lg font-bold mb-3">🎯 최종 추천: 하이브리드 Stage-Gate + Lean 모델</h3>
              <div className="grid grid-cols-3 gap-4 mt-4">
                <div className="bg-white/10 rounded-lg p-4">
                  <p className="font-semibold text-sm mb-2">Phase 1: 기획 (1~4단계)</p>
                  <p className="text-xs text-blue-100">
                    의뢰접수 → 담당자배정 → 고객협의 → GO/NO-GO 결정. 각 게이트에서 산출물 검증 후 진행.
                  </p>
                </div>
                <div className="bg-white/10 rounded-lg p-4">
                  <p className="font-semibold text-sm mb-2">Phase 2: 계약+실행 (5~8단계)</p>
                  <p className="text-xs text-blue-100">
                    채권등록 → 견적작성 → 제작 → 납품/설치. Lean 칸반보드로 일일 작업 관리.
                  </p>
                </div>
                <div className="bg-white/10 rounded-lg p-4">
                  <p className="font-semibold text-sm mb-2">Phase 3: 마감 (9~10단계)</p>
                  <p className="text-xs text-blue-100">
                    실적입력 → 최종문서정리. UUID로 전 과정 추적 가능한 아카이빙.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── 4. Stage-Gate 매핑 ──────────────────── */}
        {activeTab === "mapping" && (
          <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
            <div className="p-6 border-b">
              <h2 className="text-lg font-bold text-slate-800">🔗 Stage-Gate × Google Drive × UUID 매핑 테이블</h2>
              <p className="text-sm text-slate-500 mt-1">
                PMS 10단계와 Google Drive 폴더, 산출 문서, 게이트 기준, UUID 추적을 통합한 표준 매핑
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 text-left">
                    <th className="px-4 py-3 text-xs font-semibold text-slate-500 w-12">단계</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-500 w-28">PMS 단계명</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-500">Google Drive 폴더 매핑</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-500">산출 문서</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-500">Gate 기준 (통과 조건)</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-500 w-36">UUID 추적</th>
                  </tr>
                </thead>
                <tbody>
                  {STANDARDIZED_MAPPING.map((row, i) => (
                    <tr key={row.pmsStage} className={i % 2 === 0 ? "bg-white" : "bg-slate-50/50"}>
                      <td className="px-4 py-3">
                        <span className={`w-7 h-7 rounded-lg text-white text-xs font-bold flex items-center justify-center ${
                          row.pmsStage <= 4 ? "bg-amber-500" : row.pmsStage <= 6 ? "bg-blue-500" : row.pmsStage <= 8 ? "bg-green-500" : "bg-purple-500"
                        }`}>
                          {row.pmsStage}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-slate-800">{row.pmsName}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-1 rounded ${
                          row.gdriveFolder === "—" ? "bg-gray-100 text-gray-500" : "bg-blue-50 text-blue-700"
                        }`}>
                          📁 {row.gdriveFolder}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1 flex-wrap">
                          {row.documentTypes.map((doc) => (
                            <span key={doc} className="px-1.5 py-0.5 bg-green-50 text-green-700 border border-green-200 rounded text-xs">
                              {doc}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">{row.gate}</td>
                      <td className="px-4 py-3 text-xs text-indigo-600 font-mono">{row.uuid}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── 5. 폴더 표준 ──────────────────────── */}
        {activeTab === "folder" && (
          <div className="space-y-6">
            {/* 네이밍 규칙 */}
            <div className="bg-white rounded-xl border shadow-sm p-6">
              <h2 className="text-lg font-bold text-slate-800 mb-4">📂 표준 폴더 네이밍 규칙</h2>

              <div className="bg-slate-900 rounded-lg p-5 mb-4">
                <p className="text-xs text-slate-400 mb-2">패턴</p>
                <code className="text-sm text-green-400 font-mono">{FOLDER_STANDARD.naming}</code>
                <p className="text-xs text-slate-400 mt-4 mb-2">예시</p>
                <code className="text-sm text-blue-400 font-mono">{FOLDER_STANDARD.example}</code>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="text-sm font-semibold text-slate-700 mb-3">표준 하위 폴더 (10개)</h3>
                  <div className="space-y-1.5">
                    {FOLDER_STANDARD.subfolders.map((folder, i) => (
                      <div key={folder} className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2">
                        <span className="w-6 h-6 rounded bg-slate-200 text-slate-600 text-xs font-medium flex items-center justify-center">
                          {i + 1}
                        </span>
                        <span className="text-sm text-slate-700 font-mono">{folder}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-700 mb-3">PMS 단계 연결</h3>
                  <div className="space-y-1.5">
                    {[
                      { folder: "01_의뢰접수", stages: "1~2단계" },
                      { folder: "02_고객협의", stages: "3~4단계" },
                      { folder: "03_견적발주", stages: "5~6단계" },
                      { folder: "04_협력업체", stages: "6단계 (외주)" },
                      { folder: "05_도면CAD", stages: "7단계" },
                      { folder: "06_파트리스트", stages: "7단계" },
                      { folder: "07_작업일지", stages: "7~8단계" },
                      { folder: "08_현장사진", stages: "3, 8단계" },
                      { folder: "09_매뉴얼", stages: "7~8단계" },
                      { folder: "10_최종아카이브", stages: "9~10단계" },
                    ].map((item) => (
                      <div key={item.folder} className="flex items-center justify-between bg-blue-50 rounded-lg px-3 py-2">
                        <span className="text-sm text-blue-800 font-mono">{item.folder}</span>
                        <span className="text-xs bg-blue-200 text-blue-800 px-2 py-0.5 rounded">{item.stages}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* UUID 연결 체계 */}
            <div className="bg-white rounded-xl border shadow-sm p-6">
              <h2 className="text-lg font-bold text-slate-800 mb-4">🔑 UUID 기반 데이터 추적 체계</h2>
              <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
                <div className="font-mono text-xs text-indigo-800 space-y-2">
                  <p className="font-semibold text-sm text-indigo-900 mb-3">Supabase UUID 추적 흐름</p>
                  <p>📋 프로젝트 UUID: <span className="bg-indigo-200 px-1 rounded">plusPMS_a1b2c3d4...</span></p>
                  <p className="pl-4">├── 🔢 프로젝트 번호: PV-2026-045</p>
                  <p className="pl-4">├── 📂 GDrive 폴더 ID: <span className="bg-blue-200 px-1 rounded">1k9gxPYW...</span> (externalId)</p>
                  <p className="pl-4">├── ⚙️ 스테이지 UUID: <span className="bg-green-200 px-1 rounded">plusPMS_e5f6g7h8...</span></p>
                  <p className="pl-8">├── 📄 문서 UUID: <span className="bg-amber-200 px-1 rounded">plusPMS_i9j0k1l2...</span></p>
                  <p className="pl-8">│   └── GDrive 파일 ID (externalId)</p>
                  <p className="pl-8">├── 💰 견적 UUID: <span className="bg-red-200 px-1 rounded">plusPMS_m3n4o5p6...</span></p>
                  <p className="pl-8">└── 📝 감사 로그 UUID: <span className="bg-purple-200 px-1 rounded">plusPMS_q7r8s9t0...</span></p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── 6. 구현 로드맵 ──────────────────────── */}
        {activeTab === "roadmap" && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl border shadow-sm p-6">
              <h2 className="text-lg font-bold text-slate-800 mb-6">🗓️ 구현 로드맵 (3개월)</h2>

              {[
                {
                  phase: "Phase 1",
                  period: "1~2주차",
                  title: "기반 구축",
                  color: "amber",
                  items: [
                    "Google Drive API OAuth 연동 완성 (토큰 자동 갱신)",
                    "폴더 네이밍 규칙 표준 적용 시작",
                    "PMS constants.ts에 Stage-Gate 매핑 테이블 추가",
                    "Supabase externalId 필드로 Drive 파일 연결 체계 확립",
                  ],
                },
                {
                  phase: "Phase 2",
                  period: "3~4주차",
                  title: "데이터 마이그레이션",
                  color: "blue",
                  items: [
                    "기존 프로젝트 폴더를 표준 구조로 재배치",
                    "gdrive-migrate.ts 스크립트로 기존 문서 매핑",
                    "각 문서에 UUID + externalId 부여",
                    "PMS 프로젝트별 문서 자동 분류 규칙 적용",
                  ],
                },
                {
                  phase: "Phase 3",
                  period: "5~8주차",
                  title: "기능 고도화",
                  color: "green",
                  items: [
                    "PMS에서 직접 Drive 문서 업로드/조회 기능",
                    "협력업체 견적/발주 관리 모듈 추가",
                    "작업일지 시스템 연동",
                    "Stage Gate 자동 검증 (산출물 존재 여부 체크)",
                  ],
                },
                {
                  phase: "Phase 4",
                  period: "9~12주차",
                  title: "운영 최적화",
                  color: "purple",
                  items: [
                    "대시보드에 문서 완성도 지표 추가",
                    "프로젝트 템플릿에서 Drive 폴더 자동 생성",
                    "알림 시스템에 문서 미제출 경고 추가",
                    "팀 교육 및 SOP 문서 배포",
                  ],
                },
              ].map((phase) => (
                <div key={phase.phase} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className={`w-10 h-10 rounded-full bg-${phase.color}-500 text-white text-xs font-bold flex items-center justify-center`}>
                      {phase.phase.split(" ")[1]}
                    </div>
                    <div className={`flex-1 w-0.5 bg-${phase.color}-200 my-1`} />
                  </div>
                  <div className="flex-1 pb-6">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-base font-bold text-slate-800">{phase.phase}: {phase.title}</h3>
                      <span className={`px-2 py-0.5 bg-${phase.color}-100 text-${phase.color}-700 text-xs rounded`}>
                        {phase.period}
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      {phase.items.map((item, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <span className="w-5 h-5 rounded bg-slate-100 text-slate-500 text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
                            {i + 1}
                          </span>
                          <p className="text-sm text-slate-700">{item}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* 핵심 KPI */}
            <div className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-xl p-6 text-white">
              <h3 className="text-lg font-bold mb-4">📈 표준화 성과 KPI</h3>
              <div className="grid grid-cols-4 gap-4">
                {[
                  { label: "문서 추적률", target: "100%", current: "~40%", desc: "UUID로 추적 가능한 문서 비율" },
                  { label: "폴더 표준 준수율", target: "95%+", current: "~20%", desc: "표준 네이밍 규칙 적용 비율" },
                  { label: "Gate 통과 검증률", target: "90%+", current: "0%", desc: "산출물 자동 검증 비율" },
                  { label: "문서 검색 시간", target: "<10초", current: "~3분", desc: "필요 문서 찾기까지 시간" },
                ].map((kpi) => (
                  <div key={kpi.label} className="bg-white/10 rounded-lg p-4">
                    <p className="text-xs text-slate-300">{kpi.label}</p>
                    <div className="flex items-end gap-2 mt-1">
                      <p className="text-2xl font-bold">{kpi.target}</p>
                      <p className="text-xs text-slate-400 mb-1">현재 {kpi.current}</p>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">{kpi.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
