import { requireRole } from "@/lib/rbac";
import { TemplateManagementPanel } from "@/components/admin/template-management-panel";

export default async function AdminTemplatesPage() {
  await requireRole("ADMIN");

  return <TemplateManagementPanel />;
}
