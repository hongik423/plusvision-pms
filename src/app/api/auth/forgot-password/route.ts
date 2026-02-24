import { ok } from "@/lib/api-response";
import { passwordResetRequestSchema } from "@/lib/validators";
import { requestPasswordReset } from "@/services/user-service";
import { prisma } from "@/lib/prisma";
import { createPasswordResetToken } from "@/lib/reset-token";
import { sendMail, buildPasswordResetEmail } from "@/lib/mailer";

const APP_URL = process.env.NEXTAUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001";

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = passwordResetRequestSchema.safeParse(body);

  if (parsed.success) {
    const email = parsed.data.email;

    // 기존 인앱 알림 처리
    await requestPasswordReset(email);

    // 이메일 재설정 링크 발송 (계정이 존재하는 경우에만)
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, isActive: true },
    });

    if (user?.isActive) {
      const token = createPasswordResetToken(email);
      const resetUrl = `${APP_URL}/reset-password?token=${token}`;
      const mailContent = buildPasswordResetEmail(resetUrl);
      await sendMail({ to: email, ...mailContent });
    }
  }

  // 계정 존재 여부 노출 방지: 항상 동일 응답
  return ok({
    message: "이메일이 등록되어 있으면 비밀번호 재설정 링크를 발송했습니다. 받은 편지함을 확인해 주세요.",
  });
}
