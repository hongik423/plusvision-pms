// ============================================
// PlusPMS 상수 정의
// ============================================

/** 프로젝트 표준 10단계 */
export const STAGE_NAMES: Record<number, string> = {
  1: '의뢰 접수',
  2: '담당자 지정',
  3: '고객 협의',
  4: '진행 여부 결정',
  5: '채권 등록',
  6: '견적 작성',
  7: '제작',
  8: '납품/설치',
  9: '실적 입력',
  10: '최종 문서 정리',
} as const;

/** 각 단계별 설명 */
export const STAGE_DESCRIPTIONS: Record<number, string> = {
  1: '의뢰 내용을 접수하고 기록합니다',
  2: '프로젝트 각 단계의 담당자를 지정합니다',
  3: '고객(삼성 담당자)과 협의하고 현장을 확인합니다',
  4: '프로젝트 진행 여부를 결정합니다 (진행/보류/취소)',
  5: '채권을 등록하거나 신규 채권을 처리합니다',
  6: '견적서를 작성합니다 (부품 선택, 금액 산정)',
  7: '제작을 진행하고 제작 매뉴얼과 부품 리스트를 정리합니다',
  8: '납품 및 설치를 진행하고 설치 매뉴얼을 작성합니다',
  9: '실적 데이터를 입력합니다',
  10: '전체 문서를 정리하고 프로젝트를 완료 처리합니다',
} as const;

/** 각 단계별 산출 문서 유형 */
export const STAGE_DOCUMENT_TYPES: Record<number, string[]> = {
  1: ['접수 폼', '의뢰 내용 기록'],
  2: [],
  3: ['현장 사진', '반출 기록', '회의록'],
  4: [],
  5: ['채권 등록 서류'],
  6: ['견적서'],
  7: ['제작 매뉴얼', '부품 리스트', '도면'],
  8: ['설치 매뉴얼', '납품 확인서'],
  9: ['실적 데이터'],
  10: ['전체 문서 아카이브'],
} as const;

/** 프로젝트 상태 라벨 */
export const PROJECT_STATUS_LABELS = {
  PENDING: '대기',
  ACTIVE: '진행중',
  COMPLETED: '완료',
  HOLD: '보류',
  CANCELLED: '취소',
} as const;

/** 프로젝트 상태 색상 (Tailwind) */
export const PROJECT_STATUS_COLORS = {
  PENDING: 'bg-amber-100 text-amber-800',
  ACTIVE: 'bg-blue-100 text-blue-800',
  COMPLETED: 'bg-green-100 text-green-800',
  HOLD: 'bg-purple-100 text-purple-800',
  CANCELLED: 'bg-red-100 text-red-800',
} as const;

/** 단계 상태 색상 */
export const STAGE_STATUS_COLORS = {
  INACTIVE: 'bg-gray-200 text-gray-500',
  ACTIVE: 'bg-blue-500 text-white',
  COMPLETED: 'bg-green-500 text-white',
  SKIPPED: 'bg-gray-400 text-white',
} as const;

/** 역할 라벨 */
export const ROLE_LABELS = {
  ADMIN: '관리자',
  MANAGER: '매니저',
  USER: '사용자',
  VIEWER: '조회자',
} as const;

/** 문서 유형 라벨 */
export const DOCUMENT_TYPE_LABELS = {
  PROPOSAL: '제안서',
  ESTIMATE: '견적서',
  MANUFACTURE_MANUAL: '제작 매뉴얼',
  INSTALL_MANUAL: '설치 매뉴얼',
  PARTS_LIST: '부품 리스트',
  SITE_PHOTO: '현장 사진',
  DRAWING: '도면',
  MEETING_NOTE: '회의록',
  EXPORT_RECORD: '반출 기록',
  OTHER: '기타',
} as const;

/** 허용 파일 확장자 */
export const ALLOWED_FILE_EXTENSIONS = [
  '.pdf', '.xlsx', '.xls', '.doc', '.docx',
  '.ppt', '.pptx',
  '.hwp', '.hwpx', '.dwg', '.dxf',
  '.jpg', '.jpeg', '.png', '.gif',
] as const;

/** 최대 파일 크기 (100MB) */
export const MAX_FILE_SIZE = 100 * 1024 * 1024;

/** 프로젝트당 최대 총 파일 크기 (2GB) */
export const MAX_PROJECT_STORAGE = 2 * 1024 * 1024 * 1024;

/** 페이지네이션 기본값 */
export const DEFAULT_PAGE_SIZE = 20;

/** 총 단계 수 */
export const TOTAL_STAGES = 10;

// ============================================
// Stage-Gate + Lean 하이브리드 방법론
// ============================================

/**
 * 3-Phase 구조 (Stage-Gate + Lean 하이브리드)
 * Phase 1: 기획 (Stage 1~4) — Stage-Gate 방식, 각 게이트에서 산출물 검증
 * Phase 2: 계약+실행 (Stage 5~8) — Lean 칸반 방식, 일일 작업 관리
 * Phase 3: 마감 (Stage 9~10) — UUID 전 과정 추적 아카이빙
 */
