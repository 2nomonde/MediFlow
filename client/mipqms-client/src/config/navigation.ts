import type { ComponentType } from "react";
import {
  LayoutDashboard,
  Users,
  CalendarClock,
  ListOrdered,
  Stethoscope,
  ClipboardList,
  Pill,
  BarChart3,
  Settings,
  type LucideProps,
} from "lucide-react";
import type { UserRole } from "@/types/auth";

export const ROLES: readonly UserRole[] = [
  "ADMIN",
  "RECEPTIONIST",
  "NURSE",
  "DOCTOR",
  "PHARMACIST",
] as const;

export const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: "Administrator",
  RECEPTIONIST: "Receptionist",
  NURSE: "Nurse",
  DOCTOR: "Doctor",
  PHARMACIST: "Pharmacist",
};

export interface NavItem {
  label: string;
  path: string;
  icon: ComponentType<LucideProps>;
  /** Roles allowed to see this item. This is UX only — see roleNav.ts. */
  roles: UserRole[];
  /** True once a real module exists behind this route. */
  implemented: boolean;
  /** One-sentence explanation of what this module will do, shown on its placeholder page. */
  description: string;
}

/**
 * Single source of truth for sidebar navigation. Every future phase that
 * ships a real module (patients, appointments, ...) flips its
 * `implemented` flag to true and points `path` at the real page — nothing
 * else about the navigation wiring changes.
 *
 * IMPORTANT: the `roles` arrays here are a UX convenience only. They
 * decide what a user *sees* in the sidebar, not what they're allowed to
 * do — the backend RBAC (`requireRole` on each API route) is the actual
 * security boundary, and always will be.
 *
 * Fixed in this pass: Appointments, Consultations, Prescriptions, Reports
 * and Administration were all fully routed in App.tsx to real pages, but
 * still flagged `implemented: false` here — which is why the sidebar
 * showed a lock icon on five working modules. All five are now `true`.
 * App.tsx itself is unchanged by this fix.
 */
export const NAV_ITEMS: NavItem[] = [
  {
    label: "Dashboard",
    path: "/dashboard",
    icon: LayoutDashboard,
    roles: ["ADMIN", "RECEPTIONIST", "NURSE", "DOCTOR", "PHARMACIST"],
    implemented: true,
    description: "A role-aware overview of today's clinic activity.",
  },
  {
    label: "Patients",
    path: "/patients",
    icon: Users,
    roles: ["RECEPTIONIST", "ADMIN"],
    implemented: true,
    description:
      "Patient registration, search, and profile management, with duplicate-record prevention.",
  },
  {
    label: "Appointments",
    path: "/appointments",
    icon: CalendarClock,
    roles: ["RECEPTIONIST", "ADMIN"],
    implemented: true,
    description: "Scheduling, rescheduling, and cancelling patient appointments by department and doctor.",
  },
  {
    label: "Queue",
    path: "/queue",
    icon: ListOrdered,
    roles: ["RECEPTIONIST", "NURSE", "DOCTOR", "ADMIN"],
    implemented: true,
    description:
      "Patient check-in and live queue tracking, ordered by emergency status and check-in time.",
  },
  {
    label: "Triage",
    path: "/triage",
    icon: Stethoscope,
    roles: ["NURSE", "DOCTOR", "ADMIN"],
    implemented: true,
    description: "Record and review patient triage assessments and vital signs ahead of consultation.",
  },
  {
    label: "Consultations",
    path: "/consultations",
    icon: ClipboardList,
    roles: ["DOCTOR", "ADMIN"],
    implemented: true,
    description: "Doctor consultation records, diagnoses, and clinical notes tied to each queue visit.",
  },
  {
    label: "Prescriptions",
    path: "/prescriptions",
    icon: Pill,
    roles: ["DOCTOR", "PHARMACIST", "ADMIN"],
    implemented: true,
    description: "Prescription creation by doctors and dispensing tracking by pharmacy staff.",
  },
  {
    label: "Audit Logs",
    path: "/audit-logs",
    icon: ClipboardList,
    roles: ["ADMIN"],
    implemented: true,
    description: "Review system activity and audit records.",
  },
  {
    label: "Reports",
    path: "/reports",
    icon: BarChart3,
    roles: ["ADMIN"],
    implemented: true,
    description: "Queue performance, waiting-time, and departmental reporting drawn from real system data.",
  },
  {
    label: "Administration",
    path: "/administration",
    icon: Settings,
    roles: ["ADMIN"],
    implemented: true,
    description: "Staff accounts, departments, and system-wide configuration, including queue priority weights.",
  },
];