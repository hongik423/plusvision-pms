import type { LegacyProjectRow, NormalizedProjectRow } from "./types";

export function normalizeRows(rows: LegacyProjectRow[]): NormalizedProjectRow[] {
  return rows.map((row) => {
    const errors: string[] = [];
    if (!row.name) errors.push("프로젝트명이 비어 있습니다.");
    if (!row.customerCode) errors.push("고객사 코드가 비어 있습니다.");
    if (!row.siteCode) errors.push("사업장 코드가 비어 있습니다.");
    if (!row.processCode) errors.push("공정 코드가 비어 있습니다.");
    if (!row.itemCode) errors.push("품목 코드가 비어 있습니다.");
    return { ...row, errors };
  });
}
