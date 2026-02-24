import { ok } from "@/lib/api-response";
import { requireApiRole } from "@/lib/api-auth";
import { integratedSearch } from "@/services/search-service";

export async function GET(request: Request) {
  const gate = await requireApiRole("VIEWER");
  if (!gate.ok) return gate.response;
  const url = new URL(request.url);
  const q = url.searchParams.get("q") ?? "";
  const dateFrom = url.searchParams.get("dateFrom") ?? undefined;
  const dateTo = url.searchParams.get("dateTo") ?? undefined;
  return ok(await integratedSearch({ query: q, dateFrom, dateTo }));
}
