import { Construction } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

interface ComingSoonProps {
  title: string;
  /** One-sentence explanation of what this module will do, from NAV_ITEMS. */
  description: string;
}

/**
 * Placeholder screen for every nav item without a built module yet
 * (Patients, Queue, Triage, etc.). States plainly what the module is for
 * and that it isn't built — never implies functionality that doesn't
 * exist, per the Phase 6 academic-honesty requirement.
 */
export function ComingSoon({ title, description }: ComingSoonProps) {
  return (
    <>
      <PageHeader
        title={title}
        breadcrumbs={[{ label: "Dashboard", path: "/dashboard" }, { label: title }]}
      />
      <Card className="flex flex-col items-center justify-center gap-4 px-6 py-20 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-50">
          <Construction className="h-6 w-6 text-brand-600" aria-hidden="true" />
        </div>
        <div className="max-w-md space-y-2">
          <p className="font-medium text-navy-900">{title}</p>
          <p className="text-sm text-slate-500">{description}</p>
        </div>
        <Badge tone="warning">Coming in a later phase</Badge>
      </Card>
    </>
  );
}
