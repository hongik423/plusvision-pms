import { StageStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { generatePlusPmsId } from "@/lib/id";
import { sendMail, buildStageAssignedEmail, buildStageReadyEmail } from "@/lib/mailer";
import { STAGE_NAMES, GATE_REQUIREMENTS, getPhaseByStage } from "@/lib/constants";
import { checkGate } from "@/services/gate-service";

const APP_URL = process.env.NEXTAUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001";

export async function listStages(projectId: string) {
  return prisma.projectStage.findMany({
    where: { projectId },
    include: { assignee: true, documents: { where: { deletedAt: null } } },
    orderBy: { stageNumber: "asc" },
  });
}

export async function getStage(projectId: string, stageNumber: number) {
  const stage = await prisma.projectStage.findUnique({
    where: { projectId_stageNumber: { projectId, stageNumber } },
    include: {
      assignee: true,
      documents: { where: { deletedAt: null } },
    },
  });
  if (!stage) return null;

  const deletedDocuments = await prisma.stageDocument.findMany({
    where: { stageId: stage.id, deletedAt: { not: null } },
    orderBy: { deletedAt: "desc" },
  });

  return { ...stage, deletedDocuments };
}

export async function updateStageDates({
  projectId,
  stageNumber,
  startDate,
  dueDate,
}: {
  projectId: string;
  stageNumber: number;
  startDate?: string | null;
  dueDate?: string | null;
}) {
  return prisma.projectStage.update({
    where: { projectId_stageNumber: { projectId, stageNumber } },
    data: {
      ...(startDate !== undefined ? { startDate: startDate ? new Date(startDate) : null } : {}),
      ...(dueDate !== undefined ? { dueDate: dueDate ? new Date(dueDate) : null } : {}),
    },
  });
}

export async function assignStage({
  projectId,
  stageNumber,
  assigneeId,
}: {
  projectId: string;
  stageNumber: number;
  assigneeId: string;
}) {
  // [수정] 담당자 존재 여부 사전 검증
  const assigneeExists = await prisma.user.findUnique({
    where: { id: assigneeId },
    select: { id: true, isActive: true },
  });
  if (!assigneeExists || !assigneeExists.isActive) {
    throw new Error("유효하지 않은 담당자입니다.");
  }

  const [updated, project, assignee] = await Promise.all([
    prisma.projectStage.update({
      where: { projectId_stageNumber: { projectId, stageNumber } },
      data: { assigneeId },
    }),
    prisma.project.findUnique({ where: { id: projectId }, select: { id: true, name: true } }),
    prisma.user.findUnique({ where: { id: assigneeId }, select: { name: true, email: true } }),
  ]);

  await prisma.notification.create({
    data: {
      id: generatePlusPmsId("notification"),
      userId: assigneeId,
      projectId,
      type: "STAGE_ASSIGNED",
      title: `${stageNumber}단계 담당자 배정`,
      message: "새로운 단계 담당자로 지정되었습니다.",
      link: `/projects/${projectId}`,
    },
  });

  // 이메일 알림 (비동기, 실패해도 무시)
  if (project && assignee?.email) {
    void sendMail({
      to: assignee.email,
      ...buildStageAssignedEmail({
        assigneeName: assignee.name,
        projectName: project.name,
        stageNumber,
        stageName: STAGE_NAMES[stageNumber] ?? `${stageNumber}단계`,
        projectUrl: `${APP_URL}/projects/${projectId}`,
      }),
    });
  }

  return updated;
}

export async function completeStage({
  projectId,
  stageNumber,
  userId,
  notes,
  status,
}: {
  projectId: string;
  stageNumber: number;
  userId: string;
  notes?: string;
  status: "COMPLETED" | "SKIPPED";
}) {
  // [수정] stageNumber 범위 검증 추가
  if (stageNumber < 1 || stageNumber > 10) {
    throw new Error("유효하지 않은 단계 번호입니다. (1~10)");
  }

  const current = await prisma.projectStage.findUnique({
    where: {
      projectId_stageNumber: {
        projectId,
        stageNumber,
      },
    },
  });

  if (!current) {
    throw new Error("단계를 찾을 수 없습니다.");
  }

  if (!current.startDate || !current.dueDate || !current.assigneeId) {
    throw new Error("완료 전에 시작일, 완료 예정일, 담당자를 모두 지정해야 합니다.");
  }

  // [수정] 현재 단계가 ACTIVE 상태인지 확인
  if (current.status !== StageStatus.ACTIVE) {
    throw new Error(`현재 단계 상태(${current.status})에서는 완료 처리할 수 없습니다. ACTIVE 상태에서만 가능합니다.`);
  }

  if (stageNumber > 1) {
    const previous = await prisma.projectStage.findUnique({
      where: {
        projectId_stageNumber: {
          projectId,
          stageNumber: stageNumber - 1,
        },
      },
    });

    if (!previous || (previous.status !== StageStatus.COMPLETED && previous.status !== StageStatus.SKIPPED)) {
      throw new Error("이전 단계가 완료되지 않았습니다.");
    }
  }

  // ── [Stage-Gate] Phase 전환 게이트 검증 ──
  // 4단계(GO/NO-GO), 8단계(납품완료) 완료 시 게이트 조건 체크
  if (GATE_REQUIREMENTS[stageNumber]) {
    const gateResult = await checkGate(projectId, stageNumber);
    if (gateResult && !gateResult.passed) {
      const failedChecks = gateResult.checks
        .filter((c) => !c.passed)
        .map((c) => c.message)
        .join("; ");
      throw new Error(
        `${gateResult.gateName} 미통과: ${failedChecks}`
      );
    }
  }

  return prisma.$transaction(async (tx) => {
    const done = await tx.projectStage.update({
      where: {
        projectId_stageNumber: { projectId, stageNumber },
      },
      data: {
        status: status === "COMPLETED" ? StageStatus.COMPLETED : StageStatus.SKIPPED,
        completedDate: new Date(),
        notes,
      },
    });

    // [수정] currentStage 업데이트를 한 번만 수행 (이중 업데이트 버그 해결)
    if (stageNumber < 10) {
      const nextStageNumber = stageNumber + 1;
      const nextStage = await tx.projectStage.findUnique({
        where: {
          projectId_stageNumber: { projectId, stageNumber: nextStageNumber },
        },
      });

      if (nextStage && nextStage.status === StageStatus.INACTIVE) {
        await tx.projectStage.update({
          where: { id: nextStage.id },
          data: {
            status: StageStatus.ACTIVE,
            startDate: new Date(),
          },
        });

        if (nextStage.assigneeId) {
          await tx.notification.create({
            data: {
              id: generatePlusPmsId("notification"),
              userId: nextStage.assigneeId,
              projectId,
              type: "NEXT_STAGE_READY",
              title: `${nextStageNumber}단계 진행 가능`,
              message: "이전 단계가 완료되어 다음 단계를 시작할 수 있습니다.",
              link: `/projects/${projectId}`,
            },
          });

          // 이메일 알림 (트랜잭션 완료 후 비동기 발송)
          const capturedAssigneeId = nextStage.assigneeId;
          void (async () => {
            try {
              const [project, assignee] = await Promise.all([
                prisma.project.findUnique({ where: { id: projectId }, select: { name: true } }),
                prisma.user.findUnique({ where: { id: capturedAssigneeId }, select: { name: true, email: true } }),
              ]);
              if (project && assignee?.email) {
                await sendMail({
                  to: assignee.email,
                  ...buildStageReadyEmail({
                    assigneeName: assignee.name,
                    projectName: project.name,
                    stageNumber: nextStageNumber,
                    stageName: STAGE_NAMES[nextStageNumber] ?? `${nextStageNumber}단계`,
                    prevStageName: STAGE_NAMES[stageNumber] ?? `${stageNumber}단계`,
                    projectUrl: `${APP_URL}/projects/${projectId}`,
                  }),
                });
              }
            } catch (err) {
              console.error("[Stage] 이메일 알림 발송 실패:", err);
            }
          })();
        }
      }

      // [수정] 한 번만 currentStage 업데이트
      await tx.project.update({
        where: { id: projectId },
        data: { currentStage: nextStageNumber },
      });
    } else {
      // 10단계 완료 — 프로젝트 완료 처리 (한 번의 업데이트로 통합)
      await tx.project.update({
        where: { id: projectId },
        data: {
          status: "COMPLETED",
          completedDate: new Date(),
          currentStage: 10,
        },
      });
    }

    await tx.auditLog.create({
      data: {
        id: generatePlusPmsId("audit_log"),
        userId,
        projectId,
        action: "STAGE_COMPLETED",
        entityType: "ProjectStage",
        entityId: done.id,
        changes: {
          after: {
            stageNumber,
            status,
            phase: getPhaseByStage(stageNumber),
            gateId: GATE_REQUIREMENTS[stageNumber]?.gateId ?? null,
          },
        },
      },
    });

    return done;
  });
}
