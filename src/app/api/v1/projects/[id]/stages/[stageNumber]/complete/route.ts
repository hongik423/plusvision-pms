import { fail, ok } from "@/lib/api-response";
import { requireProjectAccess } from "@/lib/api-auth";
import { completeStageSchema, parseStageNumber } from "@/lib/validators";
import { completeStage } from "@/services/stage-service";

export async function POST(
  request: Request,
  { params }: { params: { id: string; stageNumber: string } },
) {
  const gate = await requireProjectAccess(params.id, "USER");
  if (!gate.ok) {
    return gate.response;
  }

  // [N07 수정] stageNumber 정수 검증 (NaN 방지)
  const stageResult = parseStageNumber(params.stageNumber);
  if (!stageResult.ok) {
    return fail({ code: "VALIDATION_ERROR", message: stageResult.message }, 400);
  }

  const body = await request.json();
  const parsed = completeStageSchema.safeParse(body);
  if (!parsed.success) {
    return fail({ code: "VALIDATION_ERROR", message: "입력값을 확인해 주세요." }, 400);
  }

  try {
    const row = await completeStage({
      projectId: params.id,
      stageNumber: stageResult.value,
      userId: gate.session.user.id,
      notes: parsed.data.notes,
      status: parsed.data.status,
    });
    return ok(row);
  } catch (error) {
    return fail(
      {
        code: "STAGE_ORDER_ERROR",
        message: error instanceof Error ? error.message : "단계 완료 처리 실패",
      },
      400,
    );
  }
}
