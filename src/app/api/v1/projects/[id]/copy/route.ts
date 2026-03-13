import { fail, ok } from "@/lib/api-response";
import { requireProjectAccess } from "@/lib/api-auth";
import { copyProject } from "@/services/project-service";

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const gate = await requireProjectAccess(params.id, "USER");
  if (!gate.ok) {
    return gate.response;
  }

  // [N10 수정] try/catch 에러 핸들링 추가
  try {
    const copied = await copyProject(params.id, gate.session.user.id);
    if (!copied) {
      return fail({ code: "NOT_FOUND", message: "원본 프로젝트를 찾을 수 없습니다." }, 404);
    }
    return ok(copied, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "프로젝트 복사 실패";
    return fail({ code: "INTERNAL_ERROR", message }, 500);
  }
}
