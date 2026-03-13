/**
 * 감사 로그 자동 생성 헬퍼
 *
 * 사용 예:
 *   await logAudit({ userId, projectId, action: "UPLOAD", entityType: "DOCUMENT", entityId: doc.id, changes: {...} });
 */
import { prisma } from "@/lib/prisma";

type AuditInput = {
  userId: string;
  projectId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  changes?: Record<string, unknown> | null;
  ipAddress?: string | null;
};

/**
 * 감사 로그를 생성합니다.
 * 실패 시에도 throw하지 않고 콘솔 에러만 출력합니다 (비즈니스 로직 중단 방지).
 */
export async function logAudit(input: AuditInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: input.userId,
        projectId: input.projectId ?? undefined,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        changes: (input.changes as Record<string, string | number | boolean | null>) ?? undefined,
        ipAddress: input.ipAddress ?? undefined,
      },
    });
  } catch (err) {
    console.error("[AuditLog] 감사 로그 기록 실패:", err);
  }
}
