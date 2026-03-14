/**
 * GET /api/v1/projects/:id/drive/stage-files
 *
 * Google Drive에서 프로젝트 파일을 직접 읽어 단계별로 분류하여 반환합니다.
 * Supabase Storage 동기화 없이 경량으로 동작합니다.
 *
 * 파일 탐색 순서:
 *   1. ProjectDriveLink 테이블에 등록된 폴더
 *   2. 없으면 customer.name → KNOWN_PROJECT_GROUPS 매핑으로 자동 감지
 *
 * Response:
 *   {
 *     driveFolderId: string,
 *     folderName: string,
 *     totalFiles: number,
 *     stageFiles: { [stageNumber: string]: DriveStageFile[] }
 *   }
 */

import { fail, ok } from "@/lib/api-response";
import { requireProjectAccess } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { prismaDrive } from "@/lib/prisma-drive";
import {
  createGoogleDriveAdapter,
  isGoogleNativeType,
  getExportInfo,
  type DriveFileDescriptor,
} from "@/scripts/migration/google-drive-adapter";
import { KNOWN_PROJECT_GROUPS, inferStageFromFolderName } from "@/lib/drive-config";

export const dynamic = "force-dynamic";

// ── 상위 폴더명 → 단계 추론 (확장 버전) ──
function inferStageFromPath(topFolderLower: string): { stageNumber: number; documentType: string } | null {
  // 9단계: 실적/정산/매출
  if (topFolderLower.includes("실적") || topFolderLower.includes("정산") || topFolderLower.includes("매출")) {
    return { stageNumber: 9, documentType: "OTHER" };
  }
  // 6단계: 견적/발주/단가
  if (topFolderLower.includes("견적") || topFolderLower.includes("발주") || topFolderLower.includes("단가") || topFolderLower.includes("y2k")) {
    return { stageNumber: 6, documentType: "ESTIMATE" };
  }
  // 7단계: 제작/보드/선박/dpf/도면/부품/패널/개발
  if (
    topFolderLower.includes("제작") || topFolderLower.includes("보드") ||
    topFolderLower.includes("선박") || topFolderLower.includes("dpf") ||
    topFolderLower.includes("도면") || topFolderLower.includes("부품") ||
    topFolderLower.includes("패널") || topFolderLower.includes("개발") ||
    topFolderLower.includes("dts사") || topFolderLower.includes("dts社")
  ) {
    return { stageNumber: 7, documentType: "OTHER" };
  }
  // 8단계: 설치/납품
  if (topFolderLower.includes("설치") || topFolderLower.includes("납품")) {
    return { stageNumber: 8, documentType: "INSTALL_MANUAL" };
  }
  // 3단계: 현장/사진/회의/협의/영광(현장)
  if (
    topFolderLower.includes("현장") || topFolderLower.includes("사진") ||
    topFolderLower.includes("회의") || topFolderLower.includes("협의") ||
    topFolderLower.includes("영광")
  ) {
    return { stageNumber: 3, documentType: "SITE_PHOTO" };
  }
  // 5단계: 채권/계약
  if (topFolderLower.includes("채권") || topFolderLower.includes("계약")) {
    return { stageNumber: 5, documentType: "OTHER" };
  }
  // 1단계: 의뢰/접수/업무
  if (topFolderLower.includes("의뢰") || topFolderLower.includes("접수") || topFolderLower.includes("업무")) {
    return { stageNumber: 1, documentType: "OTHER" };
  }
  return null; // 분류 불가
}

