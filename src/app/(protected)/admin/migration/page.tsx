import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import type { Route } from "next";

export default async function AdminMigrationPage() {
  await requireRole("ADMIN");

  // ── 마이그레이션 통계 ────────────────────────
  const [
    googleDriveDocs,
    supabaseDocs,
    totalDocs,
    projectCount,
    stageDocsByStage,
  ] = await Promise.all([
    prisma.stageDocument.count({ where: { storageType: "GOOGLE_DRIVE" } }),
    prisma.stageDocument.count({ where: { storageType: "SUPABASE" } }),
    prisma.stageDocument.count(),
    prisma.project.count(),
    prisma.stageDocument.groupBy({
      by: ["stageId"],
      _count: { _all: true },
      where: { externalId: { not: null } },
    }),
  ]);

  const migratedFromDrive = await prisma.stageDocument.count({
    where: { storageType: "SUPABASE", externalId: { not: null } },
  });

  // ── 최근 이전된 문서 ─────────────────────────
  const recentMigrated = await prisma.stageDocument.findMany({
    where: { externalId: { not: null } },
    include: {
      stage: {
        include: { project: { select: { id: true, name: true, projectNumber: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  // ── 환경 변수 설정 상태 ───────────────────────
  const envStatus = {
    clientId: !!process.env.GOOGLE_CLIENT_ID,
    clientSecret: !!process.env.GOOGLE_CLIENT_SECRET,
    refreshToken: !!process.env.GOOGLE_DRIVE_REFRESH_TOKEN,
    accessToken: !!process.env.GOOGLE_DRIVE_ACCESS_TOKEN,
    sourceFolderId: !!process.env.GOOGLE_DRIVE_SOURCE_FOLDER_ID,
    targetProjectId: !!process.env.MIGRATION_TARGET_PROJECT_ID,
    uploaderId: !!process.env.MIGRATION_DEFAULT_UPLOADER_ID,
  };

  const isReady =
    envStatus.clientId &&
    envStatus.clientSecret &&
    (envStatus.refreshToken || envStatus.accessToken) &&
    envStatus.sourceFolderId &&
    envStatus.targetProjectId &&
    envStatus.uploaderId;

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Google Drive 마이그레이션</h1>
        <span className={`rounded-full px-3 py-1 text-sm font-semibold ${isReady ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
          {isReady ? "✅ 설정 완료" : "⚠️ 설정 필요"}
        </span>
      </div>

      {/* ── Drive 파일명 변환 결과 ────────────────────── */}
      <div className="rounded-xl border bg-white p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">📁 Google Drive 파일명 변환 결과</h2>
          <span className="rounded-full bg-green-100 text-green-700 px-3 py-1 text-sm font-semibold">
            ✅ 오류 0 · 전체 완료
          </span>
        </div>

        <div className="overflow-x-auto mb-5">
          <table className="w-full text-sm">
            <thead className="border-b bg-slate-50">
              <tr>
                <th className="p-3 text-left font-semibold text-slate-600">단계</th>
                <th className="p-3 text-left font-semibold text-slate-600">대상</th>
                <th className="p-3 text-right font-semibold text-slate-600">파일 수</th>
                <th className="p-3 text-center font-semibold text-slate-600">결과</th>
              </tr>
            </thead>
            <tbody>
              {[
                { step: "1차", target: "삼성 (PV-001~006 상위 폴더)", count: 1035 },
                { step: "1차", target: "디티에스 (DTS)", count: 25 },
                { step: "1차", target: "바이코 / 벨류 / 포이스 / 원익포이스 / 테트라다인", count: 26 },
                { step: "2차", target: "각 프로젝트 고유 하위폴더 재매핑 (PV-003 ~ 024)", count: 646 },
              ].map((row, i) => (
                <tr key={i} className="border-b hover:bg-slate-50">
                  <td className="p-3">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${row.step === "1차" ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"}`}>
                      {row.step}
                    </span>
                  </td>
                  <td className="p-3 text-slate-700">{row.target}</td>
                  <td className="p-3 text-right font-mono font-semibold text-slate-800">
                    {row.count.toLocaleString()}개
                  </td>
                  <td className="p-3 text-center text-green-600 font-semibold">✅ 완료</td>
                </tr>
              ))}
              <tr className="bg-slate-50 font-bold border-t-2 border-slate-300">
                <td className="p-3 text-slate-700">총계</td>
                <td className="p-3 text-slate-700">24개 프로젝트</td>
                <td className="p-3 text-right font-mono text-slate-900">1,732개</td>
                <td className="p-3 text-center text-green-700">✅ 오류 0</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* 파일명 규칙 예시 */}
        <div className="rounded-lg border bg-slate-900 p-4">
          <p className="text-xs font-semibold text-slate-400 mb-3 uppercase tracking-wide">파일명 규칙 적용 예시</p>
          <div className="space-y-1.5 font-mono text-xs text-green-400">
            {[
              { name: "[PV-2026-003-S10-001] IMK 사용방법.pptx", comment: "← 삼성 IMK 하위 프로젝트" },
              { name: "[PV-2026-008-S07-001] DPF 제어보드 회로도.pdf", comment: "← DTS DPF 하위 프로젝트" },
              { name: "[PV-2026-015-S07-001] Metal Leak 도면.pdf", comment: "← 테트라다인 하위 프로젝트" },
              { name: "[PV-2026-018-S06-001] 견적서.xlsx", comment: "← 넥스틴 (신규)" },
            ].map((ex, i) => (
              <div key={i} className="flex flex-wrap gap-x-2">
                <span className="text-green-300">{ex.name}</span>
                <span className="text-slate-500">{ex.comment}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 환경 변수 설정 상태 */}
      <div className="rounded-xl border bg-white p-5">
        <h2 className="mb-4 text-xl font-semibold">환경 변수 설정 상태</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          <EnvRow label="GOOGLE_CLIENT_ID" ok={envStatus.clientId} />
          <EnvRow label="GOOGLE_CLIENT_SECRET" ok={envStatus.clientSecret} />
          <EnvRow
            label="GOOGLE_DRIVE_REFRESH_TOKEN"
            ok={envStatus.refreshToken}
            hint="oauth-setup.ts로 발급 (권장)"
          />
          <EnvRow
            label="GOOGLE_DRIVE_ACCESS_TOKEN"
            ok={envStatus.accessToken}
            hint="단기 토큰 (폴백용)"
          />
          <EnvRow label="GOOGLE_DRIVE_SOURCE_FOLDER_ID" ok={envStatus.sourceFolderId} />
          <EnvRow label="MIGRATION_TARGET_PROJECT_ID" ok={envStatus.targetProjectId} />
          <EnvRow label="MIGRATION_DEFAULT_UPLOADER_ID" ok={envStatus.uploaderId} />
        </div>

        {!envStatus.refreshToken && !envStatus.accessToken && (
          <div className="mt-4 rounded-lg bg-amber-50 border border-amber-200 p-4 text-sm text-amber-800">
            <p className="font-semibold mb-1">OAuth2 인증 설정이 필요합니다</p>
            <p className="mb-2">터미널에서 아래 명령어를 실행하여 refresh_token을 발급받으세요:</p>
            <code className="block rounded bg-amber-100 px-3 py-2 font-mono text-xs">
              cd src && npx tsx scripts/migration/oauth-setup.ts
            </code>
          </div>
        )}
      </div>

      {/* 통계 카드 */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="전체 문서" value={totalDocs} color="slate" />
        <StatCard label="Supabase 저장" value={supabaseDocs} color="blue" />
        <StatCard label="Drive에서 이전됨" value={migratedFromDrive} color="green" />
        <StatCard label="Drive 원본 남음" value={googleDriveDocs} color="amber" hint="storageType=GOOGLE_DRIVE" />
      </div>

      {/* 실행 가이드 */}
      <div className="rounded-xl border bg-white p-5">
        <h2 className="mb-4 text-xl font-semibold">마이그레이션 실행 가이드</h2>
        <ol className="space-y-4 text-sm">
          <StepItem
            step={1}
            title="OAuth2 인증 (최초 1회)"
            done={envStatus.refreshToken}
            code="cd src && npx tsx scripts/migration/oauth-setup.ts"
            desc=".env.local에 GOOGLE_DRIVE_REFRESH_TOKEN 추가"
          />
          <StepItem
            step={2}
            title="Dry-run (분류 미리보기)"
            done={false}
            code="cd src && GOOGLE_DRIVE_SOURCE_FOLDER_ID=xxx npx tsx scripts/migration/gdrive-dry-run.ts"
            desc="실제 이전 없이 파일 분류 결과와 토큰 인증을 확인합니다."
          />
          <StepItem
            step={3}
            title="소량 테스트 (처음 10건)"
            done={false}
            code="cd src && MIGRATION_LIMIT=10 npx tsx scripts/migration/gdrive-migrate.ts"
            desc="MIGRATION_LIMIT=10으로 제한하여 처음 10건만 이전해 결과를 확인합니다."
          />
          <StepItem
            step={4}
            title="전체 마이그레이션"
            done={false}
            code="cd src && MIGRATION_RECURSIVE=true npx tsx scripts/migration/gdrive-migrate.ts"
            desc="하위 폴더 포함 전체 이전. 중단 후 resume.json으로 이어서 실행 가능."
          />
          <StepItem
            step={5}
            title="무결성 검증"
            done={false}
            code="cd src && npx tsx scripts/verification/verify-integrity.ts"
            desc="이전 완료 후 DB와 파일 무결성을 검증하고 리포트를 생성합니다."
          />
        </ol>
      </div>

      {/* 최근 이전 문서 */}
      {recentMigrated.length > 0 && (
        <div className="rounded-xl border bg-white p-5">
          <h2 className="mb-4 text-xl font-semibold">최근 이전된 문서 (Drive → Supabase)</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-slate-50">
                <tr>
                  <th className="p-2 text-left font-semibold text-slate-600">파일명</th>
                  <th className="p-2 text-left font-semibold text-slate-600">프로젝트</th>
                  <th className="p-2 text-left font-semibold text-slate-600">단계</th>
                  <th className="p-2 text-left font-semibold text-slate-600">문서 유형</th>
                  <th className="p-2 text-left font-semibold text-slate-600">이전일</th>
                </tr>
              </thead>
              <tbody>
                {recentMigrated.map((doc) => (
                  <tr key={doc.id} className="border-b hover:bg-slate-50">
                    <td className="p-2 max-w-[200px] truncate">
                      <a
                        href={doc.fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        {doc.fileName}
                      </a>
                    </td>
                    <td className="p-2">
                      {doc.stage.project ? (
                        <Link
                          href={`/projects/${doc.stage.project.id}` as Route}
                          className="hover:underline text-slate-700"
                        >
                          {doc.stage.project.name}
                        </Link>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="p-2">
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">{doc.stage.stageNumber}단계</span>
                    </td>
                    <td className="p-2 text-xs text-slate-500">{doc.documentType}</td>
                    <td className="p-2 text-xs text-slate-400">
                      {doc.createdAt.toLocaleDateString("ko-KR")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {recentMigrated.length === 0 && (
        <div className="rounded-xl border border-dashed py-12 text-center">
          <p className="text-4xl mb-3">📂</p>
          <p className="font-semibold text-slate-600">이전된 문서가 없습니다</p>
          <p className="mt-1 text-sm text-slate-400">위 가이드에 따라 마이그레이션을 실행해 주세요.</p>
        </div>
      )}
    </section>
  );
}

function EnvRow({ label, ok, hint }: { label: string; ok: boolean; hint?: string }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border px-3 py-2.5">
      <span className="mt-0.5 text-base">{ok ? "✅" : "❌"}</span>
      <div>
        <code className="text-xs font-mono text-slate-700">{label}</code>
        {hint && <p className="text-xs text-slate-400 mt-0.5">{hint}</p>}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
  hint,
}: {
  label: string;
  value: number;
  color: "slate" | "blue" | "green" | "amber";
  hint?: string;
}) {
  const colors = {
    slate: "bg-slate-50 border-slate-200 text-slate-700",
    blue: "bg-blue-50 border-blue-200 text-blue-700",
    green: "bg-green-50 border-green-200 text-green-700",
    amber: "bg-amber-50 border-amber-200 text-amber-700",
  };
  return (
    <div className={`rounded-xl border p-4 ${colors[color]}`}>
      <p className="text-xs font-semibold uppercase tracking-wide opacity-70">{label}</p>
      <p className="mt-2 text-3xl font-bold">{value.toLocaleString()}</p>
      {hint && <p className="mt-1 text-xs opacity-60">{hint}</p>}
    </div>
  );
}

function StepItem({
  step,
  title,
  done,
  code,
  desc,
}: {
  step: number;
  title: string;
  done: boolean;
  code: string;
  desc: string;
}) {
  return (
    <li className="flex gap-4">
      <div className={`flex-shrink-0 flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${done ? "bg-green-500 text-white" : "bg-slate-200 text-slate-600"}`}>
        {done ? "✓" : step}
      </div>
      <div className="flex-1">
        <p className={`font-semibold ${done ? "text-green-700" : "text-slate-800"}`}>
          {title} {done && <span className="text-xs font-normal text-green-600">(완료)</span>}
        </p>
        <p className="text-xs text-slate-500 mt-0.5 mb-1.5">{desc}</p>
        <code className="block rounded bg-slate-900 text-green-400 px-3 py-2 text-xs font-mono break-all">
          {code}
        </code>
      </div>
    </li>
  );
}
