import { fail, ok } from "@/lib/api-response";
import { requireProjectAccess } from "@/lib/api-auth";
import { createManualSchema } from "@/lib/validators";
import { createManual, listProjectManuals } from "@/services/manual-service";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const gate = await requireProjectAccess(params.id, "VIEWER");
  if (!gate.ok) {
    return gate.response;
  }

  const rows = await listProjectManuals(params.id);
  return ok(rows);
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const gate = await requireProjectAccess(params.id, "USER");
  if (!gate.ok) {
    return gate.response;
  }

  const body = await request.json();
  const parsed = createManualSchema.safeParse(body);
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

  const row = await createManual({
    ...parsed.data,
    projectId: params.id,
    createdById: gate.session.user.id,
  });
  return ok(row, { status: 201 });
}
