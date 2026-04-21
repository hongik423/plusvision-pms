import { ok, fail } from "@/lib/api-response";
import { requireApiRole } from "@/lib/api-auth";
import { listUsers } from "@/services/user-service";
import { prisma } from "@/lib/prisma";
import { hash } from "bcryptjs";
import { generatePlusPmsId } from "@/lib/id";
import { z } from "zod";

export async function GET() {
  const gate = await requireApiRole("ADMIN");
  if (!gate.ok) return gate.response;
  return ok(await listUsers());
}

const createUserSchema = z.object({
  email: z.string().email("유효한 이메일을 입력해 주세요."),
  name: z.string().min(1, "이름은 필수입니다."),
  password: z.string().min(8, "비밀번호는 8자 이상이어야 합니다."),
  role: z.enum(["ADMIN", "MANAGER", "USER", "VIEWER"]).default("USER"),
  department: z.string().optional(),
  phone: z.string().min(1, "전화번호는 필수입니다."),
});

export async function POST(request: Request) {
  const gate = await requireApiRole("ADMIN");
  if (!gate.ok) return gate.response;

  const body = await request.json();
  const parsed = createUserSchema.safeParse(body);
  if (!parsed.success) {
    return fail({ code: "VALIDATION_ERROR", message: "입력값을 확인해 주세요.", details: parsed.error.flatten() }, 400);
  }

  const exists = await prisma.user.findUnique({ where: { email: parsed.data.email }, select: { id: true } });
  if (exists) {
    return fail({ code: "DUPLICATE_ENTRY", message: "이미 사용 중인 이메일입니다." }, 409);
  }

  const encrypted = await hash(parsed.data.password, 12);
  const user = await prisma.user.create({
    data: {
      id: generatePlusPmsId("user"),
      email: parsed.data.email,
      name: parsed.data.name,
      password: encrypted,
      role: parsed.data.role,
      isActive: true,
      department: parsed.data.department,
      phone: parsed.data.phone,
    },
  });

  return ok(user, { status: 201 });
}
