import { ok } from "@/lib/api-response";
import { requireApiRole } from "@/lib/api-auth";
import { dashboardStats } from "@/services/dashboard-service";

export async function GET() {
  const gate = await requireApiRole("VIEWER");
  if (!gate.ok) return gate.response;
  return ok(await dashboardStats(gate.session.user.id));
}
