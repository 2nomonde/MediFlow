import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/Card";
import type { QuickAction } from "@/config/quickActions";

interface QuickActionsProps {
  actions: QuickAction[];
}

/**
 * Role-specific quick action links. Each one navigates to a real,
 * already-protected route (see config/quickActions.ts) — currently every
 * destination is the ComingSoon placeholder for that module, so clicking
 * through is honest about what exists today rather than simulating a
 * workflow that isn't built.
 */
export function QuickActions({ actions }: QuickActionsProps) {
  if (actions.length === 0) return null;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {actions.map((action) => {
        const Icon = action.icon;
        return (
          <Link key={`${action.path}-${action.label}`} to={action.path}>
            <Card className="group flex h-full items-start gap-3 p-4 transition-colors hover:border-brand-300 hover:bg-brand-50/40">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 group-hover:bg-brand-100">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-navy-900">{action.label}</p>
                <p className="mt-0.5 text-sm text-slate-500">{action.description}</p>
              </div>
              <ArrowRight
                className="mt-1 h-4 w-4 shrink-0 text-slate-300 group-hover:text-brand-500"
                aria-hidden="true"
              />
            </Card>
          </Link>
        );
      })}
    </div>
  );
}
