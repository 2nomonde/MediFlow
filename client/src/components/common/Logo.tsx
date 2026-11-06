import { Activity } from "lucide-react";
import { cn } from "@/utils/cn";

interface LogoProps {
  showSubtitle?: boolean;
  className?: string;
}

/**
 * Text-based MediFlow brand mark — no logo asset exists for this project,
 * per the Phase 5 brief, so this is the canonical treatment reused
 * everywhere the brand appears (sidebar, login page, etc.).
 */
export function Logo({ showSubtitle = false, className }: LogoProps) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-600">
        <Activity className="h-5 w-5 text-white" aria-hidden="true" />
      </div>
      <div className="leading-tight">
        <p className="font-display text-lg font-bold text-navy-900">MediFlow</p>
        {showSubtitle && (
          <p className="text-xs text-slate-500">Mtubatuba Intelligent Patient Queue Management</p>
        )}
      </div>
    </div>
  );
}
