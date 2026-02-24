import { fail, ok } from "@/lib/api-response";
import { requireApiRole, requireProjectAccess } from "@/lib/api-auth";
import { deleteProject, getProjectById, updateProject } from "@/services/project-service";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const gate = await requireProjectAccess(params.id, "VIEWER");
  if (!gate.ok) {
    return gate.response;
  }

  const row = await getProjectById(params.id);
  if (!row) {
    return fail({ code: "NOT_FOUND", message: "프로젝트를 찾을 수 없습니다." }, 404);
  }
  return ok(row);
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const gate = await requireProjectAccess(params.id, "MANAGER");
  if (!gate.ok) {
    return gate.response;
  }

  const body = await request.json();
  const row = await updateProject(params.id, body);
  return ok(row);
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const gate = await requireApiRole("ADMIN");
  if (!gate.ok) {
    return gate.response;
  }

  await deleteProject(params.id);
  return ok({ id: params.id });
}
