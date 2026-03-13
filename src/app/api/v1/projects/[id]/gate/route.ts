import { fail, ok } from "@/lib/api-response";
import { requireProjectAccess } from "@/lib/api-auth";
import { checkGate, getProjectPhaseInfo } from "@/services/gate-service";

/**
 * GET /api/v1/projects/:id/gate
 * 현재 프로젝트의 Phase 정보 및 게이트 상태 조회
 */
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const gate = await requireProjectAccess(params.id, "VIEWER");
  if (!gate.ok) {
    return gate.response;
  }

  try {
    const phaseInfo = await getProjectPhaseInfo(params.id);
    if (!phaseInfo) {
      return fail({ code: "NOT_FOUND", message: "프로젝트를 찾을 수 없습니다." }, 404);
    }

    // 현재 단계에 게이트가 있으면 검증 결과 포함
    const gateCheck = await checkGate(params.id, phaseInfo.currentStage);

    return ok({
      ...phaseInfo,
      gateCheck,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Phase 정보 조회 실패";
    return fail({ code: "INTERNAL_ERROR", message }, 500);
  }
}
