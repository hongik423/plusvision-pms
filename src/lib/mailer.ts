import nodemailer from "nodemailer";

type MailOptions = {
  to: string | string[];
  subject: string;
  html: string;
};

function createTransporter() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT ?? "587");
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

export async function sendMail(options: MailOptions): Promise<boolean> {
  const transporter = createTransporter();

  if (!transporter) {
    // SMTP 설정이 없으면 콘솔에 출력하고 성공 처리 (개발 환경)
    console.warn("[Mailer] SMTP 설정이 없어 이메일을 전송하지 않습니다.");
    console.info("[Mailer] 메일 내용:", {
      to: options.to,
      subject: options.subject,
    });
    return true;
  }

  const from = process.env.SMTP_FROM ?? process.env.SMTP_USER ?? "noreply@plusvision.co.kr";

  try {
    await transporter.sendMail({
      from: `"PlusPMS" <${from}>`,
      to: Array.isArray(options.to) ? options.to.join(", ") : options.to,
      subject: options.subject,
      html: options.html,
    });
    return true;
  } catch (err) {
    console.error("[Mailer] 이메일 전송 실패:", err);
    return false;
  }
}

const APP_URL = process.env.NEXTAUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001";
const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? "PlusPMS";

export function buildPasswordResetEmail(resetUrl: string) {
  return {
    subject: `[${APP_NAME}] 비밀번호 재설정 링크`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
        <h2 style="color: #1e40af;">${APP_NAME} 비밀번호 재설정</h2>
        <p>아래 버튼을 클릭하여 비밀번호를 재설정하세요.</p>
        <p style="color: #64748b; font-size: 13px;">이 링크는 1시간 후 만료됩니다.</p>
        <a href="${resetUrl}"
          style="display:inline-block;margin:24px 0;padding:12px 24px;background:#1d4ed8;color:#fff;border-radius:8px;text-decoration:none;font-weight:bold;">
          비밀번호 재설정
        </a>
        <p style="color: #94a3b8; font-size: 12px;">
          이 요청을 하지 않으셨다면 이 메일을 무시하세요.
        </p>
        <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;" />
        <p style="color: #cbd5e1; font-size: 11px;">${APP_URL}</p>
      </div>
    `,
  };
}

export function buildStageAssignedEmail(opts: {
  assigneeName: string;
  projectName: string;
  stageNumber: number;
  stageName: string;
  projectUrl: string;
}) {
  return {
    subject: `[${APP_NAME}] ${opts.projectName} — ${opts.stageNumber}단계 담당자로 배정되었습니다`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
        <h2 style="color: #1e40af;">${APP_NAME} 업무 배정 알림</h2>
        <p>안녕하세요, <strong>${opts.assigneeName}</strong>님.</p>
        <p>아래 프로젝트의 담당자로 배정되었습니다.</p>
        <table style="border-collapse:collapse;width:100%;margin:16px 0;">
          <tr>
            <td style="padding:8px;background:#f8fafc;border:1px solid #e2e8f0;font-weight:bold;width:80px;">프로젝트</td>
            <td style="padding:8px;border:1px solid #e2e8f0;">${opts.projectName}</td>
          </tr>
          <tr>
            <td style="padding:8px;background:#f8fafc;border:1px solid #e2e8f0;font-weight:bold;">단계</td>
            <td style="padding:8px;border:1px solid #e2e8f0;">${opts.stageNumber}단계 — ${opts.stageName}</td>
          </tr>
        </table>
        <a href="${opts.projectUrl}"
          style="display:inline-block;margin:8px 0;padding:12px 24px;background:#1d4ed8;color:#fff;border-radius:8px;text-decoration:none;font-weight:bold;">
          프로젝트 바로가기
        </a>
      </div>
    `,
  };
}

export function buildStageReadyEmail(opts: {
  assigneeName: string;
  projectName: string;
  stageNumber: number;
  stageName: string;
  prevStageName: string;
  projectUrl: string;
}) {
  return {
    subject: `[${APP_NAME}] ${opts.projectName} — ${opts.stageNumber}단계 진행 가능`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
        <h2 style="color: #059669;">${APP_NAME} 단계 전환 알림</h2>
        <p>안녕하세요, <strong>${opts.assigneeName}</strong>님.</p>
        <p><strong>${opts.prevStageName}</strong>이 완료되어 다음 단계를 시작할 수 있습니다.</p>
        <table style="border-collapse:collapse;width:100%;margin:16px 0;">
          <tr>
            <td style="padding:8px;background:#f8fafc;border:1px solid #e2e8f0;font-weight:bold;width:80px;">프로젝트</td>
            <td style="padding:8px;border:1px solid #e2e8f0;">${opts.projectName}</td>
          </tr>
          <tr>
            <td style="padding:8px;background:#f8fafc;border:1px solid #e2e8f0;font-weight:bold;">진행 단계</td>
            <td style="padding:8px;border:1px solid #e2e8f0;color:#059669;font-weight:bold;">${opts.stageNumber}단계 — ${opts.stageName}</td>
          </tr>
        </table>
        <a href="${opts.projectUrl}"
          style="display:inline-block;margin:8px 0;padding:12px 24px;background:#059669;color:#fff;border-radius:8px;text-decoration:none;font-weight:bold;">
          지금 시작하기
        </a>
      </div>
    `,
  };
}

export function buildSignupNotificationEmail(userName: string, userEmail: string) {
  const adminUrl = `${APP_URL}/admin/users`;
  return {
    subject: `[${APP_NAME}] 신규 회원가입 요청 — ${userName}`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
        <h2 style="color: #1e40af;">${APP_NAME} 신규 회원가입 요청</h2>
        <p>새로운 회원가입 요청이 접수되었습니다. 관리자 페이지에서 승인해 주세요.</p>
        <table style="border-collapse:collapse;width:100%;margin:16px 0;">
          <tr>
            <td style="padding:8px;background:#f8fafc;border:1px solid #e2e8f0;font-weight:bold;width:80px;">이름</td>
            <td style="padding:8px;border:1px solid #e2e8f0;">${userName}</td>
          </tr>
          <tr>
            <td style="padding:8px;background:#f8fafc;border:1px solid #e2e8f0;font-weight:bold;">이메일</td>
            <td style="padding:8px;border:1px solid #e2e8f0;">${userEmail}</td>
          </tr>
        </table>
        <a href="${adminUrl}"
          style="display:inline-block;margin:8px 0;padding:12px 24px;background:#1d4ed8;color:#fff;border-radius:8px;text-decoration:none;font-weight:bold;">
          사용자 관리 페이지로 이동
        </a>
      </div>
    `,
  };
}
