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
  // Drive Watch 자동 갱신 비활성화 — 기존 채널은 만료 후 소멸됨
  return NextResponse.json({ success: true, renewed: 0, failed: 0, disabled: true });
}
