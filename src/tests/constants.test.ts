import { describe, expect, it } from "vitest";
import { STAGE_NAMES, TOTAL_STAGES } from "@/lib/constants";

describe("프로젝트 단계 상수", () => {
  it("단계 수는 10개여야 한다", () => {
    expect(TOTAL_STAGES).toBe(10);
    expect(Object.keys(STAGE_NAMES)).toHaveLength(10);
  });
});
