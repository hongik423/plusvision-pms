import { fail, ok } from "@/lib/api-response";
import { requireProjectAccess } from "@/lib/api-auth";
import { getDocumentById, getDocumentVersions } from "@/services/document-service";

// ── 문서의 버전 이력 조회 ───────────────────────────────
export async function GET(
  _request: Request,
  { params }: { params: { id: string; docId: string } },
) {
  const gate = await requireProjectAccess(params.id, "VIEWER");
  if (!gate.ok) return gate.response;

  // 먼저 해당 문서를 찾아 stageId와 fileName 추출
  const doc = await getDocumentById(params.docId);
  if (!doc) {
    return fail({ code: "NOT_FOUND", message: "문서를 찾을 수 없습니다." }, 404);
  }

  const versions = await getDocumentVersions(doc.stageId, doc.fileName);
  return ok(versions);
}
