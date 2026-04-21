"use client";

import { useState } from "react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ROLE_LABELS } from "@/lib/constants";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";

const EMPTY_FORM = { email: "", name: "", password: "", role: "" as UserRow["role"] | "", department: "", phone: "" };

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "MANAGER" | "USER" | "VIEWER";
  department: string | null;
  phone: string | null;
  isActive: boolean;
};

type Props = {
  initialUsers: UserRow[];
};

const ROLES: Array<UserRow["role"]> = ["ADMIN", "MANAGER", "USER", "VIEWER"];

const ROLE_COLOR: Record<UserRow["role"], string> = {
  ADMIN: "bg-red-100 text-red-700",
  MANAGER: "bg-blue-100 text-blue-700",
  USER: "bg-slate-100 text-slate-700",
  VIEWER: "bg-gray-100 text-gray-600",
};

function formatPhone(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}

export function UserManagementPanel({ initialUsers }: Props) {
  const [users, setUsers] = useState(initialUsers);
  const [loadingUserId, setLoadingUserId] = useState<string | null>(null);
  const [resetResult, setResetResult] = useState<{ userId: string; password: string } | null>(null);
  const [phoneInputs, setPhoneInputs] = useState<Record<string, string>>(
    () => Object.fromEntries(initialUsers.map((u) => [u.id, u.phone ?? ""]))
  );
  const [form, setForm] = useState(EMPTY_FORM);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [editForm, setEditForm] = useState({ name: "", email: "", phone: "", department: "", role: "USER" as UserRow["role"] });
  const [editSaving, setEditSaving] = useState(false);

  async function updateUser(userId: string, body: Record<string, unknown>) {
    setLoadingUserId(userId);
    const response = await fetch(`/api/v1/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = await response.json();
    setLoadingUserId(null);
    if (!payload.success) {
      alert(payload.error?.message ?? "사용자 업데이트에 실패했습니다.");
      return;
    }
    setUsers((prev) => prev.map((user) => (user.id === userId ? payload.data : user)));
  }

  async function updateRole(userId: string, role: UserRow["role"]) {
    setLoadingUserId(userId);
    const response = await fetch(`/api/v1/users/${userId}/role`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    const payload = await response.json();
    setLoadingUserId(null);
    if (!payload.success) {
      alert(payload.error?.message ?? "권한 변경에 실패했습니다.");
      return;
    }
    setUsers((prev) => prev.map((user) => (user.id === userId ? payload.data : user)));
  }

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setCreateError(null);
    const res = await fetch("/api/v1/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, phone: form.phone || undefined, department: form.department || undefined }),
    });
    const payload = await res.json();
    setCreating(false);
    if (!payload.success) {
      setCreateError(payload.error?.message ?? "사용자 생성에 실패했습니다.");
      return;
    }
    setUsers((prev) => [payload.data, ...prev]);
    setPhoneInputs((prev) => ({ ...prev, [payload.data.id]: payload.data.phone ?? "" }));
    setForm(EMPTY_FORM);
  }

  function openEdit(user: UserRow) {
    setEditingUser(user);
    setEditForm({ name: user.name, email: user.email, phone: user.phone ?? "", department: user.department ?? "", role: user.role });
  }

  async function saveEdit() {
    if (!editingUser) return;
    setEditSaving(true);
    const tasks: Promise<void>[] = [
      updateUser(editingUser.id, {
        name: editForm.name,
        email: editForm.email,
        phone: editForm.phone || null,
        department: editForm.department || null,
      }),
    ];
    if (editForm.role !== editingUser.role) {
      tasks.push(updateRole(editingUser.id, editForm.role));
    }
    await Promise.all(tasks);
    setPhoneInputs((prev) => ({ ...prev, [editingUser.id]: editForm.phone }));
    setEditSaving(false);
    setEditingUser(null);
  }

  async function savePhone(userId: string) {
    const phone = phoneInputs[userId]?.trim() || null;
    await updateUser(userId, { phone });
  }

  async function resetPassword(userId: string) {
    setLoadingUserId(userId);
    const response = await fetch(`/api/v1/users/${userId}/reset-password`, { method: "POST" });
    const payload = await response.json();
    setLoadingUserId(null);
    if (!payload.success) {
      alert(payload.error?.message ?? "비밀번호 재설정에 실패했습니다.");
      return;
    }
    setResetResult({ userId, password: payload.data.temporaryPassword });
  }

  return (
    <section className="space-y-4">
      <h1 className="text-3xl font-bold">사용자 관리</h1>

      {/* 사용자 생성 폼 */}
      <form onSubmit={(e) => void createUser(e)} className="grid gap-2 md:grid-cols-6">
        <input
          className="h-11 rounded border px-3 text-sm"
          placeholder="이름 *"
          value={form.name}
          onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
          required
        />
        <input
          className="h-11 rounded border px-3 text-sm"
          placeholder="이메일 *"
          type="email"
          value={form.email}
          onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
          required
        />
        <input
          className="h-11 rounded border px-3 text-sm"
          placeholder="비밀번호 * (8자 이상)"
          type="password"
          value={form.password}
          onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
          required
        />
        <input
          className="h-11 rounded border px-3 text-sm"
          placeholder="전화번호 *"
          value={form.phone}
          onChange={(e) => setForm((p) => ({ ...p, phone: formatPhone(e.target.value) }))}
          required
        />
        <select
          className="h-11 rounded border px-3 text-sm"
          value={form.role}
          required
          onChange={(e) => setForm((p) => ({ ...p, role: e.target.value as UserRow["role"] }))}
        >
          <option value="" disabled>권한설정 *</option>
          {ROLES.map((role) => (
            <option key={role} value={role}>{ROLE_LABELS[role]}</option>
          ))}
        </select>
        <button
          type="submit"
          disabled={creating}
          className="h-11 rounded bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {creating ? "생성 중..." : "사용자 추가"}
        </button>
        {createError && <p className="md:col-span-6 text-xs text-red-600">{createError}</p>}
      </form>

      {/* 임시 비밀번호 표시 패널 */}
      {resetResult ? (
        <div className="flex items-start justify-between rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div>
            <p className="font-semibold text-amber-800">임시 비밀번호 발급 완료</p>
            <p className="mt-1 text-sm text-amber-700">
              사용자에게 아래 임시 비밀번호를 전달하고 즉시 변경하도록 안내해 주세요.
            </p>
            <p className="mt-2 font-mono text-lg font-bold text-amber-900 rounded bg-amber-100 px-3 py-1 inline-block">
              {resetResult.password}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setResetResult(null)}
            className="ml-4 text-amber-500 hover:text-amber-700 text-xl font-bold"
          >
            ✕
          </button>
        </div>
      ) : null}

      <div className="rounded-xl border bg-white overflow-hidden">
        {/* 데스크탑 테이블 */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-slate-50">
              <tr>
                <th className="p-3 font-semibold">이름</th>
                <th className="p-3 font-semibold">이메일</th>
                <th className="p-3 font-semibold">전화번호</th>
                <th className="p-3 font-semibold">권한</th>
                <th className="p-3 font-semibold">부서</th>
                <th className="p-3 font-semibold">상태</th>
                <th className="p-3 font-semibold w-px">작업</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b hover:bg-slate-50 transition-colors">
                  <td className="p-3 font-medium">{user.name}</td>
                  <td className="p-3 text-slate-600">{user.email}</td>
                  <td className="p-3">
                    <input
                      type="text"
                      value={phoneInputs[user.id] ?? ""}
                      onChange={(e) =>
                        setPhoneInputs((prev) => ({
                          ...prev,
                          [user.id]: formatPhone(e.target.value),
                        }))
                      }
                      onBlur={() => void savePhone(user.id)}
                      placeholder="010-0000-0000"
                      className="h-8 w-36 bg-transparent px-2 text-xs focus:outline-none focus:border-b focus:border-blue-500"
                    />
                  </td>
                  <td className="p-3">
                    <select
                      className="h-9 rounded border px-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={user.role}
                      aria-label={`${user.name} 권한`}
                      disabled={loadingUserId === user.id}
                      onChange={(e) => void updateRole(user.id, e.target.value as UserRow["role"])}
                    >
                      {ROLES.map((role) => (
                        <option key={`${user.id}-${role}`} value={role}>
                          {ROLE_LABELS[role]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="p-3 text-slate-600">{user.department ?? "-"}</td>
                  <td className="p-3">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        user.isActive
                          ? "bg-green-100 text-green-700"
                          : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {user.isActive ? "활성" : "승인 대기"}
                    </span>
                  </td>
                  <td className="p-3 w-px">
                    <div className="flex gap-2 whitespace-nowrap">
                      {!user.isActive ? (
                        <ConfirmDialog
                          trigger={
                            <button
                              type="button"
                              disabled={loadingUserId === user.id}
                              className="h-9 rounded bg-blue-600 px-3 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                            >
                              승인
                            </button>
                          }
                          title="사용자 승인"
                          description={`${user.name}(${user.email}) 계정을 활성화합니다.`}
                          confirmLabel="승인"
                          onConfirm={() => updateUser(user.id, { isActive: true })}
                        />
                      ) : (
                        <ConfirmDialog
                          trigger={
                            <button
                              type="button"
                              disabled={loadingUserId === user.id}
                              className="h-9 rounded border px-3 text-xs font-medium hover:bg-slate-50 disabled:opacity-60"
                            >
                              비활성화
                            </button>
                          }
                          title="사용자 비활성화"
                          description={`${user.name} 계정을 비활성화합니다. 해당 사용자는 로그인할 수 없게 됩니다.`}
                          confirmLabel="비활성화"
                          variant="danger"
                          onConfirm={() => updateUser(user.id, { isActive: false })}
                        />
                      )}
                      <ConfirmDialog
                        trigger={
                          <button
                            type="button"
                            disabled={loadingUserId === user.id}
                            className="h-9 rounded border px-3 text-xs font-medium text-amber-700 border-amber-200 hover:bg-amber-50 disabled:opacity-60"
                          >
                            비밀번호 초기화
                          </button>
                        }
                        title="비밀번호 초기화"
                        description={`${user.name} 계정의 비밀번호를 임시 비밀번호로 초기화합니다.`}
                        confirmLabel="초기화"
                        variant="danger"
                        onConfirm={() => resetPassword(user.id)}
                      />
                      <button
                        type="button"
                        onClick={() => openEdit(user)}
                        className="h-9 rounded border px-3 text-xs font-medium hover:bg-slate-50"
                      >
                        수정
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 모바일 카드 */}
        <div className="md:hidden divide-y">
          {users.map((user) => (
            <div key={user.id} className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">{user.name}</p>
                  <p className="text-sm text-slate-500">{user.email}</p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    user.isActive ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                  }`}
                >
                  {user.isActive ? "활성" : "승인 대기"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`rounded px-2 py-0.5 text-xs font-semibold ${ROLE_COLOR[user.role]}`}>
                  {ROLE_LABELS[user.role]}
                </span>
                {user.department ? (
                  <span className="text-xs text-slate-400">{user.department}</span>
                ) : null}
              </div>
              <input
                type="text"
                value={phoneInputs[user.id] ?? ""}
                onChange={(e) =>
                  setPhoneInputs((prev) => ({
                    ...prev,
                    [user.id]: formatPhone(e.target.value),
                  }))
                }
                onBlur={() => void savePhone(user.id)}
                placeholder="010-0000-0000"
                className="h-9 w-full bg-transparent px-3 text-sm focus:outline-none focus:border-b focus:border-blue-500"
              />
              <div className="flex flex-wrap gap-2">
                <ConfirmDialog
                  trigger={
                    <button
                      type="button"
                      disabled={loadingUserId === user.id}
                      className="h-9 rounded border px-3 text-xs font-medium disabled:opacity-60"
                    >
                      {user.isActive ? "비활성화" : "승인"}
                    </button>
                  }
                  title={user.isActive ? "사용자 비활성화" : "사용자 승인"}
                  description={`${user.name} 계정을 ${user.isActive ? "비활성화" : "활성화"}합니다.`}
                  confirmLabel={user.isActive ? "비활성화" : "승인"}
                  variant={user.isActive ? "danger" : "default"}
                  onConfirm={() => updateUser(user.id, { isActive: !user.isActive })}
                />
                <ConfirmDialog
                  trigger={
                    <button
                      type="button"
                      disabled={loadingUserId === user.id}
                      className="h-9 rounded border px-3 text-xs font-medium text-amber-700 border-amber-200 disabled:opacity-60"
                    >
                      비밀번호 초기화
                    </button>
                  }
                  title="비밀번호 초기화"
                  description={`${user.name} 계정의 비밀번호를 임시 비밀번호로 초기화합니다.`}
                  confirmLabel="초기화"
                  variant="danger"
                  onConfirm={() => resetPassword(user.id)}
                />
                <button
                  type="button"
                  onClick={() => openEdit(user)}
                  className="h-9 rounded border px-3 text-xs font-medium hover:bg-slate-50"
                >
                  수정
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
      {/* 수정 모달 */}
      <Dialog open={!!editingUser} onOpenChange={(open) => { if (!open) setEditingUser(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>사용자 수정</DialogTitle>
            <DialogDescription>{editingUser?.email}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-sm font-medium">이름</label>
              <input
                className="w-full rounded border px-3 py-2 text-sm"
                value={editForm.name}
                onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">이메일</label>
              <input
                className="w-full rounded border px-3 py-2 text-sm"
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm((p) => ({ ...p, email: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">전화번호</label>
              <input
                className="w-full rounded border px-3 py-2 text-sm"
                value={editForm.phone}
                onChange={(e) => setEditForm((p) => ({ ...p, phone: formatPhone(e.target.value) }))}
                placeholder="010-0000-0000"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">권한</label>
              <select
                className="w-full rounded border px-3 py-2 text-sm"
                value={editForm.role}
                onChange={(e) => setEditForm((p) => ({ ...p, role: e.target.value as UserRow["role"] }))}
              >
                {ROLES.map((role) => (
                  <option key={role} value={role}>{ROLE_LABELS[role]}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">부서</label>
              <input
                className="w-full rounded border px-3 py-2 text-sm"
                value={editForm.department}
                onChange={(e) => setEditForm((p) => ({ ...p, department: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <button
              type="button"
              className="rounded border px-4 py-2 text-sm"
              onClick={() => setEditingUser(null)}
            >
              취소
            </button>
            <button
              type="button"
              className="rounded bg-blue-600 px-4 py-2 text-sm text-white disabled:opacity-60"
              onClick={() => void saveEdit()}
              disabled={editSaving}
            >
              {editSaving ? "저장 중..." : "저장"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
