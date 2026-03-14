// ============================================
// Google Drive 공유 폴더 구조 설정
// ============================================
//
// 공유 폴더: 플러스비전 공용 (1IoZG4Mo12CIa5efHHcDFu8K4zh6SVIzg)
//   ├── 개인별/               ← PERSONAL
//   │   ├── 김남용/
//   │   ├── 노희길/
//   │   ├── 송상현/
//   │   ├── 정희창/
//   │   ├── 조현섭/
//   │   ├── 최봉/
//   │   └── 최혜인/
//   ├── 프로젝트/             ← PROJECT
//   │   ├── 삼성/
//   │   ├── 바이코/
//   │   ├── 벨류/
//   │   ├── 포이스/
//   │   ├── 원익포이스/
//   │   ├── 디티에스/
//   │   ├── 테트라다인/
//   │   ├── 거래 업체/
//   │   ├── 사람별 프로젝트/
//   │   └── 폴더 양식/
//   ├── 회사 소개서/          ← COMPANY_INTRO
//   ├── 국책 자료/            ← GOVERNMENT
//   ├── 회사 운영/            ← OPERATIONS
//   └── SOP/                  ← SOP
//
// ============================================

// ── 루트 폴더 ID (환경변수 우선) ──

/** 전체 루트 (플러스비전 공용) */
export const DRIVE_ROOT =
  process.env.DRIVE_ROOT_ID ?? "1IoZG4Mo12CIa5efHHcDFu8K4zh6SVIzg";

/** 개인별 폴더 루트 */
export const DRIVE_ROOT_PERSONAL =
  process.env.DRIVE_ROOT_PERSONAL_ID ?? "1byd8qNMKksQlEm6oX4k9h5o7Fpzmbm_i";

/** 프로젝트별 폴더 루트 */
export const DRIVE_ROOT_PROJECTS =
  process.env.DRIVE_ROOT_PROJECTS_ID ?? "1MjPlZurc84B7N7noSjGAqPULTTo-_U7j";

/** 회사 소개서 폴더 */
export const DRIVE_ROOT_COMPANY_INTRO =
  process.env.DRIVE_ROOT_COMPANY_INTRO_ID ?? "1wSE8QqopqZ70D2SmzC91_94t-OiIztqf";

/** 국책 자료 폴더 */
export const DRIVE_ROOT_GOVERNMENT =
  process.env.DRIVE_ROOT_GOVERNMENT_ID ?? "1Ls1grfNUzd_d1ctWABw9_fI6uN58W4Ng";

/** 회사 운영 폴더 */
export const DRIVE_ROOT_OPERATIONS =
  process.env.DRIVE_ROOT_OPERATIONS_ID ?? "1iKyUjIeiyOmwAWoZ8SCjsqAQk8jD71jB";

/** SOP 폴더 */
export const DRIVE_ROOT_SOP =
  process.env.DRIVE_ROOT_SOP_ID ?? "1C7akOQi_5TBHHMAMPOWqTVsgLczI6j_B";

// ── 알려진 프로젝트 그룹 매핑 (드라이브 폴더명 → Folder ID) ──
export const KNOWN_PROJECT_GROUPS: Record<string, string> = {
  삼성:       "1neRWtMCMM9s-qHeTDy5SqMGYga-b35D9",
  바이코:     "109sm5h0xJmSnLE_EeHwidXYtWegbq-V-",
  벨류:       "15YEUJ0q-g4B84jHCjjr9c0B24Uy-oLN5",
  포이스:     "1TB10kdUpVUKgzm5ZrzoUz881Xxw5c2pl",
  원익포이스: "1sDhtJh97IlgHlG8OXjbOwjM-Yp_BFRPo",
  디티에스:   "1jEV7uwUlfTCDrUPTS2S7CCBHXRSWsGov",
  DTS:        "1jEV7uwUlfTCDrUPTS2S7CCBHXRSWsGov",
  테트라다인: "1Laalbfts5T4IWFHHhgKWNaD9hvhnsurl",
  "거래 업체":  "1P0IYQkoixv_xEoKFbUSrtizgL8YzLYfa",
  "사람별 프로젝트": "1U8FfwJmuYMfJYcz6reG17E4KghTrgTZI",
  "폴더 양식":  "1XaURMGTjyAsw9ToDowBcS5--vnjN1ICS",
};

// ── 알려진 개인 폴더 매핑 (이름 → Folder ID) ──
export const KNOWN_PERSONAL_FOLDERS: Record<string, string> = {
  김남용: "1NyFdEfenaIzmVKKNDUa8e88Wqmp2QMJF",
  노희길: "12I1k7S_K_6S2jGmZqdaGX2AoA9gJJbVe",
  송상현: "1SiiheAx4YeTjw2OY8AKj4lEJYOZbVXzo",
  정희창: "1A1esjJbYa5NevMj93Bp7_WacqZknDTEf",
  조현섭: "1l5HbYWs4TjNAw63GkAgZl0GKOEJwoAT4",
  최봉:   "1-2HWn0BFCS4VpX0gHJFP73kBwjvnY-ci",
  최혜인: "1XcbqhSCLAgitkMXxfV0OiswuNN21HjdQ",
};

