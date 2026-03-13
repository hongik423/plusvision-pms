import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

/**
 * Supabase + Vercel 서버리스 최적 연결 설정
 *
 * DATABASE_URL (Vercel 환경변수):
 *   Transaction pooler → port 6543 + pgbouncer=true + connection_limit=2
 *   postgresql://postgres.xxxx:password@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=2
 *
 * DIRECT_URL (Vercel 환경변수 — prisma migrate 전용):
 *   Direct connection → port 5432
 *   postgresql://postgres.xxxx:password@aws-1-ap-northeast-2.pooler.supabase.com:5432/postgres
 */
function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL ?? "";
  if (!url) {
    console.error("[Prisma] DATABASE_URL이 설정되지 않았습니다. Vercel 환경변수를 확인하세요.");
    return url;
  }

  let result = url;

  // Vercel 서버리스: pgbouncer=true 필수 (Transaction pooler 사용 시)
  if (!result.includes("pgbouncer=")) {
    const sep = result.includes("?") ? "&" : "?";
    result = `${result}${sep}pgbouncer=true`;
  }

  // connection_limit: 서버리스 함수 1개당 최대 연결 수 제한
  if (!result.includes("connection_limit=")) {
    result = `${result}&connection_limit=2`;
  }

  return result;
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: { db: { url: getDatabaseUrl() } },
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

// 개발 환경: 핫 리로드 시 중복 PrismaClient 방지
if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
