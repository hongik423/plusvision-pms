import { prisma } from "@/lib/prisma";
import { generatePlusPmsId } from "@/lib/id";

// ── 알림 생성 ──────────────────────────────────────────
export async function createNotification(params: {
  userId: string;
  projectId?: string | null;
  type: string;
  title: string;
  message: string;
  link?: string | null;
}) {
  return prisma.notification.create({
    data: {
      id: generatePlusPmsId("notification"),
      userId:    params.userId,
      projectId: params.projectId ?? undefined,
      type:      params.type,
      title:     params.title,
      message:   params.message,
      link:      params.link ?? undefined,
    },
  });
}

export async function listNotifications(userId: string) {
  return prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
}

export async function unreadCount(userId: string) {
  return prisma.notification.count({ where: { userId, isRead: false } });
}

export async function markAsRead(id: string, userId: string) {
  const updated = await prisma.notification.updateMany({
    where: { id, userId },
    data: { isRead: true },
  });
  if (updated.count === 0) {
    return null;
  }
  return prisma.notification.findUnique({ where: { id } });
}

export async function markAllAsRead(userId: string) {
  return prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true },
  });
}
