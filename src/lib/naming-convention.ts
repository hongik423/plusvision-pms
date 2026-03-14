// ============================================================
// PlusPMS 프로젝트/문서 넘버링 규칙 (Naming Convention)
// ============================================================
//
// ┌─────────────────────────────────────────────────────────┐
// │ 1. 프로젝트 번호                                        │
// │    형식: PV-{YYYY}-{NNN}                                │
// │    예시: PV-2026-001, PV-2026-008                       │
// │    규칙:                                                │
// │    - PV = PlusVision 약어                               │
// │    - YYYY = 프로젝트 생성 연도                           │
// │    - NNN = 연도별 일련번호 (001~999)                     │
// │    - generateProjectNumber() 함수로 자동 생성            │
// ├─────────────────────────────────────────────────────────┤
// │ 2. 문서 번호 (StageDocument)                            │
// │    형식: {ProjectNumber}-S{SS}-{NNN}                    │
// │    예시: PV-2026-008-S06-001                            │
// │    규칙:                                                │
// │    - SS = 단계번호 (01~10, 2자리)                       │
// │    - NNN = 해당 단계 내 문서 일련번호 (001~999)          │
// │    - 버전: -V{N} 접미사 (V2, V3...)                     │
// │    - 예시: PV-2026-008-S06-001-V2 (6단계 견적서 2버전)  │
// ├─────────────────────────────────────────────────────────┤
// │ 3. Google Drive 파일명 규칙                             │
// │    형식: [{DocNumber}] {원본파일명}                      │
// │    예시: [PV-2026-008-S06-001] 견적서.xlsx              │
// │    규칙:                                                │
// │    - 대괄호 접두사로 추적 가능성 확보                    │
// │    - 원본 파일명 유지하여 사용자 식별 편의               │
// │    - 중복 시 버전 번호 추가                              │
// ├─────────────────────────────────────────────────────────┤
// │ 4. Google Drive 폴더 구조                               │
// │    공유 드라이브: 플러스비전 공용 (루트)                  │
// │      └── 프로젝트/                                      │
// │          └── {고객사}/                                   │
// │              └── [{ProjectNumber}] {프로젝트명}/         │
// │                  ├── S01_의뢰접수/                       │
// │                  ├── S02_담당자지정/                      │
// │                  ├── ...                                 │
// │                  └── S10_최종문서정리/                    │
// └─────────────────────────────────────────────────────────┘

import { prisma } from "@/lib/prisma";
import { STAGE_NAMES } from "@/lib/constants";

// ── 문서 번호 생성 ──────────────────────────────────────────

/**
 * 프로젝트 단계 내 다음 문서 번호를 생성합니다.
 *
 * @param projectNumber - 프로젝트 번호 (예: PV-2026-008)
 * @param stageNumber   - 단계 번호 (1~10)
 * @param stageId       - 단계 ID (DB 조회용)
 * @returns "PV-2026-008-S06-001" 형태의 문서 번호
 */
export async function generateDocumentNumber(
  projectNumber: string,
  stageNumber: number,
  stageId: string,
): Promise<string> {
  const stagePrefix = `S${String(stageNumber).padStart(2, "0")}`;
  const docNumberPrefix = `${projectNumber}-${stagePrefix}-`;

  // 해당 단계의 마지막 문서 번호 조회
  const lastDoc = await prisma.stageDocument.findFirst({
    where: {
      stageId,
      description: { startsWith: docNumberPrefix },
    },
    orderBy: { createdAt: "desc" },
    select: { description: true },
  });

  let nextNumber = 1;
  if (lastDoc?.description) {
    // "PV-2026-008-S06-003" → "003" 추출
    const match = lastDoc.description.match(new RegExp(`${docNumberPrefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(\\d+)`));
    if (match) {
      nextNumber = parseInt(match[1], 10) + 1;
    }
  }

  return `${docNumberPrefix}${String(nextNumber).padStart(3, "0")}`;
}

