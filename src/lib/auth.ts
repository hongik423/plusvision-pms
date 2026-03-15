import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { compare } from "bcryptjs";
import { prisma } from "@/lib/prisma";

// ─── 환경 판별 ───────────────────────────────────────────
const IS_PRODUCTION = process.env.NODE_ENV === "production";

// ─── 개발 전용 Fallback 계정 (프로덕션에서는 절대 사용 불가) ─────
type DevFallbackUser = {
  id: string;
  email: string;
  name: string;
  role: "ADMIN" | "MANAGER" | "USER" | "VIEWER";
  password: string;
};

// 브라우저 비밀번호 유출 경고 회피: 프로젝트 전용 비밀번호 사용 (admin/manager/test는 breach DB에 등재됨)
const devFallbackUsers: Record<string, DevFallbackUser> = {
  "admin@plusvision.co.kr": {
    id: "dev-admin",
    email: "admin@plusvision.co.kr",
    name: "개발 관리자",
    role: "ADMIN",
    password: "PlusPms1!Adm",
  },
  "manager@plusvision.co.kr": {
    id: "dev-manager",
    email: "manager@plusvision.co.kr",
    name: "개발 매니저",
    role: "MANAGER",
    password: "PlusPms1!Mgr",
  },
  "test@plusvision.co.kr": {
    id: "dev-user",
    email: "test@plusvision.co.kr",
    name: "개발 사용자",
    role: "USER",
    password: "PlusPms1!Tst",
  },
};

function hasInvalidDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL ?? "";
  if (!databaseUrl) {
    return true;
  }

  // 템플릿 placeholder 값만 차단하고, 실제 비밀번호 문자열은 허용한다.
  const placeholderPatterns = [
    /\[YOUR-[^\]]+\]/i,
    /\[DEV-[^\]]+\]/i,
    /\[PROD-[^\]]+\]/i,
    /\[GENERATE-WITH:[^\]]+\]/i,
    /\[PASSWORD\]/i,
    /\[PROJECT_REF\]/i,
    /\[ANON_KEY\]/i,
    /db\.\[.+\]\.supabase\.co/i,
  ];

  return placeholderPatterns.some((pattern) => pattern.test(databaseUrl));
}

/**
 * Fallback 계정을 반환합니다.
 * - 개발 환경: DEMO_LOGIN_ENABLED=true 시 허용
 * - 프로덕션 환경: DEMO_LOGIN_ENABLED=true 또는 Vercel 배포 시 허용 (데모 사이트용)
 */
function getDevFallbackAccount(email: string, password: string, forceWhenDbInvalid?: boolean) {
  const isVercel = process.env.VERCEL === "1";
  const demoLoginEnabled =
    forceWhenDbInvalid ||
    process.env.DEMO_LOGIN_ENABLED === "true" ||
    (IS_PRODUCTION && isVercel);

  // 프로덕션에서는 demoLoginEnabled 또는 Vercel 배포여야 함
  if (IS_PRODUCTION && !demoLoginEnabled) {
    return null;
  }
  // 개발 환경에서는 DEMO_LOGIN_ENABLED가 설정되어야 함
  if (!IS_PRODUCTION && !demoLoginEnabled) {
    return null;
  }

  const account = devFallbackUsers[email];
  if (!account || account.password !== password) {
    return null;
  }

  return {
    id: account.id,
    email: account.email,
    name: account.name,
    role: account.role,
  };
}

export const authOptions: NextAuthOptions = {
  secret: (() => {
    const secret = process.env.NEXTAUTH_SECRET;
    if (IS_PRODUCTION && !secret) {
      console.error("[Auth] 경고: 프로덕션 환경에서 NEXTAUTH_SECRET이 설정되지 않았습니다. Vercel 환경 변수를 확인해 주세요.");
    }
    return secret ?? "pluspms-dev-secret-only";
  })(),
  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60, // 24시간
  },
  providers: [
    CredentialsProvider({
      name: "아이디 로그인",
      credentials: {
        loginId: { label: "아이디", type: "text" },
        password: { label: "비밀번호", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.loginId || !credentials.password) {
          return null;
        }

        const normalizedLoginId = credentials.loginId.trim().toLowerCase();
        const password = credentials.password.trim();
        if (!normalizedLoginId || !password) {
          return null;
        }
        const loginIdAliasMap: Record<string, string> = {
          admin: "admin@plusvision.co.kr",
          manager: "manager@plusvision.co.kr",
          test: "test@plusvision.co.kr",
        };
        const emailForLookup = loginIdAliasMap[normalizedLoginId] ?? normalizedLoginId;
        const invalidDb = hasInvalidDatabaseUrl();

        // DB URL 이 없는 경우 → DEMO_LOGIN_ENABLED 로 폴백 시도
        if (invalidDb) {
          console.error("[Auth] DATABASE_URL이 유효하지 않습니다. DEMO_LOGIN_ENABLED 폴백 시도...");
          return getDevFallbackAccount(emailForLookup, password, true);
        }

        try {
          const user = await prisma.user.findUnique({
            where: { email: emailForLookup },
          });
          if (!user?.password || !user.isActive) {
            // DB 에 사용자 없음 → DEMO_LOGIN_ENABLED 폴백 시도
            return getDevFallbackAccount(emailForLookup, password);
          }

          const valid = await compare(password, user.password);
          if (valid) {
            return {
              id: user.id,
              email: user.email,
              name: user.name,
              role: user.role,
            };
          }
          // 비밀번호 불일치 → 폴백 없이 실패
          return null;
        } catch (error) {
          console.error("[Auth] DB 연결 오류:", error);
          // DB 오류 시 DEMO_LOGIN_ENABLED 폴백 시도
          return getDevFallbackAccount(emailForLookup, password, true);
        }
      },
    }),
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          }),
        ]
      : []),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as { role?: string }).role ?? "USER";
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? "";
        session.user.role = (token.role as string) ?? "USER";
      }
      return session;
    },
    async redirect({ url, baseUrl }) {
      // 상대 경로면 baseUrl 기반으로 절대 URL 반환 (Vercel 리다이렉트 안정화)
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      try {
        if (new URL(url).origin === new URL(baseUrl).origin) return url;
      } catch {
        // 잘못된 URL이면 baseUrl로 폴백
      }
      return baseUrl;
    },
  },
  pages: {
    signIn: "/login",
  },
};