// ── 파일명 → 단계 추론 ──
function inferStageFromFileName(name: string): { stageNumber: number; documentType: string } {
  // ① 재무/정산/매출 (9단계) — 먼저 확인
  if (
    name.includes("매출") || name.includes("매입") || name.includes("정산") ||
    name.includes("단가") || name.includes("정리 - 복사본") || name.includes("정리.") ||
    name.includes("실적")
  ) return { stageNumber: 9, documentType: "OTHER" };

  // ② 견적/발주/단가/제안 (6단계)
  if (name.includes("견적") || name.includes("estimate")) return { stageNumber: 6, documentType: "ESTIMATE" };
  if (name.includes("발주") || name.includes("주문")) return { stageNumber: 6, documentType: "ESTIMATE" };
  if (name.includes("제안") || name.includes("proposal")) return { stageNumber: 6, documentType: "PROPOSAL" };
  if (name.includes("단가") || name.includes("㎾별") || name.includes("kw별")) return { stageNumber: 6, documentType: "ESTIMATE" };

  // ③ 회의록 → 3단계
  if (name.includes("회의록") || name.includes("meeting")) return { stageNumber: 3, documentType: "MEETING_NOTE" };

  // ④ 현장 사진 → 3단계
  if (name.includes("현장") || name.includes("사진")) return { stageNumber: 3, documentType: "SITE_PHOTO" };

  // ⑤ 반출 → 3단계
  if (name.includes("반출")) return { stageNumber: 3, documentType: "EXPORT_RECORD" };

  // ⑥ 설치 매뉴얼 → 8단계 (납품/설치)
  if (name.includes("설치") && name.includes("매뉴얼")) return { stageNumber: 8, documentType: "INSTALL_MANUAL" };
  if (name.includes("납품") || name.includes("install delivery")) return { stageNumber: 8, documentType: "INSTALL_MANUAL" };

  // ⑦ 제작 매뉴얼 → 7단계
  if (name.includes("제작") && name.includes("매뉴얼")) return { stageNumber: 7, documentType: "MANUFACTURE_MANUAL" };

  // ⑧ 기술 개발/제작 문서 → 7단계 (도면, 배선, 레이아웃, 패널, 보드, 선박, DPF, 릴레이, LCD, 차압, 메뉴 구조)
  if (/\.(dwg|dxf)$/i.test(name) || name.includes("도면") || name.includes("drawing")) {
    return { stageNumber: 7, documentType: "DRAWING" };
  }
  if (
    name.includes("배선") || name.includes("레이아웃") || name.includes("패널") ||
    name.includes("보드") || name.includes("릴레이") || name.includes("lcd") ||
    name.includes("메뉴 구조") || name.includes("메뉴구조") ||
    name.includes("차압") || name.includes("dpf") || name.includes("선박") ||
    name.includes("모니터링") || name.includes("매연저감") ||
    name.includes("부품") || name.includes("파트") || name.includes("parts")
  ) return { stageNumber: 7, documentType: name.includes("부품") || name.includes("파트") ? "PARTS_LIST" : "OTHER" };

  // ⑨ 이미지 파일 → 7단계 (제품/작업 사진으로 처리)
  if (/\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(name)) return { stageNumber: 7, documentType: "SITE_PHOTO" };

  // ⑩ 채권/계약 → 5단계
  if (name.includes("채권") || name.includes("계약") || name.includes("bond")) {
    return { stageNumber: 5, documentType: "OTHER" };
  }

  // ⑪ 업무 진행 내용 → 1단계
  if (name.includes("업무") || name.includes("진행 내용") || name.includes("진행내용")) {
    return { stageNumber: 1, documentType: "OTHER" };
  }

  // ⑫ 기본값: 10단계 (최종 문서)
  return { stageNumber: 10, documentType: "OTHER" };
}

// ── 파일 분류 메인 함수 ──
function classifyDriveFile(
  file: DriveFileDescriptor,
  linkedStageNumber?: number | null,
): { stageNumber: number; documentType: string } {
  const name = file.name.toLowerCase();
  const path = (file.relativePath ?? "").toLowerCase();

  // 1) 경로에서 "stage-3", "3단계", "step3" 형태의 명시적 단계 번호 추출
  const stageMatch = path.match(/(?:stage[-_]?|단계[-_]?|step[-_]?)(\d+)/);
  if (stageMatch) {
    const n = Number(stageMatch[1]);
    if (n >= 1 && n <= 10) return { stageNumber: n, documentType: guessDocType(name) };
  }

  // 2) 상위 폴더명으로 단계 추론 (확장 키워드)
  if (file.relativePath) {
    const topFolder = file.relativePath.split("/")[0].toLowerCase();
    if (topFolder) {
      const folderInferred = inferStageFromPath(topFolder);
      if (folderInferred) return folderInferred;
    }
  }

  // 3) linkedStageNumber가 있고 파일명으로 추론이 10단계인 경우 사용
  const fileInferred = inferStageFromFileName(name);
  if (fileInferred.stageNumber !== 10) return fileInferred;

  // 4) linkedStageNumber 우선
  if (linkedStageNumber && linkedStageNumber >= 1 && linkedStageNumber <= 10) {
    return { stageNumber: linkedStageNumber, documentType: guessDocType(name) };
  }

  return fileInferred; // 기본 10단계
}

function guessDocType(name: string): string {
  if (name.includes("견적") || name.includes("발주") || name.includes("단가")) return "ESTIMATE";
  if (name.includes("제안") || name.includes("proposal")) return "PROPOSAL";
  if (name.includes("도면") || /\.(dwg|dxf)$/i.test(name)) return "DRAWING";
  if (name.includes("회의록")) return "MEETING_NOTE";
  if (/\.(jpg|jpeg|png|gif)$/i.test(name)) return "SITE_PHOTO";
  if (name.includes("부품") || name.includes("파트")) return "PARTS_LIST";
  return "OTHER";
}

