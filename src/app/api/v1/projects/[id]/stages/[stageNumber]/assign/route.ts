import { fail, ok } from "@/lib/api-response";
import { requireProjectAccess } from "@/lib/api-auth";
import { assignStageSchema, parseStageNumber } from "@/lib/validators";
import { assignStage } from "@/services/stage-service";

export async function POST(
  request: Request,
  { params }: { params: { id: string; stageNumber: string } },
) {
  const gate = await requireProjectAccess(params.id, "MANAGER");
  if (!gate.ok) {
    return gate.response;
  }

  // [N07 수정] stageNumber 정수 검증 (NaN 방지)
  const stageResult = parseStageNumber(params.stageNumber);
  if (!stageResult.ok) {
    return fail({ code: "VALIDATION_ERROR", message: stageResult.message }, 400);
  }

  const body = await request.json();
  const parsed = assignStageSchema.safeParse(body);
  if (!parsed.success) {
    return fail({ code: "VALIDATION_ERROR", message: "담당자 값을 확인해 주세요." }, 400);
  }

  // [N10 수정] try/catch 에러 핸들링 추가
  try {
    const row = await assignStage({
      projectId: params.id,
      stageNumber: stageResult.value,
      assigneeId: parsed.data.assigneeId,
    });
    return ok(row);
  } catch (error) {
    const message = error instanceof Error ? error.message : "담당자 배정 실패";
    return fail({ code: "INTERNAL_ERROR", message }, 500);
  }
}
