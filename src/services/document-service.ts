import { DocumentType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSupabaseAdmin } from "@/lib/supabase";
import { generatePlusPmsId } from "@/lib/id";
import { logAudit } from "@/lib/audit-logger";
import { generateDocumentNumber, buildDriveFileName } from "@/lib/naming-convention";

const BUCKET = "projects";

// ── 문서 목록 조회 ──────────────────────────────────────────
export async function listProjectDocuments(projectId: string) {
  return prisma.stageDocument.findMany({
    where: { stage: { projectId } },
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
  // 넘버링이 있으면 파일명에 접두사 부여
  const storedFileName = documentNumber
    ? buildDriveFileName(documentNumber, input.file.name)
    : input.file.name;
  // Supabase Storage key에서 대괄호, 공백 등 허용되지 않는 문자 제거
  const safeFileName = storedFileName.replace(/[\[\]]/g, "").replace(/\s+/g, "_");
  const key = `${input.projectId}/stage-${input.stageNumber}/${Date.now()}-${safeFileName}`;
  const supabaseAdmin = getSupabaseAdmin();
  const upload = await supabaseAdmin.storage.from(BUCKET).upload(key, buffer, {
    contentType: input.file.type,
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
      mimeType: input.file.type,
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

// ── 문서 삭제 (Storage 파일도 삭제 + 감사 로그) ─────────────
export async function deleteDocument(docId: string, deletedById: string) {
  const doc = await prisma.stageDocument.findUnique({
    where: { id: docId },
    include: { stage: { select: { projectId: true, stageNumber: true } } },
  });
  if (!doc) {
    return null;
  }

  // ── Supabase Storage에서 실제 파일 삭제 ──
  if (doc.storageType === "SUPABASE" && doc.fileUrl) {
    try {
      const marker = `/storage/v1/object/public/${BUCKET}/`;
      const idx = doc.fileUrl.indexOf(marker);
      if (idx >= 0) {
        const storageKey = doc.fileUrl.slice(idx + marker.length);
        const supabaseAdmin = getSupabaseAdmin();
        const { error } = await supabaseAdmin.storage.from(BUCKET).remove([storageKey]);
        if (error) {
          console.error("[DocumentService] Storage 파일 삭제 실패:", error.message);
        }
      }
    } catch (err) {
      console.error("[DocumentService] Storage 파일 삭제 중 오류:", err);
    }
  }

  // ── DB 삭제 ──
  const deleted = await prisma.stageDocument.delete({ where: { id: docId } });

  // ── 감사 로그 ──
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
