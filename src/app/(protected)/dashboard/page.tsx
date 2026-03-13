import { fetchAllDashboardData } from "@/services/dashboard-service";
import { requireSession } from "@/lib/rbac";
import Link from "next/link";
import { StageDistributionChart } from "@/components/dashboard/stage-distribution-chart";
import { MonthlyPerformanceChart } from "@/components/dashboard/monthly-performance-chart";
import { AssigneeWorkloadChart } from "@/components/dashboard/assignee-workload-chart";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Record<string, string>;
}) {
  const session = await requireSession();
  const userId = session?.user?.id ?? "";
  const forbiddenError = searchParams?.error === "forbidden";

  let dataError = "";
  let stats = {
    totalProjects: 0,
    activeProjects: 0,
    completedProjects: 0,
    holdProjects: 0,
    myTasks: 0,
  };
  let tasks: Awaited<ReturnType<typeof fetchAllDashboardData>>["tasks"] = [];
  let distributions: Awaited<ReturnType<typeof fetchAllDashboardData>>["distributions"] = [];
  let activities: Awaited<ReturnType<typeof fetchAllDashboardData>>["activities"] = [];
  let monthly: Awaited<ReturnType<typeof fetchAllDashboardData>>["monthly"] = [];
  let workloads: Awaited<ReturnType<typeof fetchAllDashboardData>>["workloads"] = [];

  try {
    const data = await fetchAllDashboardData(userId);
    stats = data.stats;
    tasks = data.tasks;
    distributions = data.distributions;
    activities = data.activities;
    monthly = data.monthly;
    workloads = data.workloads;
  } catch {
    dataError = "데이터베이스 연결이 일시적으로 불안정합니다. 잠시 후 다시 시도해 주세요.";
  }

  return (
    <section className="space-y-6">
      <h1 className="text-3xl font-bold">대시보드</h1>

      {/* 권한 없음 알림 */}
      {forbiddenError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-800 text-sm">
          관리자 전용 페이지입니다. 접근 권한이 없습니다.
        </div>
      ) : null}

      {/* DB 오류 알림 */}
      {dataError ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900">
          {dataError}
        </div>
      ) : null}

      {/* 통계 카드 */}
      <div className="grid gap-4 md:grid-cols-5">
        <StatCard title="전체 프로젝트" value={stats.totalProjects} color="blue" />
        <StatCard title="진행중" value={stats.activeProjects} color="indigo" />
        <StatCard title="완료" value={stats.completedProjects} color="green" />
        <StatCard title="보류" value={stats.holdProjects} color="amber" />
        <StatCard title="내 할일" value={stats.myTasks} color="rose" />
      </div>

      {/* My 할일 */}
      <div className="rounded-xl border bg-white p-5">
        <h2 className="mb-4 text-xl font-semibold">My 할일</h2>
        {tasks.length === 0 ? (
          <p className="text-slate-500 text-sm">현재 배정된 진행중 단계가 없습니다.</p>
        ) : (
          <ul className="space-y-2">
            {tasks.map((task) => (
              <li key={task.id}>
                <Link
                  href={`/projects/${task.project.id}`}
                  className="flex items-center justify-between rounded-lg border px-4 py-3 hover:bg-slate-50 transition-colors"
                >
                  <div>
                    <p className="font-semibold text-sm">{task.project.name}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {task.stageNumber}단계 진행중
                    </p>
                  </div>
                  <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
                    진행중
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* 차트 행 1: 단계별 분포 + 월별 실적 */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border bg-white p-5">
          <h2 className="mb-4 text-xl font-semibold">단계별 프로젝트 분포</h2>
          <StageDistributionChart data={distributions} />
        </div>

        <div className="rounded-xl border bg-white p-5">
          <h2 className="mb-4 text-xl font-semibold">월별 완료 실적 (최근 6개월)</h2>
          <MonthlyPerformanceChart data={monthly} />
        </div>
      </div>

      {/* 차트 행 2: 담당자별 업무량 + 최근 활동 */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border bg-white p-5">
          <h2 className="mb-4 text-xl font-semibold">담당자별 업무량</h2>
          <AssigneeWorkloadChart data={workloads} />
        </div>

        <div className="rounded-xl border bg-white p-5">
          <h2 className="mb-4 text-xl font-semibold">최근 활동</h2>
          {activities.length === 0 ? (
            <p className="text-sm text-slate-500">최근 활동이 없습니다.</p>
          ) : (
            <ul className="space-y-2 max-h-80 overflow-y-auto">
              {activities.slice(0, 10).map((row) => (
                <li key={row.id} className="rounded border px-3 py-2 text-sm">
                  <p className="font-semibold">
                    {row.action} · {row.entityType}
                  </p>
                  <p className="text-slate-600">
                    {row.project?.name ?? "-"} · {row.user.name}
                  </p>
                  <p className="text-xs text-slate-400">
                    {row.createdAt.toLocaleString("ko-KR")}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

type StatColor = "blue" | "indigo" | "green" | "amber" | "rose";

const COLOR_MAP: Record<StatColor, string> = {
  blue: "border-blue-100 bg-blue-50 text-blue-700",
  indigo: "border-indigo-100 bg-indigo-50 text-indigo-700",
  green: "border-green-100 bg-green-50 text-green-700",
  amber: "border-amber-100 bg-amber-50 text-amber-700",
  rose: "border-rose-100 bg-rose-50 text-rose-700",
};

function StatCard({ title, value, color }: { title: string; value: number; color: StatColor }) {
  return (
    <div className={`rounded-xl border p-4 ${COLOR_MAP[color]}`}>
      <p className="text-xs font-semibold uppercase tracking-wide opacity-70">{title}</p>
      <p className="mt-2 text-3xl font-bold">{value.toLocaleString()}</p>
    </div>
  );
}
