import { describe, expect, it } from "vitest";
import {
  createProjectSchema,
  assignStageSchema,
  completeStageSchema,
  createEstimateSchema,
} from "@/lib/validators";

describe("createProjectSchema", () => {
  it("필수 필드가 모두 있으면 통과", () => {
    const result = createProjectSchema.safeParse({
      name: "테스트 프로젝트",
      customerId: "cust-1",
      siteId: "site-1",
      processTypeId: "proc-1",
      itemTypeId: "item-1",
    });
    expect(result.success).toBe(true);
  });

  it("프로젝트명 누락 시 실패", () => {
    const result = createProjectSchema.safeParse({
      name: "",
      customerId: "cust-1",
      siteId: "site-1",
      processTypeId: "proc-1",
      itemTypeId: "item-1",
    });
    expect(result.success).toBe(false);
  });

  it("customerId 누락 시 실패", () => {
    const result = createProjectSchema.safeParse({
      name: "프로젝트",
      customerId: "",
      siteId: "site-1",
      processTypeId: "proc-1",
      itemTypeId: "item-1",
    });
    expect(result.success).toBe(false);
  });

  it("선택 필드(description, startDate, dueDate)는 생략 가능", () => {
    const result = createProjectSchema.safeParse({
      name: "테스트",
      customerId: "c1",
      siteId: "s1",
      processTypeId: "p1",
      itemTypeId: "i1",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.description).toBeUndefined();
      expect(result.data.startDate).toBeUndefined();
    }
  });
});

describe("assignStageSchema", () => {
  it("assigneeId가 있으면 통과", () => {
    expect(assignStageSchema.safeParse({ assigneeId: "user-1" }).success).toBe(true);
  });

  it("assigneeId 빈 문자열은 실패", () => {
    expect(assignStageSchema.safeParse({ assigneeId: "" }).success).toBe(false);
  });

  it("assigneeId 누락 시 실패", () => {
    expect(assignStageSchema.safeParse({}).success).toBe(false);
  });
});

describe("completeStageSchema", () => {
  it("status 기본값은 COMPLETED", () => {
    const result = completeStageSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe("COMPLETED");
    }
  });

  it("status SKIPPED 명시 가능", () => {
    const result = completeStageSchema.safeParse({ status: "SKIPPED" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe("SKIPPED");
    }
  });

  it("notes 선택 입력", () => {
    const result = completeStageSchema.safeParse({ notes: "완료 메모" });
    expect(result.success).toBe(true);
  });

  it("허용하지 않는 status 값은 실패", () => {
    const result = completeStageSchema.safeParse({ status: "INVALID" });
    expect(result.success).toBe(false);
  });
});

describe("createEstimateSchema", () => {
  const validItem = {
    itemName: "LVDS 케이블",
    unit: "EA",
    quantity: 10,
    unitPrice: 15000,
  };

  it("유효한 견적 입력은 통과", () => {
    const result = createEstimateSchema.safeParse({
      title: "테스트 견적",
      items: [validItem],
    });
    expect(result.success).toBe(true);
  });

  it("title 누락 시 실패", () => {
    const result = createEstimateSchema.safeParse({
      title: "",
      items: [validItem],
    });
    expect(result.success).toBe(false);
  });

  it("items 빈 배열은 실패", () => {
    const result = createEstimateSchema.safeParse({
      title: "견적",
      items: [],
    });
    expect(result.success).toBe(false);
  });

  it("quantity가 0 이하면 실패", () => {
    const result = createEstimateSchema.safeParse({
      title: "견적",
      items: [{ ...validItem, quantity: 0 }],
    });
    expect(result.success).toBe(false);
  });

  it("unitPrice 음수는 실패", () => {
    const result = createEstimateSchema.safeParse({
      title: "견적",
      items: [{ ...validItem, unitPrice: -100 }],
    });
    expect(result.success).toBe(false);
  });

  it("partSpecId와 remarks는 선택 필드", () => {
    const result = createEstimateSchema.safeParse({
      title: "견적",
      items: [{ ...validItem, partSpecId: "spec-1", remarks: "비고" }],
    });
    expect(result.success).toBe(true);
  });
});
