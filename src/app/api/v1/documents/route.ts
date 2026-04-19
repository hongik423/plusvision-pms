import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api-response";
import { requireApiRole } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { DocumentType } from "@prisma/client";

export async function GET(request: NextRequest) {
  const gate = await requireApiRole("VIEWER");
  if (!gate.ok) return gate.response;

  const { searchParams } = request.nextUrl;
  const documentType = searchParams.get("documentType") as DocumentType | null;
  const q = searchParams.get("q")?.trim() ?? "";

  if (documentType && !Object.values(DocumentType).includes(documentType)) {
    return fail({ code: "VALIDATION_ERROR", message: "유효하지 않은 문서 유형입니다." }, 400);
  }

  const rows = await prisma.stageDocument.findMany({
    where: {
      storageType: "SUPABASE",
      ...(documentType ? { documentType } : {}),
      ...(q ? { fileName: { contains: q, mode: "insensitive" } } : {}),
    },
    include: {
      uploadedBy: { select: { id: true, name: true } },
      stage: {
        include: {
          project: {
            include: {
              customer: { select: { id: true, name: true } },
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const data = rows.map((doc) => ({
    id: doc.id,
    fileName: doc.fileName,
    fileUrl: doc.fileUrl,
    fileSize: doc.fileSize,
    mimeType: doc.mimeType,
    documentType: doc.documentType,
    version: doc.version,
    description: doc.description,
    createdAt: doc.createdAt,
    uploadedBy: doc.uploadedBy,
    stageNumber: doc.stage.stageNumber,
    projectId: doc.stage.project.id,
    projectName: doc.stage.project.name,
    projectNumber: doc.stage.project.projectNumber,
    customerName: doc.stage.project.customer?.name ?? null,
  }));

  return ok(data);
}
