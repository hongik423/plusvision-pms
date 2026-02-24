import { ProjectStatus } from "@prisma/client";
import { fail, okWithMeta, ok } from "@/lib/api-response";
import { createProjectSchema } from "@/lib/validators";
import { requireApiRole } from "@/lib/api-auth";
import { createProject, listProjects } from "@/services/project-service";

export async function GET(request: Request) {
  const gate = await requireApiRole("VIEWER");
  if (!gate.ok) {
    return gate.response;
  }

  const url = new URL(request.url);
  const page = Number(url.searchParams.get("page") ?? "1");
  const limit = Number(url.searchParams.get("limit") ?? "20");
  const q = url.searchParams.get("q") ?? undefined;
  const statusRaw = url.searchParams.get("status");
  const status = statusRaw ? (statusRaw as ProjectStatus) : undefined;
  const customerId = url.searchParams.get("customerId") ?? undefined;
  const siteId = url.searchParams.get("siteId") ?? undefined;
  const processTypeId = url.searchParams.get("processTypeId") ?? undefined;
  const itemTypeId = url.searchParams.get("itemTypeId") ?? undefined;
  const assigneeId = url.searchParams.get("assigneeId") ?? undefined;
  const startDate = url.searchParams.get("startDate") ?? undefined;
  const endDate = url.searchParams.get("endDate") ?? undefined;
  const sortRaw = url.searchParams.get("sort");
  const sort =
    sortRaw === "createdAt" || sortRaw === "name" || sortRaw === "dueDate" || sortRaw === "status"
      ? sortRaw
      : "createdAt";
  const orderRaw = url.searchParams.get("order");
  const order = orderRaw === "asc" || orderRaw === "desc" ? orderRaw : "desc";

  const { rows, total } = await listProjects({
    page,
    limit,
    q,
    status,
    customerId,
    siteId,
    processTypeId,
    itemTypeId,
    assigneeId,
    startDate,
    endDate,
    sort,
    order,
    role: gate.role,
    userId: gate.session.user.id,
  });
  return okWithMeta(rows, { page, limit, total });
}

export async function POST(request: Request) {
  const gate = await requireApiRole("USER");
  if (!gate.ok) {
    return gate.response;
  }

  const body = await request.json();
  const parsed = createProjectSchema.safeParse(body);
  if (!parsed.success) {
    return fail(
      {
        code: "VALIDATION_ERROR",
        message: "입력값을 확인해 주세요.",
        details: parsed.error.flatten(),
      },
      400,
    );
  }

  const project = await createProject({
    ...parsed.data,
    createdById: gate.session.user.id,
  });
  return ok(project, { status: 201 });
}
