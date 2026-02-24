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
  '.hwp', '.dwg', '.dxf',
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
