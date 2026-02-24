import { describe, expect, it } from "vitest";

function generateProjectNumber(year: number, existingCount: number) {
  const prefix = `PV-${year}-`;
  return `${prefix}${String(existingCount + 1).padStart(3, "0")}`;
}

describe("프로젝트 번호 채번", () => {
  it("첫 프로젝트 번호는 PV-YYYY-001", () => {
    expect(generateProjectNumber(2026, 0)).toBe("PV-2026-001");
  });

  it("10번째 프로젝트 번호", () => {
    expect(generateProjectNumber(2026, 9)).toBe("PV-2026-010");
  });

  it("100번째 프로젝트 번호", () => {
    expect(generateProjectNumber(2026, 99)).toBe("PV-2026-100");
  });

  it("연도별 별도 채번", () => {
    expect(generateProjectNumber(2025, 5)).toBe("PV-2025-006");
    expect(generateProjectNumber(2026, 0)).toBe("PV-2026-001");
  });

  it("번호 형식: PV-연도-3자리", () => {
    const num = generateProjectNumber(2026, 42);
    expect(num).toMatch(/^PV-\d{4}-\d{3}$/);
  });
});