// ── 폴더 스코프 타입 (확장) ──
export type DriveFolderScope =
  | "PERSONAL"
  | "PROJECT"
  | "COMPANY_INTRO"
  | "GOVERNMENT"
  | "OPERATIONS"
  | "SOP";

/** 스코프 → 루트 폴더 ID 매핑 */
export const SCOPE_ROOT_MAP: Record<DriveFolderScope, string> = {
  PERSONAL:      DRIVE_ROOT_PERSONAL,
  PROJECT:       DRIVE_ROOT_PROJECTS,
  COMPANY_INTRO: DRIVE_ROOT_COMPANY_INTRO,
  GOVERNMENT:    DRIVE_ROOT_GOVERNMENT,
  OPERATIONS:    DRIVE_ROOT_OPERATIONS,
  SOP:           DRIVE_ROOT_SOP,
};

/** 스코프 → 한글 이름 */
export const SCOPE_LABEL_MAP: Record<DriveFolderScope, string> = {
  PERSONAL:      "개인별",
  PROJECT:       "프로젝트",
  COMPANY_INTRO: "회사 소개서",
  GOVERNMENT:    "국책 자료",
  OPERATIONS:    "회사 운영",
  SOP:           "SOP",
};

export interface DriveFolderNode {
  id: string;
  name: string;
  mimeType: string;
  scope: DriveFolderScope;
  parentPath: string;
}

// ── 프로젝트 폴더 → PMS 단계 매핑 규칙 ──
export const FOLDER_STAGE_KEYWORDS: Array<{
  keywords: string[];
  stageNumber: number;
  documentType: string;
}> = [
  { keywords: ["접수", "의뢰", "request"],          stageNumber: 1,  documentType: "OTHER" },
  { keywords: ["담당", "조직", "assign"],            stageNumber: 2,  documentType: "OTHER" },
  { keywords: ["현장", "사진", "협의", "회의", "site", "meeting"], stageNumber: 3,  documentType: "SITE_PHOTO" },
  { keywords: ["결정", "판단", "decision"],          stageNumber: 4,  documentType: "OTHER" },
  { keywords: ["채권", "계약", "bond", "contract"],  stageNumber: 5,  documentType: "OTHER" },
  { keywords: ["견적", "적산", "estimate", "quote"], stageNumber: 6,  documentType: "ESTIMATE" },
  { keywords: ["제작", "도면", "부품", "manufacture", "drawing", "parts"], stageNumber: 7, documentType: "DRAWING" },
  { keywords: ["설치", "납품", "install", "delivery"], stageNumber: 8,  documentType: "INSTALL_MANUAL" },
  { keywords: ["실적", "성과", "result", "정산", "매출", "매입"], stageNumber: 9, documentType: "OTHER" },
  { keywords: ["최종", "아카이브", "정리", "archive"], stageNumber: 10, documentType: "OTHER" },
  // 삼성 프로젝트 특화 키워드
  { keywords: ["공사", "대응"],                      stageNumber: 3,  documentType: "OTHER" },
  { keywords: ["연락처", "담당자"],                   stageNumber: 2,  documentType: "OTHER" },
  { keywords: ["환경", "안전"],                      stageNumber: 3,  documentType: "OTHER" },
  { keywords: ["홀드", "hold", "보류"],              stageNumber: 4,  documentType: "OTHER" },
  // DTS / 선박 / 일반 제조 프로젝트 특화 키워드
  { keywords: ["발주서", "발주"],                     stageNumber: 6,  documentType: "ESTIMATE" },
  { keywords: ["단가", "단가표"],                     stageNumber: 6,  documentType: "ESTIMATE" },
  { keywords: ["선박", "보드", "패널", "개발", "릴레이", "배선", "레이아웃"], stageNumber: 7, documentType: "OTHER" },
  { keywords: ["dpf", "차압"],                       stageNumber: 7,  documentType: "OTHER" },
  { keywords: ["영광"],                              stageNumber: 3,  documentType: "SITE_PHOTO" },
  { keywords: ["업무"],                              stageNumber: 1,  documentType: "OTHER" },
];

/**
 * 폴더명으로 단계 번호를 추론합니다.
 * 매칭되는 키워드가 없으면 기본값 10 (최종 문서 정리) 반환
 */
export function inferStageFromFolderName(
  folderName: string,
): { stageNumber: number; documentType: string } {
  const lower = folderName.toLowerCase();
  for (const rule of FOLDER_STAGE_KEYWORDS) {
    if (rule.keywords.some((kw) => lower.includes(kw))) {
      return { stageNumber: rule.stageNumber, documentType: rule.documentType };
    }
  }
  return { stageNumber: 10, documentType: "OTHER" };
}

/**
 * 스코프 루트 폴더 ID를 반환합니다.
 */
export function getRootFolderId(scope: DriveFolderScope): string {
  return SCOPE_ROOT_MAP[scope];
}

/**
 * 모든 스코프의 루트 폴더 목록을 반환합니다.
 * (Drive 탐색 UI에서 최상위 메뉴 구성용)
 */
export function getAllRootFolders(): Array<{
  scope: DriveFolderScope;
  label: string;
  folderId: string;
}> {
  return (Object.keys(SCOPE_ROOT_MAP) as DriveFolderScope[]).map((scope) => ({
    scope,
    label: SCOPE_LABEL_MAP[scope],
    folderId: SCOPE_ROOT_MAP[scope],
  }));
}
