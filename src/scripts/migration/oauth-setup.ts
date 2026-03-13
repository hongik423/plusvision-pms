/**
 * Google Drive OAuth2 일회성 Setup 스크립트
 *
 * 사용 방법:
 *   cd C:\Users\hongi\plusvision-pms
 *   npm run db:oauth
 *
 * 동작 방식:
 *   1. 로컬 HTTP 서버(4000번 포트)를 시작합니다.
 *   2. Google 인증 URL을 출력합니다. 브라우저에서 열어 승인합니다.
 *   3. 승인 후 localhost:4000으로 자동 리다이렉트 → 코드 자동 수신.
 *   4. refresh_token 발급 후 .env 파일에 자동 저장합니다.
 *
 * 사전 준비 (1회만):
 *   Google Cloud Console > API 및 서비스 > 사용자 인증 정보
 *   > OAuth 2.0 클라이언트 ID (웹 애플리케이션) > 승인된 리디렉션 URI에
 *   http://localhost:4000/callback  추가
 */

import * as path from "path";
import * as fs from "fs";
import * as http from "http";
import * as url from "url";

// ── .env 수동 로딩 ──
function loadEnv(filePath: string) {
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, "utf-8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
    if (key && !process.env[key]) process.env[key] = val;
  }
}
loadEnv(path.resolve(__dirname, "../../.env"));
loadEnv(path.resolve(__dirname, "../../.env.local"));

// Drive 전용 클라이언트 우선, 없으면 공통 클라이언트 사용
const CLIENT_ID     = process.env.GOOGLE_DRIVE_CLIENT_ID     || process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_DRIVE_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET;
const PORT          = 4000;
const REDIRECT_URI  = `http://localhost:${PORT}/callback`;

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error("❌ GOOGLE_CLIENT_ID 또는 GOOGLE_CLIENT_SECRET이 .env에 없습니다.");
  process.exit(1);
}

const SCOPES = [
  "https://www.googleapis.com/auth/drive.readonly",
].join(" ");

const authUrl =
  `https://accounts.google.com/o/oauth2/v2/auth` +
  `?client_id=${encodeURIComponent(CLIENT_ID)}` +
  `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
  `&response_type=code` +
  `&scope=${encodeURIComponent(SCOPES)}` +
  `&access_type=offline` +
  `&prompt=consent`;

// ── .env에 토큰 저장 ──
function saveTokenToEnv(token: string) {
  const envPath = path.resolve(__dirname, "../../.env");
  if (!fs.existsSync(envPath)) {
    console.log(`\n📋 .env 파일이 없습니다. 아래 값을 수동으로 추가하세요:\n`);
    console.log(`GOOGLE_DRIVE_REFRESH_TOKEN=${token}`);
    return;
  }
  let content = fs.readFileSync(envPath, "utf-8");
  const newLine = `GOOGLE_DRIVE_REFRESH_TOKEN=${token}`;
  if (/# ?GOOGLE_DRIVE_REFRESH_TOKEN=/.test(content)) {
    content = content.replace(/# ?GOOGLE_DRIVE_REFRESH_TOKEN=.*/, newLine);
  } else if (/GOOGLE_DRIVE_REFRESH_TOKEN=/.test(content)) {
    content = content.replace(/GOOGLE_DRIVE_REFRESH_TOKEN=.*/, newLine);
  } else {
    content += `\n${newLine}\n`;
  }
  fs.writeFileSync(envPath, content, "utf-8");
  console.log("\n✅ .env 파일에 GOOGLE_DRIVE_REFRESH_TOKEN 자동 저장 완료!");
  console.log("   → npm run dev 로 서버를 재시작하면 Drive 연동이 활성화됩니다.");
  console.log(`\n⚠️  토큰 값을 별도 안전한 곳에 보관하세요:`);
  console.log(`   ${token}`);
}

// ── 로컬 서버 시작 ──
const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url ?? "", true);

  if (parsed.pathname !== "/callback") {
    res.writeHead(404);
    res.end("Not found");
    return;
  }

  const code  = parsed.query["code"]  as string | undefined;
  const error = parsed.query["error"] as string | undefined;

  if (error || !code) {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(`<h2>❌ 인증 실패: ${error ?? "code 없음"}</h2><p>터미널을 확인하세요.</p>`);
    console.error(`\n❌ Google 인증 실패: ${error}`);
    server.close();
    process.exit(1);
  }

  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(`
    <html><body style="font-family:sans-serif;padding:40px">
      <h2>✅ 인증 코드 수신 완료</h2>
      <p>터미널로 돌아가서 결과를 확인하세요.</p>
      <p style="color:#666">이 탭은 닫아도 됩니다.</p>
    </body></html>
  `);

  server.close();

  // ── 토큰 교환 ──
  console.log("\n🔄 인증 코드로 refresh_token 교환 중...");
  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id:     CLIENT_ID!,
        client_secret: CLIENT_SECRET!,
        redirect_uri:  REDIRECT_URI,
        grant_type:    "authorization_code",
      }),
    });

    const data = await tokenRes.json() as {
      access_token?:  string;
      refresh_token?: string;
      error?:         string;
      error_description?: string;
    };

    if (!tokenRes.ok || data.error) {
      console.error(`❌ 토큰 발급 실패: ${data.error} — ${data.error_description}`);
      process.exit(1);
    }

    if (!data.refresh_token) {
      console.warn("\n⚠️  refresh_token이 없습니다.");
      console.warn("   이미 승인한 앱이면: https://myaccount.google.com/permissions 에서");
      console.warn("   'PlusPMS' 앱 권한을 취소 후 npm run db:oauth 를 다시 실행하세요.");
      process.exit(1);
    }

    saveTokenToEnv(data.refresh_token);
    process.exit(0);

  } catch (err: any) {
    console.error("❌ 네트워크 오류:", err.message);
    process.exit(1);
  }
});

server.listen(PORT, () => {
  console.log("=".repeat(60));
  console.log("  Google Drive OAuth2 Setup — PlusPMS");
  console.log("=".repeat(60));
  console.log(`\n⚠️  사전 준비 (아직 안 했다면):`);
  console.log(`   Google Cloud Console > API 및 서비스 > 사용자 인증 정보`);
  console.log(`   > OAuth 2.0 클라이언트 ID > 승인된 리디렉션 URI 에`);
  console.log(`   http://localhost:${PORT}/callback  추가`);
  console.log(`\n[1단계] 아래 URL을 Chrome에서 열고 bongshm 계정으로 로그인:`);
  console.log(`\n${authUrl}\n`);
  console.log(`[2단계] 권한 승인 후 자동으로 토큰이 발급됩니다.`);
  console.log(`        (로컬 서버 대기 중... Ctrl+C 로 취소)\n`);
});

server.on("error", (err: any) => {
  if (err.code === "EADDRINUSE") {
    console.error(`❌ 포트 ${PORT}이 이미 사용 중입니다.`);
    console.error(`   다른 프로그램을 종료하거나 잠시 후 다시 실행하세요.`);
  } else {
    console.error("❌ 서버 오류:", err.message);
  }
  process.exit(1);
});
