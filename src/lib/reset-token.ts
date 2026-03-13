import { createHmac, timingSafeEqual } from "crypto";

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1시간

function getSecret() {
  const secret = process.env.NEXTAUTH_SECRET;
  // [보안 수정] 프로덕션에서는 반드시 NEXTAUTH_SECRET이 설정되어 있어야 함
  if (process.env.NODE_ENV === "production" && !secret) {
    throw new Error("프로덕션 환경에서 NEXTAUTH_SECRET이 설정되지 않았습니다. 비밀번호 재설정 토큰을 생성할 수 없습니다.");
  }
  return secret ?? "pluspms-dev-secret-only";
}

/**
 * 이메일 + 타임스탬프를 HMAC-SHA256으로 서명한 재설정 토큰 생성
 */
export function createPasswordResetToken(email: string): string {
  const timestamp = Date.now().toString();
  const payload = `${email}:${timestamp}`;
  const sig = createHmac("sha256", getSecret()).update(payload).digest("hex");
  // base64url 인코딩 (URL-safe)
  return Buffer.from(`${payload}:${sig}`).toString("base64url");
}

/**
 * 토큰 검증. 유효하면 { email } 반환, 만료/위조 시 null 반환
 */
export function verifyPasswordResetToken(token: string): { email: string } | null {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf-8");
    // 형식: email:timestamp:signature
    const colonIdx = decoded.lastIndexOf(":");
    if (colonIdx === -1) return null;
    const sig = decoded.slice(colonIdx + 1);
    const payload = decoded.slice(0, colonIdx);

    // 타임스탬프 파싱
    const tsIdx = payload.lastIndexOf(":");
    if (tsIdx === -1) return null;
    const timestamp = Number(payload.slice(tsIdx + 1));
    if (Number.isNaN(timestamp)) return null;

    // 만료 검사 (1시간)
    if (Date.now() - timestamp > TOKEN_TTL_MS) return null;

    // HMAC 검증 (timing-safe)
    const expectedSig = createHmac("sha256", getSecret()).update(payload).digest("hex");
    const sigBuf = Buffer.from(sig, "hex");
    const expectedBuf = Buffer.from(expectedSig, "hex");
    if (sigBuf.length !== expectedBuf.length) return null;
    if (!timingSafeEqual(sigBuf, expectedBuf)) return null;

    const email = payload.slice(0, tsIdx);
    return { email };
  } catch {
    return null;
  }
}
