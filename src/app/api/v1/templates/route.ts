import { fail, ok } from "@/lib/api-response";
import { requireApiRole } from "@/lib/api-auth";
import { createTemplateSchema } from "@/lib/validators";
import { createTemplate, listTemplates } from "@/services/template-service";

export async function GET() {
  const gate = await requireApiRole("VIEWER");
  if (!gate.ok) {
    return gate.response;
  }
  return ok(listTemplates());
}

export async function POST(request: Request) {
  const gate = await requireApiRole("ADMIN");
  if (!gate.ok) {
    return gate.response;
  }
  const body = await request.json();
  const parsed = createTemplateSchema.safeParse(body);
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
  const row = createTemplate(parsed.data);
  return ok(row, { status: 201 });
}
