import { Role } from "@prisma/client";
import { fail } from "@/lib/api-response";
import { hasRoleAtLeast, requireSession } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";

// 유효한 Role 값 목록
const VALID_ROLES: Role[] = ["ADMIN", "MANAGER", "USER", "VIEWER"];

export async function requireApiRole(minimumRole: Role) {
  const session = await requireSession();
  if (!session?.user) {
    return { ok: false as const, response: fail({ code: "AUTH_REQUIRED", message: "로그인이 필요합니다." }, 401) };
  }

  // [보안 수정] Role 타입 안전성 강화 — 유효하지 않은 역할은 거부
  const rawRole = session.user.role ?? "USER";
  const role = VALID_ROLES.includes(rawRole as Role) ? (rawRole as Role) : "USER";
  if (!hasRoleAtLeast(role, minimumRole)) {
    return { ok: false as const, response: fail({ code: "FORBIDDEN", message: "권한이 없습니다." }, 403) };
  }

  return { ok: true as const, session, role };
}

/**
 * 프로젝트 접근 권한 검증
 * - ADMIN/MANAGER: 모든 프로젝트 접근 가능
 * - USER: 본인이 생성했거나, 멤버이거나, 단계 담당자인 프로젝트만 접근
 * - VIEWER: 모든 프로젝트 읽기만 가능 (minimumRole로 쓰기 제한)
 */
export async function requireProjectAccess(projectId: string, minimumRole: Role = "VIEWER") {
  const gate = await requireApiRole(minimumRole);
  if (!gate.ok) {
    return gate;
  }

  // [수정] ADMIN과 MANAGER만 무조건 접근 허용 — VIEWER도 프로젝트 존재 여부 확인 필요
  if (gate.role === "ADMIN" || gate.role === "MANAGER") {
    // 프로젝트 존재 여부만 확인
    const exists = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true },
    });
    if (!exists) {
      return { ok: false as const, response: fail({ code: "NOT_FOUND", message: "프로젝트를 찾을 수 없습니다." }, 404) };
    }
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

  // VIEWER는 모든 프로젝트 읽기 허용 (단, minimumRole이 VIEWER 이상일 때)
  if (gate.role === "VIEWER") {
    return gate;
  }

  // USER는 본인 관련 프로젝트만 접근 가능
  const hasAccess =
    project.createdById === userId || project.members.length > 0 || project.stages.length > 0;
  if (!hasAccess) {
    return { ok: false as const, response: fail({ code: "FORBIDDEN", message: "담당 프로젝트만 접근할 수 있습니다." }, 403) };
  }

  return gate;
}

/**
 * 견적서 접근 권한 검증 — 견적이 속한 프로젝트 기반으로 권한 체크
 */
export async function requireEstimateAccess(estimateId: string, minimumRole: Role = "VIEWER") {
  const gate = await requireApiRole(minimumRole);
  if (!gate.ok) {
    return gate;
  }

  const estimate = await prisma.estimate.findUnique({
    where: { id: estimateId },
    select: { projectId: true, createdById: true },
  });

  if (!estimate) {
    return { ok: false as const, response: fail({ code: "NOT_FOUND", message: "견적서를 찾을 수 없습니다." }, 404) };
  }

  // ADMIN은 모든 견적 접근 가능
  if (gate.role === "ADMIN") {
    return { ...gate, estimate };
  }

  // MANAGER는 모든 견적 접근 가능
  if (gate.role === "MANAGER") {
    return { ...gate, estimate };
  }

  // USER는 본인이 생성한 견적이거나, 프로젝트 접근 권한이 있는 경우만 수정 가능
  if (gate.role === "USER") {
    const userId = gate.session.user.id;
    if (estimate.createdById === userId) {
      return { ...gate, estimate };
    }
    // 프로젝트 접근 권한도 확인
    const projectAccess = await requireProjectAccess(estimate.projectId, minimumRole);
    if (!projectAccess.ok) {
      return { ok: false as const, response: fail({ code: "FORBIDDEN", message: "해당 견적서에 대한 수정 권한이 없습니다." }, 403) };
    }
    return { ...gate, estimate };
  }

  // VIEWER는 읽기만 가능
  return { ...gate, estimate };
}
