import { listUsers } from "@/services/user-service";
import { requireRole } from "@/lib/rbac";
import { UserManagementPanel } from "@/components/admin/user-management-panel";

export default async function AdminUsersPage() {
  await requireRole("ADMIN");
  const users = await listUsers();

  return <UserManagementPanel initialUsers={users} />;
}
