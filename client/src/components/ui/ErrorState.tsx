import { AlertTriangle } from "lucide-react";
import { Button } from "./Button";

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
}

/**
 * Reusable error display. `message` must always be a clear, user-facing
 * sentence (see services/api.ts's getErrorMessage) — never a raw
 * exception, stack trace, or Axios error object passed in directly.
 */
export function ErrorState({ title = "Something went wrong", message, onRetry }: ErrorStateProps) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center"
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-danger-50">
        <AlertTriangle className="h-6 w-6 text-danger-600" aria-hidden="true" />
      </div>
      <div className="space-y-1">
        <p className="font-medium text-navy-900">{title}</p>
        <p className="text-sm text-slate-500">{message}</p>
      </div>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}
