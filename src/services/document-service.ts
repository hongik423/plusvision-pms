import { DocumentType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSupabaseAdmin } from "@/lib/supabase";
import { generatePlusPmsId } from "@/lib/id";
import { logAudit } from "@/lib/audit-logger";
import { generateDocumentNumber, buildDriveFileName } from "@/lib/naming-convention";

const BUCKET = "projects";

// ── 문서 목록 조회 (소프트 삭제된 파일 제외) ──────────────────
export async function listProjectDocuments(projectId: string) {
  return prisma.stageDocument.findMany({
    where: { stage: { projectId }, deletedAt: null },
    include: { uploadedBy: true, stage: true },
    orderBy: { createdAt: "desc" },
  });
}

// ── 문서 업로드 (버전 자동 관리 + 감사 로그) ────────────────
export async function uploadProjectDocument(input: {
  projectId: string;
  stageNumber: number;
  uploadedById: string;
  documentType: DocumentType;
  file: File;
  description?: string;
}) {
  const stage = await prisma.projectStage.findUnique({
    where: {
      projectId_stageNumber: {
        projectId: input.projectId,
        stageNumber: input.stageNumber,
      },
    },
  });
  if (!stage) {
    throw new Error("단계를 찾을 수 없습니다.");
  }

  // ── 버전 관리: 같은 단계 + 같은 파일명이 이미 있으면 version 증가 ──
  const existingDocs = await prisma.stageDocument.findMany({
    where: {
      stageId: stage.id,
      fileName: input.file.name,
    },
    orderBy: { version: "desc" },
    take: 1,
  });
  const nextVersion = existingDocs.length > 0 ? existingDocs[0].version + 1 : 1;

  // ── 문서 번호 자동 생성 (PV-2026-008-S06-001 형식) ──
  let documentNumber: string | undefined;
  try {
    const project = await prisma.project.findUnique({
      where: { id: input.projectId },
      select: { projectNumber: true },
    });
    if (project?.projectNumber) {
      documentNumber = await generateDocumentNumber(
        project.projectNumber,
        input.stageNumber,
        stage.id,
      );
    }
  } catch (err) {
    console.warn("[DocumentService] 문서 번호 생성 실패 (비필수):", err);
  }

  // description에 문서 번호를 포함 (사용자가 별도로 지정한 경우 유지)
  const finalDescription = input.description
    ? input.description
    : documentNumber ?? undefined;

  // ── Supabase Storage 업로드 ──
  const buffer = Buffer.from(await input.file.arrayBuffer());

  // 확장자 기준으로 MIME 타입 결정 — 생성 툴마다 다른 비표준 MIME 타입 무시
  const EXT_MIME: Record<string, string> = {
    ".pdf":  "application/pdf",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".xls":  "application/vnd.ms-excel",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".doc":  "application/msword",
    ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ".ppt":  "application/vnd.ms-powerpoint",
    ".hwp":  "application/x-hwp",
    ".hwpx": "application/hwp+zip",
    ".dwg":  "image/vnd.dwg",
    ".dxf":  "image/vnd.dxf",
    ".jpg":  "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png":  "image/png",
    ".gif":  "image/gif",
  };
  const fileExt = input.file.name.slice(input.file.name.lastIndexOf(".")).toLowerCase();
  const normalizedMimeType = EXT_MIME[fileExt] ?? input.file.type;
  // 넘버링이 있으면 파일명에 접두사 부여
  const storedFileName = documentNumber
    ? buildDriveFileName(documentNumber, input.file.name)
    : input.file.name;
  // Storage key는 ASCII만 허용 — 확장자만 유지하고 나머지는 타임스탬프로 대체
  const key = `${input.projectId}/stage-${input.stageNumber}/${Date.now()}${fileExt}`;
  const supabaseAdmin = getSupabaseAdmin();
  const upload = await supabaseAdmin.storage.from(BUCKET).upload(key, buffer, {
    contentType: "application/octet-stream",
    upsert: false,
  });
  if (upload.error) {
    throw new Error(upload.error.message);
  }

  const urlData = supabaseAdmin.storage.from(BUCKET).getPublicUrl(key);

  // ── DB 기록 ──
  const doc = await prisma.stageDocument.create({
    data: {
      id: generatePlusPmsId("stage_document"),
      stageId: stage.id,
      documentType: input.documentType,
      fileName: storedFileName,
      fileUrl: urlData.data.publicUrl,
      fileSize: input.file.size,
      mimeType: normalizedMimeType,
      version: nextVersion,
      uploadedById: input.uploadedById,
      description: finalDescription,
    },
  });

  // ── 감사 로그 ──
  await logAudit({
    userId: input.uploadedById,
    projectId: input.projectId,
    action: "DOCUMENT_UPLOAD",
    entityType: "DOCUMENT",
    entityId: doc.id,
    changes: {
      fileName: input.file.name,
      fileSize: input.file.size,
      mimeType: input.file.type,
      documentType: input.documentType,
      stageNumber: input.stageNumber,
      version: nextVersion,
    },
  });

  return doc;
}

