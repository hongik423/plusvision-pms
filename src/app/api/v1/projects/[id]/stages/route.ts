import { ok } from "@/lib/api-response";
import { requireProjectAccess } from "@/lib/api-auth";
import { listStages } from "@/services/stage-service";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const gate = await requireProjectAccess(params.id, "VIEWER");
  if (!gate.ok) {
    return gate.response;
  }
  const rows = await listStages(params.id);
  return ok(rows);
}
