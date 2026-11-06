import { Users, CalendarClock, ListOrdered, Clock, AlertTriangle, Activity } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { RoleBadge } from "@/components/common/RoleBadge";
import { QuickActions } from "@/components/common/QuickActions";
import { QUICK_ACTIONS } from "@/config/quickActions";
import type { UserRole } from "@/types/auth";

interface DashboardCardConfig {
  label: string;
  icon: typeof Users;
  tone: "brand" | "success" | "warning" | "danger" | "neutral";
}

/**
 * Which stat cards each role sees. Every card shows "No live data yet" —
 * never a fabricated number — until a later phase wires it to a real
 * API endpoint. This is the shape future phases fill in, not a claim
 * that the data exists today.
 */
const ROLE_CARDS: Record<UserRole, DashboardCardConfig[]> = {
  ADMIN: [
    { label: "Patients registered", icon: Users, tone: "brand" },
    { label: "Appointments today", icon: CalendarClock, tone: "brand" },
    { label: "Patients waiting", icon: ListOrdered, tone: "warning" },
    { label: "System alerts", icon: AlertTriangle, tone: "danger" },
  ],
  RECEPTIONIST: [
    { label: "Appointments today", icon: CalendarClock, tone: "brand" },
    { label: "Patients waiting", icon: ListOrdered, tone: "warning" },
    { label: "Checked in today", icon: Users, tone: "success" },
  ],
  NURSE: [
    { label: "Patients waiting", icon: ListOrdered, tone: "warning" },
    { label: "Awaiting triage", icon: Clock, tone: "brand" },
    { label: "Emergency cases", icon: AlertTriangle, tone: "danger" },
  ],
  DOCTOR: [
    { label: "Patients waiting", icon: ListOrdered, tone: "warning" },
    { label: "Consultations today", icon: Activity, tone: "brand" },
    { label: "Emergency cases", icon: AlertTriangle, tone: "danger" },
  ],
  PHARMACIST: [
    { label: "Pending prescriptions", icon: ListOrdered, tone: "warning" },
    { label: "Dispensed today", icon: Activity, tone: "success" },
  ],
};

const ROLE_DASHBOARD_DESCRIPTION: Record<UserRole, string> = {
  ADMIN: "System-wide overview, administration, and reporting.",
  RECEPTIONIST: "Today's registrations, appointments, and queue.",
  NURSE: "Triage and the current patient queue.",
  DOCTOR: "Your consultation queue and patient workflow.",
  PHARMACIST: "Prescriptions awaiting dispensing.",
};

function formatToday(): string {
  return new Date().toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function DashboardPage() {
  const { user } = useAuth();
  if (!user) return null;

  const cards = ROLE_CARDS[user.role];
  const actions = QUICK_ACTIONS[user.role];

  return (
    <>
      <PageHeader
        title={`Welcome back, ${user.firstName}`}
        description={`${ROLE_DASHBOARD_DESCRIPTION[user.role]} · ${formatToday()}`}
      />

      <section aria-labelledby="dashboard-overview-heading" className="mb-8">
        <h2 id="dashboard-overview-heading" className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
          Overview
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((card) => (
            <StatCard
              key={card.label}
              label={card.label}
              value="No live data yet"
              icon={card.icon}
              tone={card.tone}
              isPlaceholder
            />
          ))}
        </div>
      </section>

      {actions.length > 0 && (
        <section aria-labelledby="dashboard-actions-heading" className="mb-8">
          <h2 id="dashboard-actions-heading" className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
            Quick actions
          </h2>
          <QuickActions actions={actions} />
        </section>
      )}

      <Card>
        <CardHeader className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-navy-900">Your account</h2>
          <RoleBadge role={user.role} />
        </CardHeader>
        <CardBody className="space-y-1 text-sm text-slate-600">
          <p>
            <span className="font-medium text-navy-900">
              {user.firstName} {user.lastName}
            </span>{" "}
            · {user.email}
          </p>
          <p className="text-slate-400">
            This dashboard is a foundation shell — patient, queue, and clinical data will replace
            these placeholders as each module is built in later phases.
          </p>
        </CardBody>
      </Card>
    </>
  );
}
