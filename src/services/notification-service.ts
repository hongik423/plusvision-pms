import { prisma } from "@/lib/prisma";

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
