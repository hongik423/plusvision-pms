"use client";

import { useEffect, useState } from "react";
import { useToastStore } from "@/store/toast-store";

type NotifPrefs = {
  emailStageAssigned: boolean;
  emailStageReady: boolean;
  emailPasswordReset: boolean;
  inAppAll: boolean;
};

const DEFAULT_PREFS: NotifPrefs = {
  emailStageAssigned: false,
  emailStageReady: false,
  emailPasswordReset: false,
  inAppAll: false,
};

const STORAGE_KEY = "pluspms_notif_prefs";

function loadPrefs(): NotifPrefs {
  if (typeof window === "undefined") return DEFAULT_PREFS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFS;
    return { ...DEFAULT_PREFS, ...(JSON.parse(raw) as Partial<NotifPrefs>) };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function NotificationSettingsForm() {
  const toast = useToastStore();
  const [prefs, setPrefs] = useState<NotifPrefs>(DEFAULT_PREFS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setPrefs(loadPrefs());
    setLoaded(true);
  }, []);

  function toggle(key: keyof NotifPrefs) {
    setPrefs((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    toast.success("알림 설정이 저장되었습니다.");
  }

  if (!loaded) return null;

  return (
    <div className="space-y-5">
      {/* 인앱 알림 */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-slate-700">인앱 알림</h3>
        <div className="space-y-2">
          <ToggleRow
            label="모든 인앱 알림 수신"
            description="단계 배정, 단계 전환 등 시스템 알림"
            checked={prefs.inAppAll}
            onChange={() => toggle("inAppAll")}
          />
        </div>
      </div>

      <hr className="border-slate-100" />

      {/* 이메일 알림 */}
      <div>
        <h3 className="mb-1 text-sm font-semibold text-slate-700">이메일 알림</h3>
        <p className="mb-3 text-xs text-slate-400">
          이메일 수신은 서버 SMTP 설정이 필요합니다. 이 설정은 브라우저에 저장됩니다.
        </p>
        <div className="space-y-2">
          <ToggleRow
            label="담당자 배정 알림"
            description="내가 프로젝트 단계 담당자로 지정될 때"
            checked={prefs.emailStageAssigned}
            onChange={() => toggle("emailStageAssigned")}
          />
          <ToggleRow
            label="다음 단계 시작 알림"
            description="이전 단계가 완료되어 내 담당 단계가 활성화될 때"
            checked={prefs.emailStageReady}
            onChange={() => toggle("emailStageReady")}
          />
          <ToggleRow
            label="비밀번호 관련 알림"
            description="비밀번호 재설정 요청 및 완료 알림"
            checked={prefs.emailPasswordReset}
            onChange={() => toggle("emailPasswordReset")}
          />
        </div>
      </div>

      <button
        type="button"
        onClick={save}
        className="h-11 rounded bg-blue-600 px-5 font-semibold text-white hover:bg-blue-700"
      >
        설정 저장
      </button>
    </div>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between rounded-lg border bg-white px-4 py-3 hover:bg-slate-50 transition-colors">
      <div>
        <p className="text-sm font-medium text-slate-800">{label}</p>
        <p className="text-xs text-slate-400 mt-0.5">{description}</p>
      </div>
      {/* 토글 스위치 */}
      <div className="relative ml-4 flex-shrink-0">
        <input
          type="checkbox"
          className="sr-only"
          checked={checked}
          onChange={onChange}
        />
        <div
          className={`h-6 w-11 rounded-full transition-colors ${checked ? "bg-blue-600" : "bg-slate-200"}`}
        />
        <div
          className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-5" : "translate-x-0"}`}
        />
      </div>
    </label>
  );
}