// ── Drive 파일명 생성 규칙 ──────────────────────────────────

/**
 * Drive 파일명에 문서 번호 접두사를 붙입니다.
 *
 * @param docNumber  - 문서 번호 (예: PV-2026-008-S06-001)
 * @param fileName   - 원본 파일명 (예: 견적서.xlsx)
 * @returns "[PV-2026-008-S06-001] 견적서.xlsx"
 */
export function buildDriveFileName(docNumber: string, fileName: string): string {
  // 이미 넘버링이 붙어있으면 그대로 반환
  if (fileName.startsWith("[PV-")) return fileName;
  return `[${docNumber}] ${fileName}`;
}

/**
 * 기존 Drive 파일명에서 넘버링 접두사를 제거하고 원본 파일명을 추출합니다.
 */
export function extractOriginalFileName(fileName: string): string {
  const match = fileName.match(/^\[PV-[^\]]+\]\s*(.+)$/);
  return match ? match[1] : fileName;
}

/**
 * 파일명에서 문서 번호를 추출합니다.
 */
export function extractDocNumber(fileName: string): string | null {
  const match = fileName.match(/^\[(PV-[^\]]+)\]/);
  return match ? match[1] : null;
}

// ── Drive 폴더명 규칙 ──────────────────────────────────────

/**
 * 프로젝트용 Drive 폴더명을 생성합니다.
 *
 * @returns "[PV-2026-008] 디티에스 모니터링 개발"
 */
export function buildProjectFolderName(
  projectNumber: string,
  projectName: string,
): string {
  return `[${projectNumber}] ${projectName}`;
}

/**
 * 단계별 하위 폴더명을 생성합니다.
 *
 * @returns "S06_견적작성"
 */
export function buildStageFolderName(stageNumber: number): string {
  const stageName = STAGE_NAMES[stageNumber] ?? `${stageNumber}단계`;
  return `S${String(stageNumber).padStart(2, "0")}_${stageName.replace(/[\s/]/g, "")}`;
}

/**
 * 모든 단계 폴더명 목록을 반환합니다. (Drive 폴더 자동 생성용)
 */
export function getAllStageFolderNames(): Array<{ stageNumber: number; folderName: string }> {
  return Array.from({ length: 10 }, (_, i) => ({
    stageNumber: i + 1,
    folderName: buildStageFolderName(i + 1),
  }));
}

// ── 프로젝트에 속한 전체 Drive 파일의 넘버링 매핑 생성 ──────

export type FileRenameMapping = {
  driveFileId: string;
  currentName: string;
  newName: string;
  stageNumber: number;
  docNumber: string;
};

/**
 * 프로젝트의 Drive 파일 목록을 받아 넘버링 매핑을 생성합니다.
 * 실제 rename은 수행하지 않고 매핑만 반환합니다.
 */
export function buildRenameMapping(
  projectNumber: string,
  files: Array<{
    id: string;
    name: string;
    stageNumber: number;
  }>,
): FileRenameMapping[] {
  // 단계별 그룹화
  const byStage = new Map<number, typeof files>();
  for (const file of files) {
    const group = byStage.get(file.stageNumber) ?? [];
    group.push(file);
    byStage.set(file.stageNumber, group);
  }

  const result: FileRenameMapping[] = [];

  for (const [stageNumber, stageFiles] of byStage.entries()) {
    const stagePrefix = `S${String(stageNumber).padStart(2, "0")}`;

    // 이미 넘버링된 파일은 건너뜀
    const filesToRename = stageFiles.filter((f) => !f.name.startsWith("[PV-"));

    filesToRename.forEach((file, idx) => {
      const docNumber = `${projectNumber}-${stagePrefix}-${String(idx + 1).padStart(3, "0")}`;
      result.push({
        driveFileId: file.id,
        currentName: file.name,
        newName: buildDriveFileName(docNumber, file.name),
        stageNumber,
        docNumber,
      });
    });
  }

  return result;
}
