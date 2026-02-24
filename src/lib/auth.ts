import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { compare } from "bcryptjs";
import { prisma } from "@/lib/prisma";

type DevFallbackUser = {
  id: string;
  email: string;
  name: string;
  role: "ADMIN" | "MANAGER" | "USER" | "VIEWER";
  password: string;
};

const devFallbackUsers: Record<string, DevFallbackUser> = {
  "admin@plusvision.co.kr": {
    id: "dev-admin",
    email: "admin@plusvision.co.kr",
    name: "개발 관리자",
    role: "ADMIN",
    password: "admin",
  },
  "manager@plusvision.co.kr": {
    id: "dev-manager",
    email: "manager@plusvision.co.kr",
    name: "개발 매니저",
    role: "MANAGER",
    password: "manager",
  },
  "test@plusvision.co.kr": {
    id: "dev-user",
    email: "test@plusvision.co.kr",
    name: "개발 사용자",
    role: "USER",
    password: "test",
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
    /db\.\[.+\]\.supabase\.co/i,
  ];

  return placeholderPatterns.some((pattern) => pattern.test(databaseUrl));
}

function getDevFallbackAccount(email: string, password: string) {
  const demoLoginEnabled = process.env.DEMO_LOGIN_ENABLED !== "false";
  if (!demoLoginEnabled) {
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
  secret: process.env.NEXTAUTH_SECRET ?? "pluspms-dev-secret-only",
  session: {
    strategy: "jwt",
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
        const loginIdAliasMap: Record<string, string> = {
          admin: "admin@plusvision.co.kr",
          manager: "manager@plusvision.co.kr",
          test: "test@plusvision.co.kr",
        };
        const emailForLookup = loginIdAliasMap[normalizedLoginId] ?? normalizedLoginId;
        const fallbackAccount = getDevFallbackAccount(emailForLookup, credentials.password);
        if (hasInvalidDatabaseUrl()) {
          return fallbackAccount;
        }

        try {
          const user = await prisma.user.findUnique({
            where: { email: emailForLookup },
          });
          if (!user?.password || !user.isActive) {
            return fallbackAccount;
          }

          const valid = await compare(credentials.password, user.password);
          if (!valid) {
            return null;
          }

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
          };
        } catch {
          return fallbackAccount;
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
  },
  pages: {
    signIn: "/login",
  },
};
