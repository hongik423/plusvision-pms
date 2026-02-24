import { fail, ok } from "@/lib/api-response";
import { requireProjectAccess } from "@/lib/api-auth";
import { createEstimateSchema } from "@/lib/validators";
import { createEstimate, listProjectEstimates } from "@/services/estimate-service";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const gate = await requireProjectAccess(params.id, "VIEWER");
  if (!gate.ok) {
    return gate.response;
  }
  const rows = await listProjectEstimates(params.id);
  return ok(rows);
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const gate = await requireProjectAccess(params.id, "USER");
  if (!gate.ok) {
    return gate.response;
  }
  const body = await request.json();
  const parsed = createEstimateSchema.safeParse(body);
  if (!parsed.success) {
    return fail({ code: "VALIDATION_ERROR", message: "입력값을 확인해 주세요." }, 400);
  }
  const row = await createEstimate({
    projectId: params.id,
    createdById: gate.session.user.id,
    ...parsed.data,
  });
  return ok(row, { status: 201 });
}
