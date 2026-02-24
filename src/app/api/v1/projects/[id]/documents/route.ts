import { DocumentType } from "@prisma/client";
import { ALLOWED_FILE_EXTENSIONS, MAX_FILE_SIZE } from "@/lib/constants";
import { fail, ok } from "@/lib/api-response";
import { requireProjectAccess } from "@/lib/api-auth";
import { listProjectDocuments, uploadProjectDocument } from "@/services/document-service";

function hasAllowedExtension(fileName: string) {
  const lower = fileName.toLowerCase();
  return ALLOWED_FILE_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const gate = await requireProjectAccess(params.id, "VIEWER");
  if (!gate.ok) {
    return gate.response;
  }
  const rows = await listProjectDocuments(params.id);
  return ok(rows);
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const gate = await requireProjectAccess(params.id, "USER");
  if (!gate.ok) {
    return gate.response;
  }

  const form = await request.formData();
  const file = form.get("file");
  const stageNumber = Number(form.get("stageNumber"));
  const documentType = String(form.get("documentType")) as DocumentType;
  const description = String(form.get("description") ?? "");

  if (!(file instanceof File)) {
    return fail({ code: "VALIDATION_ERROR", message: "파일이 필요합니다." }, 400);
  }
  if (!stageNumber) {
    return fail({ code: "VALIDATION_ERROR", message: "stageNumber가 필요합니다." }, 400);
  }
  if (!hasAllowedExtension(file.name)) {
    return fail({ code: "FILE_TYPE_NOT_ALLOWED", message: "지원하지 않는 파일 형식입니다." }, 415);
  }
  if (file.size > MAX_FILE_SIZE) {
    return fail({ code: "FILE_TOO_LARGE", message: "최대 100MB 파일만 업로드할 수 있습니다." }, 413);
  }

  try {
    const row = await uploadProjectDocument({
      projectId: params.id,
      stageNumber,
      uploadedById: gate.session.user.id,
      file,
      documentType,
      description: description || undefined,
    });
    return ok(row, { status: 201 });
  } catch (error) {
    return fail(
      {
        code: "INTERNAL_ERROR",
        message: error instanceof Error ? error.message : "업로드 실패",
      },
      500,
    );
  }
}
