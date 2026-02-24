import { StageStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { generatePlusPmsId } from "@/lib/id";
import { sendMail, buildStageAssignedEmail, buildStageReadyEmail } from "@/lib/mailer";
import { STAGE_NAMES } from "@/lib/constants";

const APP_URL = process.env.NEXTAUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001";

export async function listStages(projectId: string) {
  return prisma.projectStage.findMany({
    where: { projectId },
    include: { assignee: true, documents: true },
    orderBy: { stageNumber: "asc" },
  });
}

export async function getStage(projectId: string, stageNumber: number) {
  return prisma.projectStage.findUnique({
    where: {
      projectId_stageNumber: {
        projectId,
        stageNumber,
      },
    },
    include: { assignee: true, documents: true },
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

  if (stageNumber > 1) {
    const previous = await prisma.projectStage.findUnique({
      where: {
        projectId_stageNumber: {
          projectId,
          stageNumber: stageNumber - 1,
        },
      },
    });

    if (!previous || previous.status !== StageStatus.COMPLETED) {
      throw new Error("이전 단계가 완료되지 않았습니다.");
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

    if (stageNumber < 10) {
      const nextStage = await tx.projectStage.findUnique({
        where: {
          projectId_stageNumber: { projectId, stageNumber: stageNumber + 1 },
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
              title: `${stageNumber + 1}단계 진행 가능`,
              message: "이전 단계가 완료되어 다음 단계를 시작할 수 있습니다.",
              link: `/projects/${projectId}`,
            },
          });

          // 이메일 알림 (트랜잭션 밖에서 비동기 발송)
          void (async () => {
            try {
              const [project, assignee] = await Promise.all([
                prisma.project.findUnique({ where: { id: projectId }, select: { name: true } }),
                prisma.user.findUnique({ where: { id: nextStage.assigneeId! }, select: { name: true, email: true } }),
              ]);
              if (project && assignee?.email) {
                await sendMail({
                  to: assignee.email,
                  ...buildStageReadyEmail({
                    assigneeName: assignee.name,
                    projectName: project.name,
                    stageNumber: stageNumber + 1,
                    stageName: STAGE_NAMES[stageNumber + 1] ?? `${stageNumber + 1}단계`,
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
    } else {
      await tx.project.update({
        where: { id: projectId },
        data: {
          status: "COMPLETED",
          completedDate: new Date(),
          currentStage: 10,
        },
      });
    }

    await tx.project.update({
      where: { id: projectId },
      data: { currentStage: stageNumber === 10 ? 10 : stageNumber + 1 },
    });

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
          },
        },
      },
    });

    return done;
  });
}
