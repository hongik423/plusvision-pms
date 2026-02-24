import { fail, ok } from "@/lib/api-response";
import { requireApiRole } from "@/lib/api-auth";
import { getUserById } from "@/services/user-service";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

export async function GET() {
  const gate = await requireApiRole("VIEWER");
  if (!gate.ok) return gate.response;
  const row = await getUserById(gate.session.user.id);
  if (!row) return fail({ code: "NOT_FOUND", message: "사용자를 찾을 수 없습니다." }, 404);
  return ok(row);
}

const patchSchema = z.object({
  name: z.string().min(1, "이름을 입력해 주세요.").max(50),
});

export async function PATCH(req: Request) {
  const gate = await requireApiRole("VIEWER");
  if (!gate.ok) return gate.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail({ code: "INVALID_JSON", message: "요청 형식이 올바르지 않습니다." }, 400);
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return fail({ code: "VALIDATION_ERROR", message: parsed.error.errors[0].message }, 400);
  }

  const updated = await prisma.user.update({
    where: { id: gate.session.user.id },
    data: { name: parsed.data.name },
    select: { id: true, name: true, email: true, role: true },
  });

  return ok(updated);
}
