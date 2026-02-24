import { describe, expect, it } from "vitest";
import { hasRoleAtLeast } from "@/lib/rbac";

describe("RBAC hasRoleAtLeast", () => {
  it("ADMIN은 모든 역할보다 크거나 같다", () => {
    expect(hasRoleAtLeast("ADMIN", "ADMIN")).toBe(true);
    expect(hasRoleAtLeast("ADMIN", "MANAGER")).toBe(true);
    expect(hasRoleAtLeast("ADMIN", "USER")).toBe(true);
    expect(hasRoleAtLeast("ADMIN", "VIEWER")).toBe(true);
  });

  it("MANAGER는 MANAGER 이하만 허용", () => {
    expect(hasRoleAtLeast("MANAGER", "ADMIN")).toBe(false);
    expect(hasRoleAtLeast("MANAGER", "MANAGER")).toBe(true);
    expect(hasRoleAtLeast("MANAGER", "USER")).toBe(true);
    expect(hasRoleAtLeast("MANAGER", "VIEWER")).toBe(true);
  });

  it("USER는 USER 이하만 허용", () => {
    expect(hasRoleAtLeast("USER", "ADMIN")).toBe(false);
    expect(hasRoleAtLeast("USER", "MANAGER")).toBe(false);
    expect(hasRoleAtLeast("USER", "USER")).toBe(true);
    expect(hasRoleAtLeast("USER", "VIEWER")).toBe(true);
  });

  it("VIEWER는 VIEWER만 허용", () => {
    expect(hasRoleAtLeast("VIEWER", "ADMIN")).toBe(false);
    expect(hasRoleAtLeast("VIEWER", "MANAGER")).toBe(false);
    expect(hasRoleAtLeast("VIEWER", "USER")).toBe(false);
    expect(hasRoleAtLeast("VIEWER", "VIEWER")).toBe(true);
  });
});

describe("RBAC 권한별 API 접근 시나리오", () => {
  const scenarios: Array<{
    endpoint: string;
    minimumRole: "ADMIN" | "MANAGER" | "USER" | "VIEWER";
    description: string;
  }> = [
    { endpoint: "GET /api/v1/projects", minimumRole: "VIEWER", description: "프로젝트 목록 조회" },
    { endpoint: "POST /api/v1/projects", minimumRole: "USER", description: "프로젝트 생성" },
    { endpoint: "GET /api/v1/projects/:id", minimumRole: "VIEWER", description: "프로젝트 상세 조회" },
    { endpoint: "PATCH /api/v1/projects/:id", minimumRole: "MANAGER", description: "프로젝트 수정" },
    { endpoint: "DELETE /api/v1/projects/:id", minimumRole: "ADMIN", description: "프로젝트 삭제" },
    { endpoint: "POST /api/v1/projects/:id/copy", minimumRole: "USER", description: "프로젝트 복사" },
    { endpoint: "POST /api/v1/projects/:id/stages/:sn/assign", minimumRole: "MANAGER", description: "담당자 배정" },
    { endpoint: "POST /api/v1/projects/:id/stages/:sn/complete", minimumRole: "USER", description: "단계 완료" },
    { endpoint: "POST /api/v1/projects/:id/documents", minimumRole: "USER", description: "문서 업로드" },
    { endpoint: "DELETE /api/v1/documents/:docId", minimumRole: "ADMIN", description: "문서 삭제" },
    { endpoint: "POST /api/v1/projects/:id/estimates", minimumRole: "USER", description: "견적 생성" },
    { endpoint: "DELETE /api/v1/estimates/:estId", minimumRole: "ADMIN", description: "견적 삭제" },
    { endpoint: "GET /api/v1/master/sites", minimumRole: "VIEWER", description: "마스터 조회" },
    { endpoint: "POST /api/v1/master/sites", minimumRole: "ADMIN", description: "마스터 생성" },
    { endpoint: "GET /api/v1/users", minimumRole: "ADMIN", description: "사용자 목록" },
    { endpoint: "PATCH /api/v1/users/:id/role", minimumRole: "ADMIN", description: "역할 변경" },
    { endpoint: "GET /api/v1/audit-logs", minimumRole: "ADMIN", description: "감사 로그 전체" },
    { endpoint: "GET /api/v1/dashboard/stats", minimumRole: "VIEWER", description: "대시보드 통계" },
    { endpoint: "GET /api/v1/search", minimumRole: "VIEWER", description: "통합 검색" },
    { endpoint: "GET /api/v1/notifications", minimumRole: "VIEWER", description: "알림 목록" },
  ];

  const allRoles = ["ADMIN", "MANAGER", "USER", "VIEWER"] as const;

  for (const scenario of scenarios) {
    describe(`${scenario.description} (${scenario.endpoint})`, () => {
      for (const role of allRoles) {
        const shouldPass = hasRoleAtLeast(role, scenario.minimumRole);
        it(`${role} → ${shouldPass ? "허용" : "차단"}`, () => {
          expect(hasRoleAtLeast(role, scenario.minimumRole)).toBe(shouldPass);
        });
      }
    });
  }
});
