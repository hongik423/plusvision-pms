/**
 * 개인 Drive 폴더 자동 연결 스크립트
 *
 * 실행: npm run drive:link-personal
 *  (또는) cd src && npx tsx scripts/migration/link-personal-drive-folders.ts
 *
 * 동작:
 *   1. Supabase DB의 모든 활성 사용자 조회
 *   2. 이름 기준으로 KNOWN_PERSONAL_FOLDERS 매핑 조회
 *   3. driveFolderId가 없는 사용자에 Drive 폴더 자동 연결
 *   4. 결과 출력
 */

import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

// .env 수동 로드 (dotenv 없이)
const envPath = path.join(__dirname, "../../.env");
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, "utf8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = val;
  }
}

// 개인별 폴더 ID 매핑 (drive-config.ts 와 동기화)
const KNOWN_PERSONAL_FOLDERS: Record<string, string> = {
  김남용: "1NyFdEfenaIzmVKKNDUa8e88Wqmp2QMJF",
  노희길: "12I1k7S_K_6S2jGmZqdaGX2AoA9gJJbVe",
  송상현: "1SiiheAx4YeTjw2OY8AKj4lEJYOZbVXzo",
  정희창: "1A1esjJbYa5NevMj93Bp7_WacqZknDTEf",
  조현섭: "1l5HbYWs4TjNAw63GkAgZl0GKOEJwoAT4",
  최봉:   "1-2HWn0BFCS4VpX0gHJFP73kBwjvnY-ci",
  최혜인: "1XcbqhSCLAgitkMXxfV0OiswuNN21HjdQ",
};

async function main() {
  const prisma = new PrismaClient();

  console.log("=== 개인 Drive 폴더 자동 연결 시작 ===\n");

  try {
    // 1. DB 스키마에 컬럼이 있는지 확인 (없으면 먼저 마이그레이션 필요)
    try {
      await prisma.$queryRaw`SELECT "driveFolderId" FROM users LIMIT 1`;
    } catch {
      console.error("❌ users 테이블에 driveFolderId 컬럼이 없습니다.");
      console.error("   먼저 마이그레이션을 실행하세요:");
      console.error("   npm run db:migrate");
      process.exit(1);
    }

    // 2. 모든 활성 사용자 조회
    const users = await prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, name: true, driveFolderId: true },
      orderBy: { name: "asc" },
    });

    console.log(`총 활성 사용자: ${users.length}명\n`);

    let linked = 0;
    let skipped = 0;
    const notFound: string[] = [];

    for (const user of users) {
      if ((user as any).driveFolderId) {
        console.log(`⏭️  ${user.name} — 이미 연결됨`);
        skipped++;
        continue;
      }

      const folderId = KNOWN_PERSONAL_FOLDERS[user.name];
      if (folderId) {
        await (prisma.user as any).update({
          where: { id: user.id },
          data: {
            driveFolderId: folderId,
            driveFolderName: user.name,
          },
        });
        console.log(`✅ ${user.name} → Drive 폴더 연결 완료 (${folderId})`);
        linked++;
      } else {
        console.log(`⚠️  ${user.name} — Drive 폴더 매핑 없음`);
        notFound.push(user.name);
      }
    }

    console.log(`\n=== 결과 ===`);
    console.log(`✅ 연결 완료: ${linked}명`);
    console.log(`⏭️  건너뜀:  ${skipped}명`);
    if (notFound.length > 0) {
      console.log(`⚠️  매핑 없음: ${notFound.join(", ")}`);
      console.log(`   → 관리자 페이지에서 수동 연결 필요`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
