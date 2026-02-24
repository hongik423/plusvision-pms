import { ok } from "@/lib/api-response";
import { requireApiRole } from "@/lib/api-auth";
import { dashboardMyTasks } from "@/services/dashboard-service";

export async function GET() {
  const gate = await requireApiRole("VIEWER");
  if (!gate.ok) return gate.response;
  return ok(await dashboardMyTasks(gate.session.user.id));
}
