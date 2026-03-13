import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import type { Session } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getProjectById } from "@/services/project-service";
import { prisma } from "@/lib/prisma";
import { PROJECT_STATUS_COLORS, PROJECT_STATUS_LABELS, STAGE_STATUS_COLORS } from "@/lib/constants";
import { ProjectDetailClient } from "./project-detail-client";
import type { Route } from "next";
import Link from "next/link";

export default async function ProjectDetailPage({ params }: { params: { id: string } }) {
  let project: Awaited<ReturnType<typeof getProjectById>> = null;
  let session: Session | null = null;
  let users: { id: string; name: string }[] = [];

  try {
    [project, session, users] = await Promise.all([
      getProjectById(params.id),
      getServerSession(authOptions),
      prisma.user.findMany({
        where: { isActive: true },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
    ]);
  } catch {
    return (
      <section className="rounded-xl border bg-white p-8 text-center">
        <p className="text-4xl mb-4">⚠️</p>
        <h2 className="text-xl font-bold text-slate-800">데이터를 불러올 수 없습니다</h2>
        <p className="mt-3 text-sm text-slate-500">
          데이터베이스 연결이 일시적으로 불안정합니다. 잠시 후 다시 시도해 주세요.
        </p>
      </section>
    );
  }

  if (!project) notFound();

  const role = (session?.user?.role ?? "VIEWER") as "ADMIN" | "MANAGER" | "USER" | "VIEWER";
  const userId = session?.user?.id ?? "";
  const canManage = role === "ADMIN" || role === "MANAGER";

  const completedStages = project.stages.filter((s) => s.status === "COMPLETED").length;
  const progressPct = Math.round((completedStages / 10) * 100);

  const stagesForClient = project.stages.map((s) => ({
    id: s.id,
    stageNumber: s.stageNumber,
    stageName: s.stageName,
    status: s.status as "INACTIVE" | "ACTIVE" | "COMPLETED" | "SKIPPED",
    assigneeId: s.assigneeId,
    assignee: s.assignee ? { id: s.assignee.id, name: s.assignee.name } : null,
    startDate: s.startDate?.toISOString() ?? null,
    completedDate: s.completedDate?.toISOString() ?? null,
    notes: s.notes ?? null,
  }));

  return (
    <section className="space-y-5">
      {/* 프로젝트 헤더 카드 */}
      <div className="rounded-xl border bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${PROJECT_STATUS_COLORS[project.status]}`}>
                {PROJECT_STATUS_LABELS[project.status]}
              </span>
              <span className="text-xs font-mono text-slate-400">{project.projectNumber}</span>
            </div>
            <h1 className="text-2xl font-bold">{project.name}</h1>
            {project.description && (
              <p className="mt-1 text-sm text-slate-500">{project.description}</p>
            )}
          </div>
          {canManage && (
            <Link
              href={`/projects/${project.id}/history` as Route}
              className="rounded border px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-50"
            >
              변경 이력
            </Link>
          )}
        </div>

        {/* 분류 태그 */}
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <span className="rounded bg-slate-100 px-2 py-1">📍 {project.site.name}</span>
          <span className="rounded bg-slate-100 px-2 py-1">🏢 {project.customer.name}</span>
          <span className="rounded bg-blue-100 text-blue-700 px-2 py-1">⚙️ {project.processType.name}</span>
          <span className="rounded bg-indigo-100 text-indigo-700 px-2 py-1">🔧 {project.itemType.name}</span>
        </div>

        {/* 진행률 바 */}
        <div className="mt-4">
          <div className="flex justify-between text-xs text-slate-500 mb-1">
            <span>진행률</span>
            <span>{completedStages}/10단계 완료 ({progressPct}%)</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-blue-500 transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* 서브 네비게이션 */}
      <div className="flex flex-wrap gap-2">
        {[
          { href: `/projects/${project.id}/documents`, label: "📄 문서 관리" },
          { href: `/projects/${project.id}/estimate`, label: "💰 견적 관리" },
          { href: `/projects/${project.id}/manuals`, label: "📖 매뉴얼" },
          { href: `/projects/${project.id}/history`, label: "📜 변경 이력" },
        ].map((nav) => (
          <Link
            key={nav.href}
            href={nav.href as Route}
            className="rounded-lg border bg-white px-3 py-2 text-sm font-medium hover:bg-slate-50 hover:border-blue-300 transition-colors"
          >
            {nav.label}
          </Link>
        ))}
      </div>

      {/* 단계 관리 (클라이언트 컴포넌트) */}
      <ProjectDetailClient
        projectId={project.id}
        stages={stagesForClient}
        canManage={canManage}
        userId={userId}
        users={users}
      />
    </section>
  );
}
