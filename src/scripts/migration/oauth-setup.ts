/**
 * Google Drive OAuth2 일회성 Setup 스크립트
 *
 * 사용 방법:
 *   npx tsx scripts/migration/oauth-setup.ts
 *
 * 단계:
 *   1. 스크립트가 인증 URL을 출력합니다.
 *   2. 브라우저에서 해당 URL을 열고 Google 계정으로 로그인하여 권한을 승인합니다.
 *   3. 리다이렉트된 URL의 `code=` 파라미터 값을 복사합니다.
 *   4. 터미널에 붙여넣기하면 refresh_token이 발급됩니다.
 *   5. .env.local에 GOOGLE_DRIVE_REFRESH_TOKEN 값을 추가합니다.
 *
 * 필수 환경 변수 (이미 .env.local에 있음):
 *   GOOGLE_CLIENT_ID
 *   GOOGLE_CLIENT_SECRET
 */

import * as readline from "readline";

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = "urn:ietf:wg:oauth:2.0:oob"; // 브라우저 없는 환경용

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error("❌ GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET 환경 변수가 필요합니다.");
  console.error("   .env.local 파일을 확인해 주세요.");
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

console.log("=".repeat(60));
console.log("Google Drive OAuth2 Setup");
console.log("=".repeat(60));
console.log("\n[1단계] 아래 URL을 브라우저에서 열어 Google 계정으로 로그인하세요:\n");
console.log(authUrl);
console.log("\n[2단계] 승인 후 표시된 '인증 코드'를 아래에 붙여넣으세요:\n");

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

rl.question("인증 코드 입력: ", async (code) => {
  rl.close();
  const trimmedCode = code.trim();
  if (!trimmedCode) {
    console.error("❌ 인증 코드가 입력되지 않았습니다.");
    process.exit(1);
  }

  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code: trimmedCode,
        client_id: CLIENT_ID!,
        client_secret: CLIENT_SECRET!,
        redirect_uri: REDIRECT_URI,
        grant_type: "authorization_code",
      }),
    });

    const tokenData = await tokenRes.json() as {
      access_token?: string;
      refresh_token?: string;
      error?: string;
      error_description?: string;
    };

    if (!tokenRes.ok || tokenData.error) {
      console.error("❌ 토큰 발급 실패:", tokenData.error, tokenData.error_description);
      process.exit(1);
    }

    console.log("\n" + "=".repeat(60));
    console.log("✅ OAuth2 토큰 발급 성공!");
    console.log("=".repeat(60));
    console.log("\n.env.local 파일에 아래 값을 추가하세요:\n");
    console.log(`GOOGLE_DRIVE_REFRESH_TOKEN=${tokenData.refresh_token}`);
    console.log("\n⚠️  refresh_token은 재발급이 어려우니 안전한 곳에 보관하세요.");

    if (!tokenData.refresh_token) {
      console.warn("\n⚠️  refresh_token이 없습니다. Google Console에서 앱의 '신뢰할 수 있는 앱' 설정 또는 prompt=consent를 확인하세요.");
    }
  } catch (err) {
    console.error("❌ 네트워크 오류:", err);
    process.exit(1);
  }
});