export type Phase = "PLANNING" | "EXECUTION" | "CLOSING";

export const PHASE_CONFIG: Record<Phase, {
  label: string;
  description: string;
  stages: number[];
  methodology: "STAGE_GATE" | "LEAN_KANBAN" | "ARCHIVE";
  color: string;
}> = {
  PLANNING: {
    label: "기획",
    description: "의뢰접수 → 담당자배정 → 고객협의 → GO/NO-GO 결정",
    stages: [1, 2, 3, 4],
    methodology: "STAGE_GATE",
    color: "bg-blue-500",
  },
  EXECUTION: {
    label: "계약+실행",
    description: "채권등록 → 견적작성 → 제작 → 납품/설치",
    stages: [5, 6, 7, 8],
    methodology: "LEAN_KANBAN",
    color: "bg-green-500",
  },
  CLOSING: {
    label: "마감",
    description: "실적입력 → 최종문서정리 (UUID 전 과정 추적 아카이빙)",
    stages: [9, 10],
    methodology: "ARCHIVE",
    color: "bg-purple-500",
  },
};

/** 단계 번호로 Phase 조회 */
export function getPhaseByStage(stageNumber: number): Phase {
  if (stageNumber >= 1 && stageNumber <= 4) return "PLANNING";
  if (stageNumber >= 5 && stageNumber <= 8) return "EXECUTION";
  return "CLOSING";
}

/**
 * 게이트 검증 조건 — Phase 전환 시 충족해야 하는 조건
 * Gate 1: Phase 1→2 전환 (4단계 완료 시) — GO/NO-GO 결정
 * Gate 2: Phase 2→3 전환 (8단계 완료 시) — 납품/설치 완료
 */
export const GATE_REQUIREMENTS: Record<number, {
  gateId: string;
  gateName: string;
  description: string;
  requiredDocTypes: string[];
  requiredFields: string[];
}> = {
  4: {
    gateId: "GATE_1",
    gateName: "GO/NO-GO 게이트",
    description: "프로젝트 진행 여부 결정. 고객 협의 완료 및 의사결정 근거 확인.",
    requiredDocTypes: [],
    requiredFields: ["status_decision"],
  },
  8: {
    gateId: "GATE_2",
    gateName: "납품 완료 게이트",
    description: "납품/설치 완료 확인. 고객 확인서 필요.",
    requiredDocTypes: ["INSTALL_MANUAL"],
    requiredFields: ["delivery_confirmed"],
  },
};

/**
 * Lean 칸반 보드 상태 정의 (Phase 2 전용)
 */
export type KanbanStatus = "BACKLOG" | "IN_PROGRESS" | "REVIEW" | "DONE";

export const KANBAN_COLUMNS: { status: KanbanStatus; label: string; color: string }[] = [
  { status: "BACKLOG", label: "대기", color: "bg-gray-200" },
  { status: "IN_PROGRESS", label: "진행중", color: "bg-blue-200" },
  { status: "REVIEW", label: "검토", color: "bg-yellow-200" },
  { status: "DONE", label: "완료", color: "bg-green-200" },
];

/**
 * Google Drive 폴더 구조 매핑 (표준화)
 *
 * 실제 Drive 구조:
 *   공유 문서함 > 플러스비전 공용
 *     ├── 개인별/     ← 직원 개인 작업 폴더
 *     └── 프로젝트/   ← 프로젝트 그룹별 폴더 (삼성, IMK 등)
 *
 * 세부 설정은 src/lib/drive-config.ts 참고
 */
export const DRIVE_FOLDER_STRUCTURE: Record<number, {
  folderName: string;
  driveMapping: string;
  driveKeywords: string[];
}> = {
  1:  { folderName: "01_의뢰접수",   driveMapping: "접수서류",              driveKeywords: ["접수", "의뢰", "request"] },
  2:  { folderName: "02_담당자지정", driveMapping: "조직도",               driveKeywords: ["담당", "연락처", "조직"] },
  3:  { folderName: "03_고객협의",   driveMapping: "현장사진_회의록",      driveKeywords: ["현장", "사진", "협의", "회의", "공사", "환경", "안전"] },
  4:  { folderName: "04_진행결정",   driveMapping: "의사결정기록",          driveKeywords: ["결정", "홀드", "보류", "hold"] },
  5:  { folderName: "05_채권등록",   driveMapping: "채권서류",              driveKeywords: ["채권", "계약", "bond"] },
  6:  { folderName: "06_견적작성",   driveMapping: "견적서",               driveKeywords: ["견적", "적산", "estimate"] },
  7:  { folderName: "07_제작",       driveMapping: "제작매뉴얼_부품리스트_도면", driveKeywords: ["제작", "도면", "부품", "drawing"] },
  8:  { folderName: "08_납품설치",   driveMapping: "설치매뉴얼_납품확인서", driveKeywords: ["설치", "납품", "install"] },
  9:  { folderName: "09_실적입력",   driveMapping: "실적데이터",            driveKeywords: ["실적", "성과", "result"] },
  10: { folderName: "10_최종문서",   driveMapping: "전체아카이브",          driveKeywords: ["최종", "아카이브", "정리", "old"] },
};
