import { Badge } from "@/components/ui/Badge";
import type { AuditAction } from "@/types/auditLog";

const LABELS: Record<AuditAction, string> = {
  CHECK_IN: "Check-in",
  TRIAGE_RECORDED: "Triage recorded",
  PRIORITY_RECALCULATED: "Priority recalculated",
  PRIORITY_OVERRIDE: "Priority override",
  PATIENT_CALLED: "Patient called",
  CONSULTATION_STARTED: "Consultation started",
  CONSULTATION_COMPLETED: "Consultation completed",
  QUEUE_CANCELLED: "Queue cancelled",
  NO_SHOW_MARKED: "No-show marked",
  PRESCRIPTION_CREATED: "Prescription created",
  PRESCRIPTION_DISPENSED: "Prescription dispensed",
  USER_LOGIN: "User login",
  CONFIG_UPDATED: "Configuration updated",
};

/** Tone is purely visual grouping (override/dispense = warning-adjacent, creation = brand, config = neutral) — never implies anything about severity. */
const TONES: Record<AuditAction, "brand" | "success" | "warning" | "neutral"> = {
  CHECK_IN: "brand",
  TRIAGE_RECORDED: "brand",
  PRIORITY_RECALCULATED: "neutral",
  PRIORITY_OVERRIDE: "warning",
  PATIENT_CALLED: "brand",
  CONSULTATION_STARTED: "brand",
  CONSULTATION_COMPLETED: "success",
  QUEUE_CANCELLED: "neutral",
  NO_SHOW_MARKED: "neutral",
  PRESCRIPTION_CREATED: "brand",
  PRESCRIPTION_DISPENSED: "success",
  USER_LOGIN: "neutral",
  CONFIG_UPDATED: "warning",
};

export function AuditActionBadge({ action }: { action: AuditAction }) {
  return <Badge tone={TONES[action]}>{LABELS[action]}</Badge>;
}
