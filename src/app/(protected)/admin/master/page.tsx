import { MasterCrudPanel } from "@/components/admin/master-crud-panel";
import { requireRole } from "@/lib/rbac";

export default async function AdminMasterPage() {
  await requireRole("ADMIN");
  return <MasterCrudPanel />;
}
