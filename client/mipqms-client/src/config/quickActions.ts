import type { ComponentType } from "react";
import {
  UserPlus,
  CalendarClock,
  ListOrdered,
  Stethoscope,
  ClipboardList,
  Pill,
  BarChart3,
  ShieldCheck,
  type LucideProps,
} from "lucide-react";
import type { UserRole } from "@/types/auth";

export interface QuickAction {
  label: string;
  description: string;
  /** Always an existing route (dashboard nav item) — never a fake destination. */
  path: string;
  icon: ComponentType<LucideProps>;
}

/**
 * Role-specific quick actions for the dashboard. Every path here points
 * at a real route already wired in App.tsx — currently every one of
 * those routes renders the role-gated ComingSoon placeholder, since the
 * underlying modules don't exist yet. That's intentional: clicking a
 * quick action honestly shows "coming in a later phase" rather than the
 * dashboard pretending the workflow is available.
 */
export const QUICK_ACTIONS: Record<UserRole, QuickAction[]> = {
  ADMIN: [
    {
      label: "Manage users",
      description: "Create and manage staff accounts and roles.",
      path: "/administration",
      icon: ShieldCheck,
    },
    {
      label: "View reports",
      description: "Queue performance and operational reporting.",
      path: "/reports",
      icon: BarChart3,
    },
    {
      label: "System administration",
      description: "Departments and system-wide configuration.",
      path: "/administration",
      icon: ShieldCheck,
    },
  ],
  RECEPTIONIST: [
    {
      label: "Register patient",
      description: "Add a new patient record.",
      path: "/patients/new",
      icon: UserPlus,
    },
    {
      label: "Manage appointments",
      description: "Schedule, reschedule, or cancel appointments.",
      path: "/appointments",
      icon: CalendarClock,
    },
    {
      label: "Check queue",
      description: "View who's currently waiting.",
      path: "/queue",
      icon: ListOrdered,
    },
  ],
  NURSE: [
    {
      label: "Open triage queue",
      description: "Start recording vitals and triage priority.",
      path: "/triage",
      icon: Stethoscope,
    },
    {
      label: "View waiting patients",
      description: "See the current department queue.",
      path: "/queue",
      icon: ListOrdered,
    },
  ],
  DOCTOR: [
    {
      label: "Open consultation queue",
      description: "See who's recommended next.",
      path: "/queue",
      icon: ListOrdered,
    },
    {
      label: "View consultations",
      description: "Review consultation records and notes.",
      path: "/consultations",
      icon: ClipboardList,
    },
  ],
  PHARMACIST: [
    {
      label: "View prescriptions",
      description: "See pending and dispensed prescriptions.",
      path: "/prescriptions",
      icon: Pill,
    },
  ],
};
