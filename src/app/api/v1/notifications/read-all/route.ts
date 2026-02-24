import { ok } from "@/lib/api-response";
import { requireApiRole } from "@/lib/api-auth";
import { markAllAsRead } from "@/services/notification-service";

export async function POST() {
  const gate = await requireApiRole("VIEWER");
  if (!gate.ok) return gate.response;
  return ok(await markAllAsRead(gate.session.user.id));
}
