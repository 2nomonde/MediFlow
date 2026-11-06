import type { ComponentType } from "react";
import type { LucideProps } from "lucide-react";
import { Card } from "./Card";
import { cn } from "@/utils/cn";

type StatTone = "brand" | "success" | "warning" | "danger" | "neutral";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: ComponentType<LucideProps>;
  tone?: StatTone;
  hint?: string;
  isPlaceholder?: boolean;
}

const TONE_CLASSES: Record<StatTone, string> = {
  brand: "bg-brand-50 text-brand-600",
  success: "bg-success-50 text-success-600",
  warning: "bg-warning-50 text-warning-600",
  danger: "bg-danger-50 text-danger-600",
  neutral: "bg-slate-100 text-slate-500",
};

/**
 * Dashboard summary card. `isPlaceholder` renders the value as a smaller,
 * muted phrase (e.g. "No live data yet") instead of large numeral-style
 * text — this is a deliberate visual distinction so a placeholder can
 * never be mistaken for a real figure at a glance. Future phases wire in
 * a real number and drop the flag, which switches back to the bold
 * numeral treatment.
 */
export function StatCard({ label, value, icon: Icon, tone = "brand", hint, isPlaceholder }: StatCardProps) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p
            className={cn(
              "mt-2",
              isPlaceholder
                ? "text-sm font-medium italic text-slate-400"
                : "text-2xl font-semibold text-navy-900"
            )}
          >
            {value}
          </p>
          {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
        </div>
        <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg", TONE_CLASSES[tone])}>
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
      </div>
    </Card>
  );
}
