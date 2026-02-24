import { fail, ok } from "@/lib/api-response";
import { verifyPasswordResetToken } from "@/lib/reset-token";
import { prisma } from "@/lib/prisma";
import { hash } from "bcryptjs";
import { z } from "zod";

const schema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(8, "새 비밀번호는 8자 이상이어야 합니다.").max(100),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail({ code: "INVALID_JSON", message: "요청 형식이 올바르지 않습니다." }, 400);
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return fail({ code: "VALIDATION_ERROR", message: parsed.error.errors[0].message }, 400);
  }

  const result = verifyPasswordResetToken(parsed.data.token);
  if (!result) {
    return fail(
      { code: "INVALID_TOKEN", message: "재설정 링크가 만료되었거나 유효하지 않습니다. 다시 요청해 주세요." },
      400,
    );
  }

  const user = await prisma.user.findUnique({
    where: { email: result.email },
    select: { id: true, isActive: true },
  });

  if (!user || !user.isActive) {
    return fail({ code: "NOT_FOUND", message: "계정을 찾을 수 없습니다." }, 404);
  }

  const hashed = await hash(parsed.data.newPassword, 12);
  await prisma.user.update({
    where: { id: user.id },
    data: { password: hashed },
  });

  return ok({ message: "비밀번호가 성공적으로 재설정되었습니다. 새 비밀번호로 로그인해 주세요." });
}
