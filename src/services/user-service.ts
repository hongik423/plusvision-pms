import { Role } from "@prisma/client";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { generatePlusPmsId } from "@/lib/id";

export async function listUsers() {
  return prisma.user.findMany({
    orderBy: { createdAt: "desc" },
  });
}

export async function getUserById(id: string) {
  return prisma.user.findUnique({ where: { id } });
}

export async function updateUser(
  id: string,
  data: Partial<{ name: string; department: string; phone: string; isActive: boolean }>,
) {
  return prisma.user.update({
    where: { id },
    data,
  });
}

export async function updateUserRole(id: string, role: Role) {
  return prisma.user.update({
    where: { id },
    data: { role },
  });
}

export async function getMyTasks(userId: string) {
  return prisma.projectStage.findMany({
    where: {
      assigneeId: userId,
      status: "ACTIVE",
    },
    include: {
      project: true,
    },
    orderBy: {
      updatedAt: "desc",
    },
  });
}

export async function requestSignup(input: {
  email: string;
  name: string;
  password: string;
  department?: string;
  phone?: string;
}) {
  const exists = await prisma.user.findUnique({
    where: { email: input.email },
    select: { id: true, isActive: true },
  });

  if (exists?.isActive) {
    throw new Error("이미 사용 중인 이메일입니다.");
  }

  const encrypted = await hash(input.password, 12);

  if (exists && !exists.isActive) {
    return prisma.user.update({
      where: { id: exists.id },
      data: {
        name: input.name,
        password: encrypted,
        department: input.department,
        phone: input.phone,
        role: "USER",
      },
    });
  }

  return prisma.user.create({
    data: {
      id: generatePlusPmsId("user"),
      email: input.email,
      name: input.name,
      password: encrypted,
      role: "USER",
      isActive: false,
      department: input.department,
      phone: input.phone,
    },
  });
}

export async function requestPasswordReset(email: string) {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, name: true, email: true },
  });

  if (!user) {
    return;
  }

  const admins = await prisma.user.findMany({
    where: {
      isActive: true,
      role: "ADMIN",
    },
    select: { id: true },
  });

  if (admins.length === 0) {
    return;
  }

  await prisma.notification.createMany({
    data: admins.map((admin) => ({
      id: generatePlusPmsId("notification"),
      userId: admin.id,
      type: "PASSWORD_RESET_REQUEST",
      title: "비밀번호 재설정 요청",
      message: `${user.name}(${user.email}) 사용자가 비밀번호 재설정을 요청했습니다.`,
      link: "/admin/users",
    })),
  });
}

export async function adminResetPassword(userId: string, nextPassword: string, adminId: string) {
  const encrypted = await hash(nextPassword, 12);
  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      password: encrypted,
      isActive: true,
    },
  });

  await prisma.notification.create({
    data: {
      id: generatePlusPmsId("notification"),
      userId,
      type: "PASSWORD_RESET_COMPLETED",
      title: "비밀번호가 재설정되었습니다",
      message: "관리자가 비밀번호를 재설정했습니다. 임시 비밀번호로 로그인 후 변경해 주세요.",
      link: "/login",
    },
  });

  await prisma.auditLog.create({
    data: {
      id: generatePlusPmsId("audit_log"),
      userId: adminId,
      action: "PASSWORD_RESET",
      entityType: "User",
      entityId: userId,
      changes: {
        after: {
          isActive: updated.isActive,
        },
      },
    },
  });

  return updated;
}
