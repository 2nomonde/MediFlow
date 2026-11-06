import { forwardRef, useId, type InputHTMLAttributes } from "react";
import { cn } from "@/utils/cn";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, id, className, required, ...props }, ref) => {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const errorId = `${inputId}-error`;
    const hintId = `${inputId}-hint`;

    return (
      <div className="flex flex-col gap-1.5">
        <label htmlFor={inputId} className="text-sm font-medium text-slate-700">
          {label}
          {required && (
            <>
              <span className="ml-0.5 text-danger-600" aria-hidden="true">*</span>
              <span className="sr-only"> required</span>
            </>
          )}
        </label>
        <input
          ref={ref}
          id={inputId}
          required={required}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={error ? errorId : hint ? hintId : undefined}
          className={cn(
            "h-10 rounded-md border px-3 text-sm text-navy-900 placeholder:text-slate-400",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1",
            error
              ? "border-danger-400 focus-visible:ring-danger-500"
              : "border-slate-300 focus-visible:border-brand-500",
            "disabled:bg-slate-50 disabled:text-slate-400",
            className
          )}
          {...props}
        />
        {error ? (
          <p id={errorId} role="alert" className="text-sm text-danger-600">
            {error}
          </p>
        ) : hint ? (
          <p id={hintId} className="text-sm text-slate-500">
            {hint}
          </p>
        ) : null}
      </div>
    );
  }
);
Input.displayName = "Input";
