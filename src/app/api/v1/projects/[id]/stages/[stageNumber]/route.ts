import { fail, ok } from "@/lib/api-response";
import { requireProjectAccess } from "@/lib/api-auth";
import { assignStageSchema } from "@/lib/validators";
import { assignStage, getStage } from "@/services/stage-service";

export async function GET(
  _request: Request,
  { params }: { params: { id: string; stageNumber: string } },
) {
  const gate = await requireProjectAccess(params.id, "VIEWER");
  if (!gate.ok) {
    return gate.response;
  }
  const row = await getStage(params.id, Number(params.stageNumber));
  if (!row) {
    return fail({ code: "NOT_FOUND", message: "단계를 찾을 수 없습니다." }, 404);
  }
  return ok(row);
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string; stageNumber: string } },
) {
  const gate = await requireProjectAccess(params.id, "MANAGER");
  if (!gate.ok) {
    return gate.response;
  }

  const body = await request.json();
  const parsed = assignStageSchema.safeParse(body);
  if (!parsed.success) {
    return fail({ code: "VALIDATION_ERROR", message: "담당자를 확인해 주세요." }, 400);
  }

  const row = await assignStage({
    projectId: params.id,
    stageNumber: Number(params.stageNumber),
    assigneeId: parsed.data.assigneeId,
  });
  return ok(row);
}
