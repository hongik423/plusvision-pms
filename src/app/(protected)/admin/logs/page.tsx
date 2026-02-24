import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";

export default async function AdminLogsPage() {
  await requireRole("ADMIN");
  const logs = await prisma.auditLog.findMany({
    include: { user: true, project: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <section className="space-y-4">
      <h1 className="text-3xl font-bold">시스템 로그</h1>
      <div className="space-y-3">
        {logs.map((log) => (
          <article key={log.id} className="rounded-xl border bg-white p-4 text-sm">
            <p className="font-semibold">
              {log.action} / {log.entityType}
            </p>
            <p className="text-slate-600">
              사용자: {log.user.name} / 프로젝트: {log.project?.name ?? "-"}
            </p>
            <p className="text-xs text-slate-400">{log.createdAt.toLocaleString()}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