// ── 프로젝트별 총 저장 용량 조회 ─────────────────────────────
export async function getProjectStorageUsage(projectId: string): Promise<number> {
  const result = await prisma.stageDocument.aggregate({
    where: { stage: { projectId } },
    _sum: { fileSize: true },
  });
  return result._sum.fileSize ?? 0;
}

// ── 개별 문서 조회 ──────────────────────────────────────────
export async function getDocumentById(docId: string) {
  return prisma.stageDocument.findUnique({
    where: { id: docId },
    include: { stage: true, uploadedBy: true },
  });
}

// ── 문서의 버전 이력 조회 ───────────────────────────────────
export async function getDocumentVersions(stageId: string, fileName: string) {
  return prisma.stageDocument.findMany({
    where: { stageId, fileName },
    include: { uploadedBy: { select: { id: true, name: true } } },
    orderBy: { version: "desc" },
  });
}

// ── 문서 삭제 (소프트 삭제 — 30일 후 자동 완전 삭제) ──────────
export async function deleteDocument(docId: string, deletedById: string) {
  const doc = await prisma.stageDocument.findUnique({
    where: { id: docId, deletedAt: null },
    include: { stage: { select: { projectId: true, stageNumber: true } } },
  });
  if (!doc) return null;

  const deleted = await prisma.stageDocument.update({
    where: { id: docId },
    data: { deletedAt: new Date() },
  });

  await logAudit({
    userId: deletedById,
    projectId: doc.stage.projectId,
    action: "DOCUMENT_DELETE",
    entityType: "DOCUMENT",
    entityId: docId,
    changes: {
      fileName: doc.fileName,
      fileSize: doc.fileSize,
      documentType: doc.documentType,
      stageNumber: doc.stage.stageNumber,
      version: doc.version,
    },
  });

  return deleted;
}

// ── 문서 복구 (deletedAt 제거) ───────────────────────────────
export async function restoreDocument(docId: string) {
  const doc = await prisma.stageDocument.findUnique({
    where: { id: docId },
  });
  if (!doc || !doc.deletedAt) return null;

  return prisma.stageDocument.update({
    where: { id: docId },
    data: { deletedAt: null },
  });
}

// ── 30일 경과 파일 완전 삭제 (cron용) ───────────────────────
export async function purgeExpiredDocuments() {
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const expired = await prisma.stageDocument.findMany({
    where: { deletedAt: { lte: cutoff } },
  });

  const supabaseAdmin = getSupabaseAdmin();
  for (const doc of expired) {
    if (doc.storageType === "SUPABASE" && doc.fileUrl) {
      try {
        const marker = `/storage/v1/object/public/${BUCKET}/`;
        const idx = doc.fileUrl.indexOf(marker);
        if (idx >= 0) {
          const storageKey = doc.fileUrl.slice(idx + marker.length);
          await supabaseAdmin.storage.from(BUCKET).remove([storageKey]);
        }
      } catch (err) {
        console.error("[purgeExpiredDocuments] Storage 삭제 실패:", err);
      }
    }
    await prisma.stageDocument.delete({ where: { id: doc.id } });
  }

  return expired.length;
}
