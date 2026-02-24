import { fail, ok } from "@/lib/api-response";
import { requireApiRole } from "@/lib/api-auth";
import { markAsRead } from "@/services/notification-service";

export async function PATCH(_request: Request, { params }: { params: { id: string } }) {
  const gate = await requireApiRole("VIEWER");
  if (!gate.ok) return gate.response;
  const row = await markAsRead(params.id, gate.session.user.id);
  if (!row) {
    return fail({ code: "NOT_FOUND", message: "알림을 찾을 수 없습니다." }, 404);
  }
  return ok(row);
}
