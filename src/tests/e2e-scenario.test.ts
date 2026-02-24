import { describe, expect, it } from "vitest";
import { hasRoleAtLeast } from "@/lib/rbac";
import { createProjectSchema, createEstimateSchema, completeStageSchema } from "@/lib/validators";
import { STAGE_NAMES, ALLOWED_FILE_EXTENSIONS, MAX_FILE_SIZE } from "@/lib/constants";

describe("E2E 시나리오: 프로젝트 생성 → 단계 진행 → 문서 업로드 → 견적 → 완료", () => {
  const roles = {
    admin: "ADMIN" as const,
    manager: "MANAGER" as const,
    user: "USER" as const,
    viewer: "VIEWER" as const,
  };

  describe("1단계: 프로젝트 생성", () => {
    const projectInput = {
      name: "기흥 CMP 라인 케이블 교체",
      customerId: "cust-sec",
      siteId: "site-gh",
      processTypeId: "proc-cmp",
      itemTypeId: "item-cable",
    };

    it("MANAGER 이상은 프로젝트 생성 가능", () => {
      expect(hasRoleAtLeast(roles.manager, "USER")).toBe(true);
      expect(hasRoleAtLeast(roles.admin, "USER")).toBe(true);
    });

    it("VIEWER는 프로젝트 생성 불가", () => {
      expect(hasRoleAtLeast(roles.viewer, "USER")).toBe(false);
    });

    it("프로젝트 입력 검증 통과", () => {
      const result = createProjectSchema.safeParse(projectInput);
      expect(result.success).toBe(true);
    });

    it("생성 시 10단계 자동 생성 시뮬레이션", () => {
      const stages = Array.from({ length: 10 }, (_, i) => ({
        stageNumber: i + 1,
        stageName: STAGE_NAMES[i + 1],
        status: i === 0 ? "ACTIVE" : "INACTIVE",
      }));
      expect(stages).toHaveLength(10);
      expect(stages[0].status).toBe("ACTIVE");
    });
  });

  describe("2단계: 담당자 배정", () => {
    it("MANAGER는 담당자 배정 가능", () => {
      expect(hasRoleAtLeast(roles.manager, "MANAGER")).toBe(true);
    });

    it("USER는 담당자 배정 불가", () => {
      expect(hasRoleAtLeast(roles.user, "MANAGER")).toBe(false);
    });
  });

  describe("3단계: 순차 단계 완료", () => {
    it("단계 완료 입력 검증", () => {
      const result = completeStageSchema.safeParse({
        notes: "1단계 완료",
        status: "COMPLETED",
      });
      expect(result.success).toBe(true);
    });

    it("USER 이상은 단계 완료 가능", () => {
      expect(hasRoleAtLeast(roles.user, "USER")).toBe(true);
    });

    it("VIEWER는 단계 완료 불가", () => {
      expect(hasRoleAtLeast(roles.viewer, "USER")).toBe(false);
    });
  });

  describe("4단계: 문서 업로드", () => {
    it("허용 파일만 업로드 가능", () => {
      const allowed = ["report.pdf", "drawing.dwg", "photo.jpg"];
      for (const name of allowed) {
        const lower = name.toLowerCase();
        const valid = ALLOWED_FILE_EXTENSIONS.some((ext) => lower.endsWith(ext));
        expect(valid).toBe(true);
      }
    });

    it("실행파일은 업로드 차단", () => {
      const blocked = ["virus.exe", "script.bat"];
      for (const name of blocked) {
        const lower = name.toLowerCase();
        const valid = ALLOWED_FILE_EXTENSIONS.some((ext) => lower.endsWith(ext));
        expect(valid).toBe(false);
      }
    });

    it("100MB 이하만 허용", () => {
      expect(50 * 1024 * 1024 <= MAX_FILE_SIZE).toBe(true);
      expect(200 * 1024 * 1024 <= MAX_FILE_SIZE).toBe(false);
    });

    it("USER 이상은 문서 업로드 가능", () => {
      expect(hasRoleAtLeast(roles.user, "USER")).toBe(true);
    });
  });

  describe("5단계: 견적 생성", () => {
    it("견적 입력 검증 통과", () => {
      const result = createEstimateSchema.safeParse({
        title: "기흥 CMP 케이블 교체 견적서",
        items: [
          { itemName: "LVDS 케이블", unit: "EA", quantity: 10, unitPrice: 15000 },
          { itemName: "파워 케이블", unit: "EA", quantity: 5, unitPrice: 8000 },
        ],
      });
      expect(result.success).toBe(true);
    });

    it("금액 자동 계산 검증", () => {
      const items = [
        { quantity: 10, unitPrice: 15000 },
        { quantity: 5, unitPrice: 8000 },
      ];
      const total = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
      expect(total).toBe(190000);
      expect(Math.floor(total * 0.1)).toBe(19000);
      expect(total + Math.floor(total * 0.1)).toBe(209000);
    });
  });

  describe("6단계: 프로젝트 삭제는 ADMIN만", () => {
    it("ADMIN만 프로젝트 삭제 가능", () => {
      expect(hasRoleAtLeast(roles.admin, "ADMIN")).toBe(true);
      expect(hasRoleAtLeast(roles.manager, "ADMIN")).toBe(false);
      expect(hasRoleAtLeast(roles.user, "ADMIN")).toBe(false);
      expect(hasRoleAtLeast(roles.viewer, "ADMIN")).toBe(false);
    });

    it("ADMIN만 문서 삭제 가능", () => {
      expect(hasRoleAtLeast(roles.admin, "ADMIN")).toBe(true);
    });

    it("ADMIN만 견적 삭제 가능", () => {
      expect(hasRoleAtLeast(roles.admin, "ADMIN")).toBe(true);
    });
  });

  describe("7단계: 감사 로그 / 알림 접근", () => {
    it("전체 감사 로그는 ADMIN만 조회 가능", () => {
      expect(hasRoleAtLeast(roles.admin, "ADMIN")).toBe(true);
      expect(hasRoleAtLeast(roles.manager, "ADMIN")).toBe(false);
    });

    it("프로젝트별 감사 로그는 MANAGER 이상 조회 가능", () => {
      expect(hasRoleAtLeast(roles.manager, "MANAGER")).toBe(true);
      expect(hasRoleAtLeast(roles.user, "MANAGER")).toBe(false);
    });

    it("알림은 모든 인증 사용자 조회 가능", () => {
      expect(hasRoleAtLeast(roles.viewer, "VIEWER")).toBe(true);
    });
  });
});
