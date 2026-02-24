import { fail, ok } from "@/lib/api-response";
import { requireApiRole } from "@/lib/api-auth";
import { getUserById, updateUser } from "@/services/user-service";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const gate = await requireApiRole("ADMIN");
  if (!gate.ok) return gate.response;
  const row = await getUserById(params.id);
  if (!row) return fail({ code: "NOT_FOUND", message: "사용자를 찾을 수 없습니다." }, 404);
  return ok(row);
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const gate = await requireApiRole("ADMIN");
  if (!gate.ok) return gate.response;
  const body = await request.json();
  return ok(await updateUser(params.id, body));
}
