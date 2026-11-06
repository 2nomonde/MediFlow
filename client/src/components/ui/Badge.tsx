import type { HTMLAttributes } from "react";
import { cn } from "@/utils/cn";

type BadgeTone = "brand" | "success" | "warning" | "danger" | "neutral";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
}

const TONE_CLASSES: Record<BadgeTone, string> = {
  brand: "bg-brand-50 text-brand-700 border-brand-200",
  success: "bg-success-50 text-success-700 border-success-100",
  warning: "bg-warning-50 text-warning-700 border-warning-100",
  danger: "bg-danger-50 text-danger-700 border-danger-100",
  neutral: "bg-slate-100 text-slate-600 border-slate-200",
};

/**
 * Status labels always pair color with text (never color alone) — the
 * tone changes the background/text color, but the meaning comes from
 * the label content passed in as children, satisfying the "don't rely
 * on color alone" accessibility requirement by construction.
 */
export function Badge({ tone = "neutral", className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        TONE_CLASSES[tone],
        className
      )}
      {...props}
    />
  );
}
