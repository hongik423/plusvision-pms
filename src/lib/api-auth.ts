import { Role } from "@prisma/client";
import { fail } from "@/lib/api-response";
import { hasRoleAtLeast, requireSession } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";

export async function requireApiRole(minimumRole: Role) {
  const session = await requireSession();
  if (!session?.user) {
    return { ok: false as const, response: fail({ code: "AUTH_REQUIRED", message: "로그인이 필요합니다." }, 401) };
  }

  const role = (session.user.role ?? "USER") as Role;
  if (!hasRoleAtLeast(role, minimumRole)) {
    return { ok: false as const, response: fail({ code: "FORBIDDEN", message: "권한이 없습니다." }, 403) };
  }

  return { ok: true as const, session, role };
}

export async function requireProjectAccess(projectId: string, minimumRole: Role = "VIEWER") {
  const gate = await requireApiRole(minimumRole);
  if (!gate.ok) {
    return gate;
  }

  if (gate.role === "ADMIN" || gate.role === "MANAGER" || gate.role === "VIEWER") {
    return gate;
  }

  const userId = gate.session.user.id;
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      createdById: true,
      members: { where: { userId }, select: { id: true } },
      stages: { where: { assigneeId: userId }, select: { id: true } },
    },
  });

  if (!project) {
    return { ok: false as const, response: fail({ code: "NOT_FOUND", message: "프로젝트를 찾을 수 없습니다." }, 404) };
  }

  const hasAccess =
    project.createdById === userId || project.members.length > 0 || project.stages.length > 0;
  if (!hasAccess) {
    return { ok: false as const, response: fail({ code: "FORBIDDEN", message: "담당 프로젝트만 접근할 수 있습니다." }, 403) };
  }

  return gate;
}
