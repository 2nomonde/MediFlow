import { forwardRef, useId, type SelectHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/utils/cn";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  error?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, id, className, children, required, ...props }, ref) => {
    const generatedId = useId();
    const selectId = id ?? generatedId;
    const errorId = `${selectId}-error`;

    return (
      <div className="flex flex-col gap-1.5">
        <label htmlFor={selectId} className="text-sm font-medium text-slate-700">
          {label}
          {required && (
            <>
              <span className="ml-0.5 text-danger-600" aria-hidden="true">*</span>
              <span className="sr-only"> required</span>
            </>
          )}
        </label>
        <div className="relative">
          <select
            ref={ref}
            id={selectId}
            required={required}
            aria-invalid={Boolean(error) || undefined}
            aria-describedby={error ? errorId : undefined}
            className={cn(
              "h-10 w-full appearance-none rounded-md border bg-white px-3 pr-9 text-sm text-navy-900",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1",
              error ? "border-danger-400" : "border-slate-300 focus-visible:border-brand-500",
              "disabled:bg-slate-50 disabled:text-slate-400",
              className
            )}
            {...props}
          >
            {children}
          </select>
          <ChevronDown
            className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          />
        </div>
        {error && (
          <p id={errorId} role="alert" className="text-sm text-danger-600">
            {error}
          </p>
        )}
      </div>
    );
  }
);
Select.displayName = "Select";
