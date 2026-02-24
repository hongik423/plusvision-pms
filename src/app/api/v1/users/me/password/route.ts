import { fail, ok } from "@/lib/api-response";
import { requireApiRole } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { compare, hash } from "bcryptjs";
import { z } from "zod";

const schema = z.object({
  currentPassword: z.string().min(1, "현재 비밀번호를 입력해 주세요."),
  newPassword: z
    .string()
    .min(8, "새 비밀번호는 8자 이상이어야 합니다.")
    .max(100),
});

export async function POST(req: Request) {
  const gate = await requireApiRole("VIEWER");
  if (!gate.ok) return gate.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail({ code: "INVALID_JSON", message: "요청 형식이 올바르지 않습니다." }, 400);
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return fail({ code: "VALIDATION_ERROR", message: parsed.error.errors[0].message }, 400);
  }

  const user = await prisma.user.findUnique({
    where: { id: gate.session.user.id },
    select: { id: true, password: true },
  });

  if (!user) {
    return fail({ code: "NOT_FOUND", message: "사용자를 찾을 수 없습니다." }, 404);
  }

  // 소셜 로그인(비밀번호 없음) 계정 처리
  if (!user.password) {
    return fail({ code: "NO_PASSWORD", message: "소셜 로그인 계정은 비밀번호를 변경할 수 없습니다." }, 400);
  }

  const isValid = await compare(parsed.data.currentPassword, user.password);
  if (!isValid) {
    return fail({ code: "WRONG_PASSWORD", message: "현재 비밀번호가 올바르지 않습니다." }, 400);
  }

  const hashed = await hash(parsed.data.newPassword, 12);
  await prisma.user.update({
    where: { id: user.id },
    data: { password: hashed },
  });

  return ok({ message: "비밀번호가 변경되었습니다." });
}
