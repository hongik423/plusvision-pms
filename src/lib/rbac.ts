import { Role } from "@prisma/client";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";

const roleOrder: Record<Role, number> = {
  ADMIN: 4,
  MANAGER: 3,
  USER: 2,
  VIEWER: 1,
};

export async function requireSession() {
  const session = await getServerSession(authOptions);
  return session;
}

export function hasRoleAtLeast(currentRole: Role, minimumRole: Role) {
  return roleOrder[currentRole] >= roleOrder[minimumRole];
}

export async function requireRole(minimumRole: Role) {
  const session = await requireSession();
  if (!session?.user) {
    redirect("/login");
  }

  const role = (session.user.role ?? "USER") as Role;
  if (!hasRoleAtLeast(role, minimumRole)) {
    redirect("/dashboard");
  }

  return { session, role };
}
