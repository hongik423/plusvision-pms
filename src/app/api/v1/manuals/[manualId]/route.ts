import { fail, ok } from "@/lib/api-response";
import { requireApiRole } from "@/lib/api-auth";
import { updateManualSchema } from "@/lib/validators";
import { getManualById, updateManual } from "@/services/manual-service";

export async function GET(_request: Request, { params }: { params: { manualId: string } }) {
  const gate = await requireApiRole("VIEWER");
  if (!gate.ok) {
    return gate.response;
  }

  const row = await getManualById(params.manualId);
  if (!row) {
    return fail({ code: "NOT_FOUND", message: "매뉴얼을 찾을 수 없습니다." }, 404);
  }

  return ok(row);
}

export async function PATCH(request: Request, { params }: { params: { manualId: string } }) {
  const gate = await requireApiRole("USER");
  if (!gate.ok) {
    return gate.response;
  }

  const body = await request.json();
  const parsed = updateManualSchema.safeParse(body);
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

  const row = await updateManual(params.manualId, parsed.data);
  return ok(row);
}
