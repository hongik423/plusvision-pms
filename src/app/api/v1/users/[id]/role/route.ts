import { Role } from "@prisma/client";
import { ok } from "@/lib/api-response";
import { requireApiRole } from "@/lib/api-auth";
import { updateUserRole } from "@/services/user-service";

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const gate = await requireApiRole("ADMIN");
  if (!gate.ok) return gate.response;
  const body = await request.json();
  const role = body.role as Role;
  return ok(await updateUserRole(params.id, role));
}
