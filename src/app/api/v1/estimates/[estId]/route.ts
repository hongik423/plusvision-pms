import { fail, ok } from "@/lib/api-response";
import { requireEstimateAccess } from "@/lib/api-auth";
import { deleteEstimate, getEstimateById, updateEstimate } from "@/services/estimate-service";
import { updateEstimateSchema } from "@/lib/validators";

// [N04 수정] GET도 프로젝트 기반 접근 검증 적용
export async function GET(_request: Request, { params }: { params: { estId: string } }) {
  const gate = await requireEstimateAccess(params.estId, "VIEWER");
  if (!gate.ok) {
    return gate.response;
  }
  const row = await getEstimateById(params.estId);
  if (!row) {
    return fail({ code: "NOT_FOUND", message: "견적서를 찾을 수 없습니다." }, 404);
  }
  return ok(row);
}

// [N02 수정] Zod 스키마로 입력 검증 — 허용 필드만 통과
export async function PATCH(request: Request, { params }: { params: { estId: string } }) {
  const gate = await requireEstimateAccess(params.estId, "USER");
  if (!gate.ok) {
    return gate.response;
  }

  try {
    const body = await request.json();

    // ── 입력 검증: strict 모드로 미허용 필드 차단 ──
    const parsed = updateEstimateSchema.safeParse(body);
    if (!parsed.success) {
      return fail(
        {
          code: "VALIDATION_ERROR",
          message: "입력값을 확인해 주세요.",
          details: parsed.error.flatten(),
        },
        400,
      );
    }

    const row = await updateEstimate(params.estId, parsed.data);
    return ok(row);
  } catch (error) {
    const message = error instanceof Error ? error.message : "견적서 수정 중 오류가 발생했습니다.";
    return fail({ code: "INTERNAL_ERROR", message }, 500);
  }
}

// [수정] DELETE 존재 여부 확인 추가
export async function DELETE(_request: Request, { params }: { params: { estId: string } }) {
  const gate = await requireEstimateAccess(params.estId, "ADMIN");
  if (!gate.ok) {
    return gate.response;
  }

  try {
    const existing = await getEstimateById(params.estId);
    if (!existing) {
      return fail({ code: "NOT_FOUND", message: "견적서를 찾을 수 없습니다." }, 404);
    }
    await deleteEstimate(params.estId);
    return ok({ id: params.estId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "견적서 삭제 중 오류가 발생했습니다.";
    return fail({ code: "INTERNAL_ERROR", message }, 500);
  }
}
