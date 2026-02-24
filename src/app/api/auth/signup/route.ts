import { fail, ok } from "@/lib/api-response";
import { signupSchema } from "@/lib/validators";
import { requestSignup } from "@/services/user-service";
import { prisma } from "@/lib/prisma";
import { sendMail, buildSignupNotificationEmail } from "@/lib/mailer";

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = signupSchema.safeParse(body);
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

  try {
    const row = await requestSignup(parsed.data);

    // 관리자에게 이메일 알림 발송 (비동기, 실패해도 회원가입은 완료)
    void (async () => {
      try {
        const admins = await prisma.user.findMany({
          where: { role: "ADMIN", isActive: true },
          select: { email: true },
        });
        if (admins.length > 0) {
          const adminEmails = admins.map((a) => a.email);
          const mailContent = buildSignupNotificationEmail(parsed.data.name, parsed.data.email);
          await sendMail({ to: adminEmails, ...mailContent });
        }
      } catch (err) {
        console.error("[Signup] 관리자 알림 이메일 실패:", err);
      }
    })();

    return ok(
      {
        id: row.id,
        email: row.email,
        isActive: row.isActive,
      },
      { status: 201 },
    );
  } catch (error) {
    return fail(
      {
        code: "DUPLICATE_ENTRY",
        message: error instanceof Error ? error.message : "회원가입 요청에 실패했습니다.",
      },
      409,
    );
  }
}
