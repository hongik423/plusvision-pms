import { ok } from "@/lib/api-response";
import { requireApiRole } from "@/lib/api-auth";
import { getMyTasks } from "@/services/user-service";

export async function GET() {
  const gate = await requireApiRole("VIEWER");
  if (!gate.ok) return gate.response;
  return ok(await getMyTasks(gate.session.user.id));
}
