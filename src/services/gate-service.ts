/**
 * Stage-Gate 검증 서비스
 *
 * Phase 전환 시 게이트 조건을 검증합니다.
 * - Gate 1 (4단계→5단계): GO/NO-GO 결정 게이트
 * - Gate 2 (8단계→9단계): 납품 완료 게이트
 */

import { prisma } from "@/lib/prisma";
import {
  GATE_REQUIREMENTS,
  getPhaseByStage,
  PHASE_CONFIG,
  type Phase,
} from "@/lib/constants";

export type GateCheckResult = {
  passed: boolean;
  gateId: string;
  gateName: string;
  phase: Phase;
  nextPhase: Phase;
  checks: {
    name: string;
    passed: boolean;
    message: string;
  }[];
};

/**
 * 게이트 검증 수행
 * 특정 단계 완료 시 Phase 전환 게이트 조건 검사
 */
export async function checkGate(
  projectId: string,
  completingStageNumber: number,
): Promise<GateCheckResult | null> {
  const gateReq = GATE_REQUIREMENTS[completingStageNumber];
  if (!gateReq) {
    return null; // 이 단계에 게이트가 없음
  }

  const currentPhase = getPhaseByStage(completingStageNumber);
  const nextPhase = getPhaseByStage(completingStageNumber + 1);
  const checks: GateCheckResult["checks"] = [];

  // ── 1. 현재 Phase의 모든 이전 단계 완료 확인 ──
  const phaseConfig = PHASE_CONFIG[currentPhase];
  const phaseStages = await prisma.projectStage.findMany({
    where: {
      projectId,
      stageNumber: { in: phaseConfig.stages },
    },
    orderBy: { stageNumber: "asc" },
  });

  const incompleteStages = phaseStages.filter(
    (s) => s.stageNumber < completingStageNumber && s.status !== "COMPLETED" && s.status !== "SKIPPED"
  );

  checks.push({
    name: "이전 단계 완료",
    passed: incompleteStages.length === 0,
    message: incompleteStages.length === 0
      ? `Phase ${phaseConfig.label}의 모든 이전 단계 완료`
      : `미완료 단계: ${incompleteStages.map((s) => `${s.stageNumber}단계(${s.status})`).join(", ")}`,
  });

  // ── 2. 필수 문서 유형 확인 ──
  if (gateReq.requiredDocTypes.length > 0) {
    const docs = await prisma.stageDocument.findMany({
      where: {
        stage: { projectId, stageNumber: { in: phaseConfig.stages } },
        deletedAt: null,
      },
      select: { documentType: true },
    });
    const docTypes = new Set(docs.map((d) => d.documentType));
    const missingDocs = gateReq.requiredDocTypes.filter((t) => !docTypes.has(t as any));

    checks.push({
      name: "필수 문서",
      passed: missingDocs.length === 0,
      message: missingDocs.length === 0
        ? "모든 필수 문서 제출 완료"
        : `미제출 문서: ${missingDocs.join(", ")}`,
    });
  }

  // ── 3. 담당자 배정 확인 ──
  const unassigned = phaseStages.filter((s) => !s.assigneeId);
  checks.push({
    name: "담당자 배정",
    passed: unassigned.length === 0,
    message: unassigned.length === 0
      ? "모든 단계 담당자 배정 완료"
      : `미배정 단계: ${unassigned.map((s) => `${s.stageNumber}단계`).join(", ")}`,
  });

  // ── 4. Gate 1 특수: 프로젝트 상태가 ACTIVE인지 확인 (GO 결정) ──
  if (completingStageNumber === 4) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { status: true },
    });
    const isActive = project?.status === "ACTIVE";
    checks.push({
      name: "GO/NO-GO 결정",
      passed: isActive,
      message: isActive
        ? "프로젝트 진행 결정 (GO)"
        : `프로젝트 상태: ${project?.status ?? "알 수 없음"} — ACTIVE 상태여야 Gate 통과`,
    });
  }

  // ── 5. Gate 2 특수: 견적서 존재 확인 ──
  if (completingStageNumber === 8) {
    const estimateCount = await prisma.estimate.count({ where: { projectId } });
    checks.push({
      name: "견적서 등록",
      passed: estimateCount > 0,
      message: estimateCount > 0
        ? `${estimateCount}건의 견적서 등록 확인`
        : "등록된 견적서가 없습니다.",
    });
  }

  const allPassed = checks.every((c) => c.passed);

  return {
    passed: allPassed,
    gateId: gateReq.gateId,
    gateName: gateReq.gateName,
    phase: currentPhase,
    nextPhase,
    checks,
  };
}

/**
 * 프로젝트의 현재 Phase 정보 조회
 */
export async function getProjectPhaseInfo(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { currentStage: true, status: true },
  });

  if (!project) return null;

  const currentPhase = getPhaseByStage(project.currentStage);
  const phaseConfig = PHASE_CONFIG[currentPhase];

  const stages = await prisma.projectStage.findMany({
    where: { projectId },
    include: { assignee: { select: { id: true, name: true } }, documents: { where: { deletedAt: null } } },
    orderBy: { stageNumber: "asc" },
  });

  // Phase별 진행률 계산
  const phaseProgress = (Object.keys(PHASE_CONFIG) as Phase[]).map((phase) => {
    const config = PHASE_CONFIG[phase];
    const phaseStages = stages.filter((s) => config.stages.includes(s.stageNumber));
    const completed = phaseStages.filter((s) => s.status === "COMPLETED" || s.status === "SKIPPED").length;
    return {
      phase,
      ...config,
      total: phaseStages.length,
      completed,
      progress: phaseStages.length > 0 ? Math.round((completed / phaseStages.length) * 100) : 0,
    };
  });

  return {
    projectId,
    currentPhase,
    currentStage: project.currentStage,
    projectStatus: project.status,
    methodology: phaseConfig.methodology,
    phaseProgress,
    stages,
  };
}
