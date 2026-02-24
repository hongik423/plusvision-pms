import { ok } from "@/lib/api-response";
import { requireApiRole } from "@/lib/api-auth";
import { listNotifications } from "@/services/notification-service";

export async function GET() {
  const gate = await requireApiRole("VIEWER");
  if (!gate.ok) return gate.response;
  return ok(await listNotifications(gate.session.user.id));
}
