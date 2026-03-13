import { ALLOWED_FILE_EXTENSIONS, MAX_FILE_SIZE, MAX_PROJECT_STORAGE } from "@/lib/constants";
import { fail, ok } from "@/lib/api-response";
import { requireProjectAccess } from "@/lib/api-auth";
import { listProjectDocuments, uploadProjectDocument, getProjectStorageUsage } from "@/services/document-service";
import { documentTypeSchema, parseStageNumber } from "@/lib/validators";

// ── [N03 수정] 안전한 파일 확장자 검증 ──
// 이중 확장자(.pdf.exe) 방지: 마지막 확장자 + 중간 위험 확장자 검사
function isAllowedFile(fileName: string): boolean {
  const lastDotIndex = fileName.lastIndexOf(".");
  if (lastDotIndex < 1) return false;
  const ext = fileName.slice(lastDotIndex).toLowerCase();

  // 허용 확장자 목록 대조
  if (!ALLOWED_FILE_EXTENSIONS.includes(ext as typeof ALLOWED_FILE_EXTENSIONS[number])) {
    return false;
  }

  // 이중 확장자 방지: 중간에 실행 파일 확장자가 있으면 거부
  const dangerousExts = ['.exe', '.bat', '.cmd', '.com', '.scr', '.pif', '.vbs', '.js', '.msi', '.ps1', '.sh'];
  const parts = fileName.toLowerCase().split(".");
  for (let i = 1; i < parts.length - 1; i++) {
    if (dangerousExts.some(d => d === `.${parts[i]}`)) {
      return false;
    }
  }
  return true;
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
  const stageNumberRaw = String(form.get("stageNumber") ?? "");
  const documentTypeRaw = String(form.get("documentType") ?? "");
  const description = String(form.get("description") ?? "");

  if (!(file instanceof File)) {
    return fail({ code: "VALIDATION_ERROR", message: "파일이 필요합니다." }, 400);
  }

  // ── [N07 수정] stageNumber 정수 검증 (NaN 방지) ──
  const stageResult = parseStageNumber(stageNumberRaw);
  if (!stageResult.ok) {
    return fail({ code: "VALIDATION_ERROR", message: stageResult.message }, 400);
  }
  const stageNumber = stageResult.value;

  // ── [N09 수정] DocumentType enum 검증 ──
  const docTypeParsed = documentTypeSchema.safeParse(documentTypeRaw);
  if (!docTypeParsed.success) {
    return fail({ code: "VALIDATION_ERROR", message: "유효하지 않은 문서 유형입니다." }, 400);
  }
  const documentType = docTypeParsed.data;

  // ── [N03 수정] 이중 확장자 방지 포함 파일 검증 ──
  if (!isAllowedFile(file.name)) {
    return fail({ code: "FILE_TYPE_NOT_ALLOWED", message: "지원하지 않는 파일 형식입니다." }, 415);
  }

  if (file.size > MAX_FILE_SIZE) {
    return fail({ code: "FILE_TOO_LARGE", message: "최대 100MB 파일만 업로드할 수 있습니다." }, 413);
  }

  // ── [N06 수정] 프로젝트당 총 용량 제한 검증 ──
  try {
    const currentUsage = await getProjectStorageUsage(params.id);
    if (currentUsage + file.size > MAX_PROJECT_STORAGE) {
      const usedMB = Math.round(currentUsage / 1024 / 1024);
      const maxMB = Math.round(MAX_PROJECT_STORAGE / 1024 / 1024);
      return fail(
        { code: "STORAGE_LIMIT_EXCEEDED", message: `프로젝트 저장 용량 초과 (${usedMB}MB / ${maxMB}MB)` },
        413,
      );
    }
  } catch {
    // 용량 조회 실패 시 업로드 허용 (방어적 코딩)
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
      { code: "INTERNAL_ERROR", message: error instanceof Error ? error.message : "업로드 실패" },
      500,
    );
  }
}
