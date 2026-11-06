import { createContext, useCallback, useState, type ReactNode } from "react";

export type ToastTone = "success" | "warning" | "danger" | "info";

export interface ToastMessage {
  id: string;
  tone: ToastTone;
  message: string;
}

interface ToastContextValue {
  toasts: ToastMessage[];
  showToast: (tone: ToastTone, message: string) => void;
  dismissToast: (id: string) => void;
}

// eslint-disable-next-line react-refresh/only-export-components
export const ToastContext = createContext<ToastContextValue | undefined>(undefined);

const AUTO_DISMISS_MS = 5000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    (tone: ToastTone, message: string) => {
      const id = crypto.randomUUID();
      setToasts((current) => [...current, { id, tone, message }]);
      setTimeout(() => dismissToast(id), AUTO_DISMISS_MS);
    },
    [dismissToast]
  );

  return (
    <ToastContext.Provider value={{ toasts, showToast, dismissToast }}>
      {children}
    </ToastContext.Provider>
  );
}
