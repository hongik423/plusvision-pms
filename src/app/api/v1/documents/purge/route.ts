/**
 * GET /api/v1/documents/purge
 * 삭제된 지 30일 이상 경과한 파일을 Storage + DB에서 완전 삭제
 * Vercel Cron: 매일 03:00 UTC (한국 12:00)
 */
import { NextResponse } from "next/server";
import { purgeExpiredDocuments } from "@/services/document-service";

const CRON_SECRET = process.env.CRON_SECRET ?? "";

export async function GET(request: Request) {
  const authHeader = request.headers.get("Authorization") ?? "";
  if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const count = await purgeExpiredDocuments();
    return NextResponse.json({ success: true, purged: count, timestamp: new Date().toISOString() });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
