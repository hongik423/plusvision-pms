import { requireSession } from "@/lib/rbac";
import { ROLE_LABELS } from "@/lib/constants";
import type { Role } from "@prisma/client";
import { ProfileForm } from "./profile-form";
import { PasswordForm } from "./password-form";
import { NotificationSettingsForm } from "./notification-settings-form";

export default async function SettingsPage() {
  const session = await requireSession();
  if (!session?.user) return null;

  const { id, name, email, role } = session.user as {
    id: string;
    name: string;
    email: string;
    role: Role;
  };

  return (
    <section className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-3xl font-bold">설정</h1>

      {/* 계정 정보 카드 */}
      <div className="rounded-xl border bg-white p-5">
        <h2 className="mb-4 text-xl font-semibold">계정 정보</h2>
        <dl className="space-y-2 text-sm">
          <div className="flex gap-3">
            <dt className="w-20 font-semibold text-slate-500">이메일</dt>
            <dd>{email}</dd>
          </div>
          <div className="flex gap-3">
            <dt className="w-20 font-semibold text-slate-500">역할</dt>
            <dd>
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">
                {ROLE_LABELS[role] ?? role}
              </span>
            </dd>
          </div>
          <div className="flex gap-3">
            <dt className="w-20 font-semibold text-slate-500">사용자 ID</dt>
            <dd className="font-mono text-xs text-slate-400">{id}</dd>
          </div>
        </dl>
      </div>

      {/* 프로필 수정 */}
      <div className="rounded-xl border bg-white p-5">
        <h2 className="mb-4 text-xl font-semibold">프로필 수정</h2>
        <ProfileForm initialName={name ?? ""} />
      </div>

      {/* 비밀번호 변경 */}
      <div className="rounded-xl border bg-white p-5">
        <h2 className="mb-4 text-xl font-semibold">비밀번호 변경</h2>
        <PasswordForm />
      </div>

      {/* 알림 수신 설정 */}
      <div className="rounded-xl border bg-white p-5">
        <h2 className="mb-1 text-xl font-semibold">알림 수신 설정</h2>
        <p className="mb-4 text-sm text-slate-400">단계 배정, 완료 알림 등의 수신 여부를 설정합니다.</p>
        <NotificationSettingsForm />
      </div>
    </section>
  );
}
