import { fail } from "@/lib/api-response";

export async function POST() {
  return fail({ code: "FORBIDDEN", message: "회원가입은 관리자를 통해 진행됩니다." }, 403);
}
