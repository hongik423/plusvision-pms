import { DocumentType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSupabaseAdmin } from "@/lib/supabase";
import { generatePlusPmsId } from "@/lib/id";

const BUCKET = "projects";

export async function listProjectDocuments(projectId: string) {
  return prisma.stageDocument.findMany({
    where: { stage: { projectId } },
    include: { uploadedBy: true, stage: true },
    orderBy: { createdAt: "desc" },
  });
}

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

  const buffer = Buffer.from(await input.file.arrayBuffer());
  const key = `${input.projectId}/stage-${input.stageNumber}/${Date.now()}-${input.file.name}`;
  const supabaseAdmin = getSupabaseAdmin();
  const upload = await supabaseAdmin.storage.from(BUCKET).upload(key, buffer, {
    contentType: input.file.type,
    upsert: false,
  });
  if (upload.error) {
    throw new Error(upload.error.message);
  }

  const urlData = supabaseAdmin.storage.from(BUCKET).getPublicUrl(key);

  return prisma.stageDocument.create({
    data: {
      id: generatePlusPmsId("stage_document"),
      stageId: stage.id,
      documentType: input.documentType,
      fileName: input.file.name,
      fileUrl: urlData.data.publicUrl,
      fileSize: input.file.size,
      mimeType: input.file.type,
      uploadedById: input.uploadedById,
      description: input.description,
    },
  });
}

export async function getDocumentById(docId: string) {
  return prisma.stageDocument.findUnique({
    where: { id: docId },
    include: { stage: true, uploadedBy: true },
  });
}

export async function deleteDocument(docId: string) {
  const doc = await prisma.stageDocument.findUnique({ where: { id: docId } });
  if (!doc) {
    return null;
  }
  return prisma.stageDocument.delete({ where: { id: docId } });
}
