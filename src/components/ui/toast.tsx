"use client";

import { useToastStore, type ToastType } from "@/store/toast-store";

const ICON: Record<ToastType, string> = {
  success: "✅",
  error: "❌",
  warning: "⚠️",
  info: "ℹ️",
};

const COLOR: Record<ToastType, string> = {
  success: "bg-green-50 border-green-300 text-green-900",
  error: "bg-red-50 border-red-300 text-red-900",
  warning: "bg-amber-50 border-amber-300 text-amber-900",
  info: "bg-blue-50 border-blue-300 text-blue-900",
};

export function ToastContainer() {
  const { toasts, remove } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2 max-w-sm w-full pointer-events-none"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`pointer-events-auto flex items-start gap-3 rounded-xl border px-4 py-3 shadow-lg animate-in slide-in-from-right-full ${COLOR[toast.type]}`}
        >
          <span className="text-lg flex-shrink-0 mt-0.5">{ICON[toast.type]}</span>
          <p className="flex-1 text-sm font-medium leading-snug">{toast.message}</p>
          <button
            type="button"
            onClick={() => remove(toast.id)}
            className="flex-shrink-0 opacity-50 hover:opacity-100 text-lg leading-none"
            aria-label="닫기"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
