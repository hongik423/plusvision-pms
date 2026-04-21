import { ok, fail } from "@/lib/api-response";
import { requireApiRole } from "@/lib/api-auth";
import { adminResetPassword, getUserById } from "@/services/user-service";

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const gate = await requireApiRole("ADMIN");
  if (!gate.ok) return gate.response;

  const user = await getUserById(params.id);
  if (!user?.phone) {
    return fail({ code: "MISSING_PHONE", message: "전화번호가 등록되어 있지 않습니다. 먼저 전화번호를 등록해 주세요." }, 422);
  }

  const temporaryPassword = user.phone.replace(/-/g, "");
  await adminResetPassword(params.id, temporaryPassword, gate.session.user.id);
  return ok({ userId: user.id, temporaryPassword });
}
