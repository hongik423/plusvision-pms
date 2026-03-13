/**
 * Drive Watch 채널 자동 갱신 Cron 엔드포인트
 *
 * ─── 동작 흐름 ───────────────────────────────────────
 * Vercel Cron → GET /api/v1/drive/cron (매일 자정 UTC = 한국 09:00)
 *   → CRON_SECRET Bearer 토큰 인증 검증
 *   → 24시간 이내 만료 예정 Watch 채널 자동 갱신
 *   → 갱신 실패 시 담당자에게 인앱 알림 전송
 *
 * ─── 설정 방법 (Vercel Dashboard) ────────────────────
 * Settings → Environment Variables:
 *   CRON_SECRET          = (임의 문자열, 터미널: openssl rand -hex 32)
 *   NEXT_PUBLIC_BASE_URL = https://your-domain.com (배포 도메인)
 *
 * vercel.json (이미 설정됨):
 *   { "path": "/api/v1/drive/cron", "schedule": "0 0 * * *" }
 */
import { NextResponse } from "next/server";
import { renewExpiredWatches } from "@/services/drive-sync-service";

const CRON_SECRET = process.env.CRON_SECRET ?? "";

// ── Vercel Cron은 GET 요청을 보냄 ──────────────────────
export async function GET(request: Request) {
  // 인증: Vercel Cron은 Authorization: Bearer <CRON_SECRET> 헤더 자동 전송
  const authHeader = request.headers.get("Authorization") ?? "";
  const isBearerValid = CRON_SECRET && authHeader === `Bearer ${CRON_SECRET}`;

  if (!isBearerValid) {
    return NextResponse.json(
      { error: "Unauthorized — CRON_SECRET 환경변수를 확인하세요." },
      { status: 401 },
    );
  }

  // 웹훅 URL 결정 (Watch 채널 등록 시 필요)
  const webhookBaseUrl =
    process.env.NEXT_PUBLIC_BASE_URL ??
    (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : new URL(request.url).origin);

  try {
    const result = await renewExpiredWatches(webhookBaseUrl);
    return NextResponse.json({
      success:   true,
      renewed:   result.renewed,
      failed:    result.failed,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[Drive Cron] Watch 갱신 실패:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
