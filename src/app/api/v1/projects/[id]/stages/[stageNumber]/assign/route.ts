import { fail, ok } from "@/lib/api-response";
import { requireProjectAccess } from "@/lib/api-auth";
import { assignStageSchema } from "@/lib/validators";
import { assignStage } from "@/services/stage-service";

export async function POST(
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
    return fail({ code: "VALIDATION_ERROR", message: "담당자 값을 확인해 주세요." }, 400);
  }

  const row = await assignStage({
    projectId: params.id,
    stageNumber: Number(params.stageNumber),
    assigneeId: parsed.data.assigneeId,
  });
  return ok(row);
}
