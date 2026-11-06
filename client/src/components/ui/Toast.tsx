import { CheckCircle2, AlertTriangle, XCircle, Info, X } from "lucide-react";
import { useToast } from "@/hooks/useToast";
import type { ToastTone } from "@/context/ToastContext";
import { cn } from "@/utils/cn";

const TONE_CONFIG: Record<ToastTone, { icon: typeof Info; classes: string }> = {
  success: { icon: CheckCircle2, classes: "bg-success-50 text-success-700 border-success-100" },
  warning: { icon: AlertTriangle, classes: "bg-warning-50 text-warning-700 border-warning-100" },
  danger: { icon: XCircle, classes: "bg-danger-50 text-danger-700 border-danger-100" },
  info: { icon: Info, classes: "bg-brand-50 text-brand-700 border-brand-200" },
};

export function ToastViewport() {
  const { toasts, dismissToast } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed bottom-4 right-4 z-50 flex w-full max-w-sm flex-col gap-2"
      role="region"
      aria-label="Notifications"
    >
      {toasts.map((toast) => {
        const { icon: Icon, classes } = TONE_CONFIG[toast.tone];
        return (
          <div
            key={toast.id}
            role="status"
            className={cn(
              "flex items-start gap-2 rounded-card border px-4 py-3 text-sm shadow-panel",
              classes
            )}
          >
            <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <p className="flex-1">{toast.message}</p>
            <button
              type="button"
              onClick={() => dismissToast(toast.id)}
              aria-label="Dismiss notification"
              className="rounded p-0.5 hover:bg-black/5"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
