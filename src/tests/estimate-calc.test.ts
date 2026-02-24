import { describe, expect, it } from "vitest";

type EstimateItemInput = {
  itemName: string;
  quantity: number;
  unitPrice: number;
};

function calculateEstimateTotals(items: EstimateItemInput[]) {
  const totalAmount = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const taxAmount = Math.floor(totalAmount * 0.1);
  const grandTotal = totalAmount + taxAmount;
  return { totalAmount, taxAmount, grandTotal };
}

function generateEstimateNumber(year: number, sequentialCount: number) {
  const prefix = `EST-${year}-`;
  return `${prefix}${String(sequentialCount + 1).padStart(3, "0")}`;
}

describe("견적 금액 자동 계산", () => {
  it("단일 항목 금액 = 수량 x 단가", () => {
    const result = calculateEstimateTotals([
      { itemName: "LVDS 케이블", quantity: 10, unitPrice: 15000 },
    ]);
    expect(result.totalAmount).toBe(150000);
  });

  it("부가세 = 합계의 10% (내림)", () => {
    const result = calculateEstimateTotals([
      { itemName: "케이블", quantity: 3, unitPrice: 15001 },
    ]);
    expect(result.totalAmount).toBe(45003);
    expect(result.taxAmount).toBe(Math.floor(45003 * 0.1));
    expect(result.taxAmount).toBe(4500);
  });

  it("총액 = 합계 + 부가세", () => {
    const result = calculateEstimateTotals([
      { itemName: "PLC", quantity: 2, unitPrice: 280000 },
    ]);
    expect(result.totalAmount).toBe(560000);
    expect(result.taxAmount).toBe(56000);
    expect(result.grandTotal).toBe(616000);
  });

  it("여러 항목 합산", () => {
    const result = calculateEstimateTotals([
      { itemName: "케이블", quantity: 5, unitPrice: 10000 },
      { itemName: "PLC", quantity: 1, unitPrice: 280000 },
      { itemName: "릴레이", quantity: 20, unitPrice: 5000 },
    ]);
    expect(result.totalAmount).toBe(50000 + 280000 + 100000);
    expect(result.totalAmount).toBe(430000);
    expect(result.taxAmount).toBe(43000);
    expect(result.grandTotal).toBe(473000);
  });

  it("빈 항목 배열이면 0원", () => {
    const result = calculateEstimateTotals([]);
    expect(result.totalAmount).toBe(0);
    expect(result.taxAmount).toBe(0);
    expect(result.grandTotal).toBe(0);
  });
});

describe("견적 번호 생성", () => {
  it("올해 기준 첫 번째 견적 번호", () => {
    const num = generateEstimateNumber(2026, 0);
    expect(num).toBe("EST-2026-001");
  });

  it("10번째 견적 번호", () => {
    const num = generateEstimateNumber(2026, 9);
    expect(num).toBe("EST-2026-010");
  });

  it("100번째 견적 번호", () => {
    const num = generateEstimateNumber(2026, 99);
    expect(num).toBe("EST-2026-100");
  });

  it("연도별 별도 채번", () => {
    expect(generateEstimateNumber(2025, 0)).toBe("EST-2025-001");
    expect(generateEstimateNumber(2026, 0)).toBe("EST-2026-001");
  });
});
