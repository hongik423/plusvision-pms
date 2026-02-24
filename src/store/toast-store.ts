import { create } from "zustand";

export type ToastType = "success" | "error" | "warning" | "info";

export type Toast = {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
};

type ToastStore = {
  toasts: Toast[];
  add: (toast: Omit<Toast, "id">) => void;
  remove: (id: string) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  warning: (message: string) => void;
  info: (message: string) => void;
};

let counter = 0;

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],

  add: (toast) => {
    const id = `toast-${++counter}`;
    const duration = toast.duration ?? 4000;
    set((state) => ({ toasts: [...state.toasts, { ...toast, id }] }));
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
    }, duration);
  },

  remove: (id) =>
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),

  success: (message) =>
    useToastStore.getState().add({ type: "success", message }),

  error: (message) =>
    useToastStore.getState().add({ type: "error", message, duration: 6000 }),

  warning: (message) =>
    useToastStore.getState().add({ type: "warning", message }),

  info: (message) =>
    useToastStore.getState().add({ type: "info", message }),
}));
