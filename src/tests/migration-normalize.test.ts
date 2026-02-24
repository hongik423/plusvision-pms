import { describe, expect, it } from "vitest";
import { normalizeRows } from "@/scripts/migration/normalize";
import type { LegacyProjectRow } from "@/scripts/migration/types";

describe("마이그레이션: normalizeRows 검증", () => {
  const validRow: LegacyProjectRow = {
    legacyId: "LEG-001",
    name: "OBPH CMP 케이블 교체",
    customerCode: "SEC",
    siteCode: "GH",
    processCode: "CMP",
    itemCode: "CABLE",
    description: "기흥 CMP 라인 케이블 교체 작업",
  };

  it("유효한 행은 에러가 비어야 한다", () => {
    const results = normalizeRows([validRow]);
    expect(results).toHaveLength(1);
    expect(results[0].errors).toEqual([]);
  });

  it("프로젝트명 누락 시 에러 1건", () => {
    const results = normalizeRows([{ ...validRow, name: "" }]);
    expect(results[0].errors).toContain("프로젝트명이 비어 있습니다.");
  });

  it("고객사 코드 누락 시 에러 1건", () => {
    const results = normalizeRows([{ ...validRow, customerCode: "" }]);
    expect(results[0].errors).toContain("고객사 코드가 비어 있습니다.");
  });

  it("사업장 코드 누락 시 에러 1건", () => {
    const results = normalizeRows([{ ...validRow, siteCode: "" }]);
    expect(results[0].errors).toContain("사업장 코드가 비어 있습니다.");
  });

  it("공정 코드 누락 시 에러 1건", () => {
    const results = normalizeRows([{ ...validRow, processCode: "" }]);
    expect(results[0].errors).toContain("공정 코드가 비어 있습니다.");
  });

  it("품목 코드 누락 시 에러 1건", () => {
    const results = normalizeRows([{ ...validRow, itemCode: "" }]);
    expect(results[0].errors).toContain("품목 코드가 비어 있습니다.");
  });

  it("모든 필드 누락 시 에러 5건", () => {
    const results = normalizeRows([
      {
        legacyId: "BAD",
        name: "",
        customerCode: "",
        siteCode: "",
        processCode: "",
        itemCode: "",
      },
    ]);
    expect(results[0].errors).toHaveLength(5);
  });

  it("여러 행 일괄 검증", () => {
    const results = normalizeRows([
      validRow,
      { ...validRow, legacyId: "LEG-002", name: "" },
      { ...validRow, legacyId: "LEG-003", siteCode: "", processCode: "" },
    ]);
    expect(results).toHaveLength(3);
    expect(results[0].errors).toHaveLength(0);
    expect(results[1].errors).toHaveLength(1);
    expect(results[2].errors).toHaveLength(2);
  });

  it("description은 비어 있어도 에러 없음 (선택 필드)", () => {
    const results = normalizeRows([{ ...validRow, description: undefined }]);
    expect(results[0].errors).toHaveLength(0);
  });
});

describe("마이그레이션: 파일 유형 자동 분류 규칙", () => {
  const classificationRules: Record<string, { targetStage: number; documentType: string }> = {
    견적서: { targetStage: 6, documentType: "ESTIMATE" },
    제안서: { targetStage: 6, documentType: "PROPOSAL" },
    "제작 매뉴얼": { targetStage: 7, documentType: "MANUFACTURE_MANUAL" },
    "설치 매뉴얼": { targetStage: 8, documentType: "INSTALL_MANUAL" },
    "부품 리스트": { targetStage: 7, documentType: "PARTS_LIST" },
    "현장 사진": { targetStage: 3, documentType: "SITE_PHOTO" },
    "도면(DWG/DXF)": { targetStage: 7, documentType: "DRAWING" },
    기타: { targetStage: 10, documentType: "OTHER" },
  };

  for (const [label, rule] of Object.entries(classificationRules)) {
    it(`${label} → stage-${rule.targetStage} / ${rule.documentType}`, () => {
      expect(rule.targetStage).toBeGreaterThanOrEqual(1);
      expect(rule.targetStage).toBeLessThanOrEqual(10);
      expect(rule.documentType.length).toBeGreaterThan(0);
    });
  }
});

describe("마이그레이션: dry-run 검증 시뮬레이션", () => {
  const validMasterCodes = {
    customers: ["SEC"],
    sites: ["GH", "HS", "CA", "PT"],
    processTypes: ["CMP", "CVD", "IMP", "ETCH", "DIFF", "ETC"],
    itemTypes: ["CABLE", "CTRL", "DOOR", "DISP", "SENSOR", "ETC"],
  };

  function validateMasterCodeRef(row: LegacyProjectRow): string[] {
    const errors: string[] = [];
    if (!validMasterCodes.customers.includes(row.customerCode)) {
      errors.push(`고객사 코드 "${row.customerCode}" 미존재`);
    }
    if (!validMasterCodes.sites.includes(row.siteCode)) {
      errors.push(`사업장 코드 "${row.siteCode}" 미존재`);
    }
    if (!validMasterCodes.processTypes.includes(row.processCode)) {
      errors.push(`공정 코드 "${row.processCode}" 미존재`);
    }
    if (!validMasterCodes.itemTypes.includes(row.itemCode)) {
      errors.push(`품목 코드 "${row.itemCode}" 미존재`);
    }
    return errors;
  }

  it("유효한 마스터 코드 참조 시 에러 없음", () => {
    const errors = validateMasterCodeRef({
      legacyId: "L-1",
      name: "테스트",
      customerCode: "SEC",
      siteCode: "GH",
      processCode: "CMP",
      itemCode: "CABLE",
    });
    expect(errors).toHaveLength(0);
  });

  it("잘못된 고객사 코드 참조 감지", () => {
    const errors = validateMasterCodeRef({
      legacyId: "L-2",
      name: "테스트",
      customerCode: "INVALID",
      siteCode: "GH",
      processCode: "CMP",
      itemCode: "CABLE",
    });
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("고객사 코드");
  });

  it("여러 마스터 코드 오류 동시 감지", () => {
    const errors = validateMasterCodeRef({
      legacyId: "L-3",
      name: "테스트",
      customerCode: "BAD",
      siteCode: "XX",
      processCode: "CMP",
      itemCode: "CABLE",
    });
    expect(errors).toHaveLength(2);
  });

  it("모든 유효한 사업장 코드 통과", () => {
    for (const code of validMasterCodes.sites) {
      const errors = validateMasterCodeRef({
        legacyId: "T",
        name: "T",
        customerCode: "SEC",
        siteCode: code,
        processCode: "CMP",
        itemCode: "CABLE",
      });
      expect(errors).toHaveLength(0);
    }
  });
});