// ── Drive 파일 → 표시용 타입 변환 ──
type DriveStageFile = {
  id: string;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  mimeType: string;
  documentType: string;
  modifiedTime: string | null;
  relativePath: string | null;
  isGoogleNative: boolean;
};

function toStageFile(file: DriveFileDescriptor): DriveStageFile {
  const isNative = isGoogleNativeType(file.mimeType);
  const exportInfo = isNative ? getExportInfo(file.mimeType) : null;

  // Google 문서는 webViewLink, 일반 파일은 direct download URL
  const fileUrl = file.webViewLink
    ?? `https://drive.google.com/file/d/${file.id}/view`;

  return {
    id: file.id,
    fileName: exportInfo ? `${file.name}${exportInfo.ext}` : file.name,
    fileUrl,
    fileSize: file.size ?? 0,
    mimeType: exportInfo ? exportInfo.exportMimeType : file.mimeType,
    documentType: "OTHER",
    modifiedTime: file.modifiedTime ?? null,
    relativePath: file.relativePath ?? null,
    isGoogleNative: isNative,
  };
}

// ── GET 핸들러 ──
export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const gate = await requireProjectAccess(params.id, "VIEWER");
  if (!gate.ok) return gate.response;

  try {
    // ── 1. Drive 폴더 ID 결정 ──
    let driveFolderId: string | null = null;
    let folderName = "";

    // 1-a. ProjectDriveLink 테이블에서 조회
    const links = await prismaDrive.driveLink.findMany({
      where: { projectId: params.id, isActive: true },
    });

    if (links.length > 0) {
      // 첫 번째 활성 링크 사용 (stageNumber가 null인 프로젝트 전체 링크 우선)
      const projectLink = links.find((l) => !l.stageNumber) ?? links[0];
      driveFolderId = projectLink.driveFolderId;
      folderName = projectLink.folderName ?? "Drive 폴더";
    }

    // 1-b. 없으면 customer.name / project.name → KNOWN_PROJECT_GROUPS 자동 매핑
    if (!driveFolderId) {
      const project = await prisma.project.findUnique({
        where: { id: params.id },
        include: { customer: { select: { name: true } } },
      });

      // 고객명과 프로젝트명 모두 매칭 시도
      const searchNames = [
        project?.customer?.name,
        project?.name,
      ].filter(Boolean) as string[];

      for (const searchName of searchNames) {
        if (driveFolderId) break;

        // 정확 일치
        const exactMatch = KNOWN_PROJECT_GROUPS[searchName];
        if (exactMatch) {
          driveFolderId = exactMatch;
          folderName = searchName;
          break;
        }

        // 부분 일치 (고객명이 "디티에스(주)", "DTS", "디티에스 xxxx" 같은 형태일 수 있음)
        for (const [groupName, groupId] of Object.entries(KNOWN_PROJECT_GROUPS)) {
          if (
            searchName.includes(groupName) ||
            groupName.includes(searchName) ||
            searchName.toLowerCase().includes(groupName.toLowerCase())
          ) {
            driveFolderId = groupId;
            folderName = groupName;
            break;
          }
        }
      }
    }

    if (!driveFolderId) {
      return ok({
        driveFolderId: null,
        folderName: "",
        totalFiles: 0,
        stageFiles: {},
        message: "이 프로젝트에 연결된 Google Drive 폴더가 없습니다.",
      });
    }

    // ── 2. Google Drive API로 파일 재귀 탐색 ──
    const adapter = createGoogleDriveAdapter();
    const allFiles = await adapter.listFilesRecursive(driveFolderId, "");

    // 폴더 제외
    const files = allFiles.filter(
      (f) => f.mimeType !== "application/vnd.google-apps.folder",
    );

    // ── 3. 단계별 분류 ──
    const stageFiles: Record<string, DriveStageFile[]> = {};
    for (let i = 1; i <= 10; i++) stageFiles[String(i)] = [];

    for (const file of files) {
      const classified = classifyDriveFile(file);
      const stageFile = toStageFile(file);
      stageFile.documentType = classified.documentType;
      stageFiles[String(classified.stageNumber)].push(stageFile);
    }

    // 각 단계 내 정렬 (수정일 최신순)
    for (const key of Object.keys(stageFiles)) {
      stageFiles[key].sort((a, b) => {
        if (a.modifiedTime && b.modifiedTime) {
          return new Date(b.modifiedTime).getTime() - new Date(a.modifiedTime).getTime();
        }
        return a.fileName.localeCompare(b.fileName, "ko");
      });
    }

    return ok({
      driveFolderId,
      folderName,
      totalFiles: files.length,
      stageFiles,
    });
  } catch (error) {
    console.error("[DriveStageFiles] 오류:", error);
    const message = error instanceof Error ? error.message : "Drive 파일 조회 실패";
    return fail({ code: "INTERNAL_ERROR", message }, 500);
  }
}
