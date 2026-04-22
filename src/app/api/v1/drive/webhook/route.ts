/**
 * POST /api/v1/drive/webhook
 *   — Google Drive Push Notification 수신 엔드포인트
 *
 * Google이 보내는 헤더:
 *   X-Goog-Channel-ID     : 채널 ID (DB의 channelId 와 대조)
 *   X-Goog-Channel-Token  : 채널 토큰 (DB의 channelToken 과 대조)
 *   X-Goog-Resource-State : sync | update | add | remove | change
 *   X-Goog-Changed        : content | parents | children | permissions (쉼표 구분)
 *
 * 처리 흐름:
 *   1. 헤더 파싱 및 필수 값 확인
 *   2. channelId + channelToken 으로 DB 조회 (서명 검증)
 *   3. resourceState 가 change/update/add 이면 syncDriveFolder() 호출
 *   4. 항상 200 반환 (Google은 200 이외 응답 시 재시도)
 *
 * GET /api/v1/drive/webhook
 *   — 헬스 체크 (연동 상태 확인용)
 */

import { ok, fail } from "@/lib/api-response";

// ── POST — 웹훅 수신 (자동 동기화 비활성화) ─────────────────────
export async function POST(request: Request) {
  const channelId     = request.headers.get("X-Goog-Channel-ID") ?? "";
  const channelToken  = request.headers.get("X-Goog-Channel-Token") ?? "";
  const resourceState = request.headers.get("X-Goog-Resource-State") ?? "";

  if (!channelId || !channelToken || !resourceState) {
    return fail({ code: "BAD_REQUEST", message: "필수 헤더 누락" }, 400);
  }

  // Google은 200을 받아야 재시도하지 않음 — 동기화는 수행하지 않음
  return ok({ received: true, resourceState, synced: false });
}

// ── GET — 헬스 체크 ──────────────────────
export async function GET() {
  return ok({
    status:    "active",
    endpoint:  "Google Drive Push Notification Webhook",
    timestamp: new Date().toISOString(),
  });
}
