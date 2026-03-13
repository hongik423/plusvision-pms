import { fail, ok } from "@/lib/api-response";
import { requireApiRole, requireProjectAccess } from "@/lib/api-auth";
import { deleteProject, getProjectById, updateProject } from "@/services/project-service";
import { updateProjectSchema } from "@/lib/validators";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const gate = await requireProjectAccess(params.id, "VIEWER");
  if (!gate.ok) {
    return gate.response;
  }

  const row = await getProjectById(params.id);
  if (!row) {
    return fail({ code: "NOT_FOUND", message: "프로젝트를 찾을 수 없습니다." }, 404);
  }
  return ok(row);
}

// [N01 수정] Zod 스키마로 입력 검증 + try/catch 에러 핸들링
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const gate = await requireProjectAccess(params.id, "MANAGER");
  if (!gate.ok) {
    return gate.response;
  }

  try {
    const body = await request.json();

    // ── 입력 검증: 허용 필드만 통과 (strict 모드) ──
    const parsed = updateProjectSchema.safeParse(body);
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

    const row = await updateProject(params.id, parsed.data);
    return ok(row);
  } catch (error) {
    const message = error instanceof Error ? error.message : "프로젝트 수정 중 오류가 발생했습니다.";
    return fail({ code: "INTERNAL_ERROR", message }, 500);
  }
}

// [N05 수정] 삭제 전 존재 여부 확인 + try/catch
export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const gate = await requireApiRole("ADMIN");
  if (!gate.ok) {
    return gate.response;
  }

  try {
    const existing = await getProjectById(params.id);
    if (!existing) {
      return fail({ code: "NOT_FOUND", message: "프로젝트를 찾을 수 없습니다." }, 404);
    }

    await deleteProject(params.id);
    return ok({ id: params.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "프로젝트 삭제 중 오류가 발생했습니다.";
    return fail({ code: "INTERNAL_ERROR", message }, 500);
  }
}
