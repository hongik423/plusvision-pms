import { describe, expect, it } from "vitest";
import { STAGE_NAMES, TOTAL_STAGES, STAGE_DESCRIPTIONS, STAGE_DOCUMENT_TYPES } from "@/lib/constants";

describe("10단계 프로세스 무결성", () => {
  it("단계 수는 정확히 10개", () => {
    expect(TOTAL_STAGES).toBe(10);
    expect(Object.keys(STAGE_NAMES)).toHaveLength(10);
  });

  it("모든 단계는 1~10 범위", () => {
    for (let i = 1; i <= 10; i++) {
      expect(STAGE_NAMES[i]).toBeDefined();
      expect(typeof STAGE_NAMES[i]).toBe("string");
      expect(STAGE_NAMES[i].length).toBeGreaterThan(0);
    }
  });

  it("단계 이름 일치 확인", () => {
    expect(STAGE_NAMES[1]).toBe("의뢰 접수");
    expect(STAGE_NAMES[2]).toBe("담당자 지정");
    expect(STAGE_NAMES[3]).toBe("고객 협의");
    expect(STAGE_NAMES[4]).toBe("진행 여부 결정");
    expect(STAGE_NAMES[5]).toBe("채권 등록");
    expect(STAGE_NAMES[6]).toBe("견적 작성");
    expect(STAGE_NAMES[7]).toBe("제작");
    expect(STAGE_NAMES[8]).toBe("납품/설치");
    expect(STAGE_NAMES[9]).toBe("실적 입력");
    expect(STAGE_NAMES[10]).toBe("최종 문서 정리");
  });

  it("모든 단계에 설명이 존재", () => {
    for (let i = 1; i <= 10; i++) {
      expect(STAGE_DESCRIPTIONS[i]).toBeDefined();
      expect(STAGE_DESCRIPTIONS[i].length).toBeGreaterThan(0);
    }
  });

  it("모든 단계에 문서 유형 배열 매핑 존재", () => {
    for (let i = 1; i <= 10; i++) {
      expect(STAGE_DOCUMENT_TYPES[i]).toBeDefined();
      expect(Array.isArray(STAGE_DOCUMENT_TYPES[i])).toBe(true);
    }
  });
});

describe("10단계 자동 생성 로직 시뮬레이션", () => {
  function simulateStageCreation() {
    return Array.from({ length: 10 }, (_, index) => ({
      stageNumber: index + 1,
      stageName: STAGE_NAMES[index + 1],
      status: index === 0 ? "ACTIVE" : "INACTIVE",
    }));
  }

  it("10개 단계가 정확히 생성되어야 한다", () => {
    const stages = simulateStageCreation();
    expect(stages).toHaveLength(10);
  });

  it("1단계만 ACTIVE, 나머지는 INACTIVE", () => {
    const stages = simulateStageCreation();
    expect(stages[0].status).toBe("ACTIVE");
    for (let i = 1; i < 10; i++) {
      expect(stages[i].status).toBe("INACTIVE");
    }
  });

  it("단계 번호는 1부터 10까지 연속", () => {
    const stages = simulateStageCreation();
    stages.forEach((stage, index) => {
      expect(stage.stageNumber).toBe(index + 1);
    });
  });

  it("모든 단계에 이름이 매핑되어 있어야 한다", () => {
    const stages = simulateStageCreation();
    stages.forEach((stage) => {
      expect(stage.stageName).toBeTruthy();
      expect(stage.stageName).toBe(STAGE_NAMES[stage.stageNumber]);
    });
  });
});

describe("순차 진행 검증 시뮬레이션", () => {
  type Stage = { stageNumber: number; status: "INACTIVE" | "ACTIVE" | "COMPLETED" | "SKIPPED" };

  function canCompleteStage(stages: Stage[], targetNumber: number): boolean {
    if (targetNumber === 1) return true;
    const previous = stages.find((s) => s.stageNumber === targetNumber - 1);
    return previous?.status === "COMPLETED";
  }

  it("1단계는 항상 완료 가능", () => {
    const stages: Stage[] = [
      { stageNumber: 1, status: "ACTIVE" },
      { stageNumber: 2, status: "INACTIVE" },
    ];
    expect(canCompleteStage(stages, 1)).toBe(true);
  });

  it("2단계는 1단계 완료 후에만 가능", () => {
    const before: Stage[] = [
      { stageNumber: 1, status: "ACTIVE" },
      { stageNumber: 2, status: "INACTIVE" },
    ];
    expect(canCompleteStage(before, 2)).toBe(false);

    const after: Stage[] = [
      { stageNumber: 1, status: "COMPLETED" },
      { stageNumber: 2, status: "ACTIVE" },
    ];
    expect(canCompleteStage(after, 2)).toBe(true);
  });

  it("이전 단계가 SKIPPED이면 다음 단계 완료 불가", () => {
    const stages: Stage[] = [
      { stageNumber: 1, status: "SKIPPED" },
      { stageNumber: 2, status: "ACTIVE" },
    ];
    expect(canCompleteStage(stages, 2)).toBe(false);
  });

  it("10단계까지 순차 완료 시뮬레이션", () => {
    const stages: Stage[] = Array.from({ length: 10 }, (_, i) => ({
      stageNumber: i + 1,
      status: "INACTIVE" as const,
    }));
    stages[0].status = "ACTIVE";

    for (let i = 0; i < 10; i++) {
      expect(canCompleteStage(stages, i + 1)).toBe(i === 0 || stages[i - 1].status === "COMPLETED");
      stages[i].status = "COMPLETED";
      if (i < 9) {
        stages[i + 1].status = "ACTIVE";
      }
    }

    expect(stages.every((s) => s.status === "COMPLETED")).toBe(true);
  });
});
