import { NextResponse, type NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  // 세션 쿠키 존재 여부 확인 (HTTPS: __Secure- 접두사, HTTP: 일반)
  const sessionToken =
    req.cookies.get("__Secure-next-auth.session-token")?.value ??
    req.cookies.get("next-auth.session-token")?.value;

  if (!sessionToken) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", req.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 실제 JWT 검증 및 역할 확인은 (protected)/layout.tsx의
  // getServerSession(authOptions) 에서 서버사이드로 처리됨
  return NextResponse.next();
}

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
