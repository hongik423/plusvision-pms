import { requireSession } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";

export default async function ProjectHistoryPage({ params }: { params: { id: string } }) {
  await requireSession();

  const rows = await prisma.auditLog.findMany({
    where: { projectId: params.id },
    include: { user: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <section className="space-y-4">
      <h1 className="text-3xl font-bold">변경 이력</h1>
      <div className="rounded-xl border bg-white p-4">
        {rows.length === 0 ? (
          <p className="text-sm text-slate-500">기록된 변경 이력이 없습니다.</p>
        ) : (
          <ul className="space-y-3">
            {rows.map((row) => (
              <li key={row.id} className="rounded border p-3">
                <p className="font-semibold">
                  {row.action} · {row.entityType}
                </p>
                <p className="text-sm text-slate-600">작업자: {row.user.name}</p>
                <p className="text-xs text-slate-400">{row.createdAt.toLocaleString()}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
