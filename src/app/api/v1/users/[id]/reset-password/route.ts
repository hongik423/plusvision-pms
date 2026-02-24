import { ok } from "@/lib/api-response";
import { requireApiRole } from "@/lib/api-auth";
import { adminResetPassword } from "@/services/user-service";

function generateTemporaryPassword() {
  const random = Math.random().toString(36).slice(-8);
  return `PlusPMS!${random}`;
}

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const gate = await requireApiRole("ADMIN");
  if (!gate.ok) {
    return gate.response;
  }

  const temporaryPassword = generateTemporaryPassword();
  const user = await adminResetPassword(params.id, temporaryPassword, gate.session.user.id);
  return ok({
    userId: user.id,
    temporaryPassword,
  });
}
