import type { ComponentType, ReactNode } from "react";
import type { LucideProps } from "lucide-react";
import { Inbox } from "lucide-react";

interface EmptyStateProps {
  icon?: ComponentType<LucideProps>;
  title: string;
  description?: string;
  action?: ReactNode;
}

/** Generic "nothing here" state — reused by every future module's list/table views. */
export function EmptyState({ icon: Icon = Inbox, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
        <Icon className="h-6 w-6 text-slate-400" aria-hidden="true" />
      </div>
      <div className="space-y-1">
        <p className="font-medium text-navy-900">{title}</p>
        {description && <p className="text-sm text-slate-500">{description}</p>}
      </div>
      {action}
    </div>
  );
}
