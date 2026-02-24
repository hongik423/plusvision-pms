import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const { pathname } = req.nextUrl;

    // /admin/** 경로는 ADMIN 역할만 접근 허용
    if (pathname.startsWith("/admin") && token?.role !== "ADMIN") {
      return NextResponse.redirect(new URL("/dashboard?error=forbidden", req.url));
    }

    return NextResponse.next();
  },
  {
    secret: process.env.NEXTAUTH_SECRET ?? "pluspms-dev-secret-only",
    pages: {
      signIn: "/login",
    },
    callbacks: {
      // 로그인 여부만 확인 (역할 체크는 middleware 함수에서 수행)
      authorized: ({ token }) => !!token,
    },
  },
);

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/projects/:path*",
    "/admin/:path*",
    "/notifications/:path*",
    "/search/:path*",
    "/settings/:path*",
  ],
};
