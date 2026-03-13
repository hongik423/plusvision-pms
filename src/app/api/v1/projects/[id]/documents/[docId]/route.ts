import { fail, ok } from "@/lib/api-response";
import { requireProjectAccess } from "@/lib/api-auth";
import { getDocumentById, deleteDocument } from "@/services/document-service";

// ── 개별 문서 조회 ──────────────────────────────────────
export async function GET(
  _request: Request,
  { params }: { params: { id: string; docId: string } },
) {
  const gate = await requireProjectAccess(params.id, "VIEWER");
  if (!gate.ok) return gate.response;

  const doc = await getDocumentById(params.docId);
  if (!doc) {
    return fail({ code: "NOT_FOUND", message: "문서를 찾을 수 없습니다." }, 404);
  }

  return ok(doc);
}

// ── 문서 삭제 (Storage + DB + 감사 로그) ────────────────
export async function DELETE(
  _request: Request,
  { params }: { params: { id: string; docId: string } },
) {
  const gate = await requireProjectAccess(params.id, "USER");
  if (!gate.ok) return gate.response;

  try {
    const deleted = await deleteDocument(params.docId, gate.session.user.id);
    if (!deleted) {
      return fail({ code: "NOT_FOUND", message: "문서를 찾을 수 없습니다." }, 404);
    }
    return ok({ deleted: true, id: params.docId });
  } catch (error) {
    return fail(
      { code: "INTERNAL_ERROR", message: error instanceof Error ? error.message : "삭제 실패" },
      500,
    );
  }
}
