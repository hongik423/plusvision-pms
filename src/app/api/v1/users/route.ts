import { ok } from "@/lib/api-response";
import { requireApiRole } from "@/lib/api-auth";
import { listUsers } from "@/services/user-service";

export async function GET() {
  const gate = await requireApiRole("ADMIN");
  if (!gate.ok) return gate.response;
  return ok(await listUsers());
}
