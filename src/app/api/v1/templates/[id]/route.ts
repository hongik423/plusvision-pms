import { fail, ok } from "@/lib/api-response";
import { requireApiRole } from "@/lib/api-auth";
import { updateTemplateSchema } from "@/lib/validators";
import { updateTemplate } from "@/services/template-service";

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const gate = await requireApiRole("ADMIN");
  if (!gate.ok) {
    return gate.response;
  }

  const body = await request.json();
  const parsed = updateTemplateSchema.safeParse(body);
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

  const row = updateTemplate(params.id, parsed.data);
  if (!row) {
    return fail({ code: "NOT_FOUND", message: "템플릿을 찾을 수 없습니다." }, 404);
  }
  return ok(row);
}
