import { NextResponse } from "next/server";

export async function GET() {
  const dbUrl = process.env.DATABASE_URL ?? "";
  const placeholderPatterns = [
    /\[YOUR-[^\]]+\]/i,
    /\[DEV-[^\]]+\]/i,
    /\[PROD-[^\]]+\]/i,
    /\[GENERATE-WITH:[^\]]+\]/i,
    /db\.\[.+\]\.supabase\.co/i,
  ];
  const dbInvalid = !dbUrl || placeholderPatterns.some((p) => p.test(dbUrl));
  const demoEnabled = process.env.DEMO_LOGIN_ENABLED !== "false";

  let dbConnectable = false;
  let dbError = "";
  if (!dbInvalid) {
    try {
      const { prisma } = await import("@/lib/prisma");
      const count = await prisma.user.count();
      dbConnectable = true;
      dbError = `user count: ${count}`;
    } catch (e) {
      dbError = e instanceof Error ? e.message.slice(0, 200) : String(e);
    }
  }

  return NextResponse.json({
    dbUrlPrefix: dbUrl.slice(0, 30) + "...",
    dbInvalid,
    demoEnabled,
    dbConnectable,
    dbError,
    nextauthSecret: process.env.NEXTAUTH_SECRET ? "set" : "not set (using fallback)",
    nextauthUrl: process.env.NEXTAUTH_URL ?? "not set",
    nodeEnv: process.env.NODE_ENV,
  });
}
