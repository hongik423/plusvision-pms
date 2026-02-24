import { fail, ok } from "@/lib/api-response";
import { requireApiRole } from "@/lib/api-auth";
import { deleteEstimate, getEstimateById, updateEstimate } from "@/services/estimate-service";

export async function GET(_request: Request, { params }: { params: { estId: string } }) {
  const gate = await requireApiRole("VIEWER");
  if (!gate.ok) {
    return gate.response;
  }
  const row = await getEstimateById(params.estId);
  if (!row) {
    return fail({ code: "NOT_FOUND", message: "견적서를 찾을 수 없습니다." }, 404);
  }
  return ok(row);
}

export async function PATCH(request: Request, { params }: { params: { estId: string } }) {
  const gate = await requireApiRole("USER");
  if (!gate.ok) {
    return gate.response;
  }
  const body = await request.json();
  const row = await updateEstimate(params.estId, body);
  return ok(row);
}

export async function DELETE(_request: Request, { params }: { params: { estId: string } }) {
  const gate = await requireApiRole("ADMIN");
  if (!gate.ok) {
    return gate.response;
  }
  await deleteEstimate(params.estId);
  return ok({ id: params.estId });
}
