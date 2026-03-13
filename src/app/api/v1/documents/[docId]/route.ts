import { fail, ok } from "@/lib/api-response";
import { requireApiRole } from "@/lib/api-auth";
import { deleteDocument, getDocumentById } from "@/services/document-service";

export async function GET(_request: Request, { params }: { params: { docId: string } }) {
  const gate = await requireApiRole("VIEWER");
  if (!gate.ok) {
    return gate.response;
  }
  const row = await getDocumentById(params.docId);
  if (!row) {
    return fail({ code: "NOT_FOUND", message: "문서를 찾을 수 없습니다." }, 404);
  }
  return ok(row);
}

export async function DELETE(_request: Request, { params }: { params: { docId: string } }) {
  const gate = await requireApiRole("ADMIN");
  if (!gate.ok) {
    return gate.response;
  }
  const row = await deleteDocument(params.docId, gate.session.user.id);
  if (!row) {
    return fail({ code: "NOT_FOUND", message: "문서를 찾을 수 없습니다." }, 404);
  }
  return ok({ id: params.docId });
}
