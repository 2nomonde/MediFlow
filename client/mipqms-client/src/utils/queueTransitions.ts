import type { QueueStatus } from "@/types/queue";
import type { UserRole } from "@/types/auth";

/**
 * Mirrors ALLOWED_TRANSITIONS in the backend's queue.service.ts exactly,
 * purely so the UI can show/hide the right action buttons. The backend
 * re-validates every transition independently and is the actual
 * authority — this file existing out of sync would only produce a
 * confusing UI, never a security gap.
 */
const ALLOWED_TRANSITIONS: Record<QueueStatus, QueueStatus[]> = {
  WAITING: ["CALLED", "CANCELLED", "NO_SHOW"],
  CALLED: ["IN_CONSULTATION", "CANCELLED", "NO_SHOW"],
  IN_CONSULTATION: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
  NO_SHOW: [],
};

/** Mirrors assertRoleCanSetStatus in the backend. */
function roleCanSetStatus(role: UserRole, target: QueueStatus): boolean {
  if (role === "RECEPTIONIST") {
    return target === "CANCELLED" || target === "NO_SHOW";
  }
  return role === "NURSE" || role === "DOCTOR" || role === "ADMIN";
}

export interface QueueAction {
  label: string;
  targetStatus: QueueStatus;
  /** ConfirmDialog is used for these — losing a patient from the active queue, not routine progression. */
  needsConfirmation: boolean;
}

const ACTION_LABELS: Record<QueueStatus, string> = {
  WAITING: "Return to waiting", // never actually offered — WAITING has no valid incoming transition
  CALLED: "Call",
  IN_CONSULTATION: "Start consultation",
  COMPLETED: "Complete",
  CANCELLED: "Cancel",
  NO_SHOW: "Mark no-show",
};

export function getAvailableActions(currentStatus: QueueStatus, role: UserRole): QueueAction[] {
  return ALLOWED_TRANSITIONS[currentStatus]
    .filter((target) => roleCanSetStatus(role, target))
    .map((target) => ({
      label: ACTION_LABELS[target],
      targetStatus: target,
      needsConfirmation: target === "CANCELLED" || target === "NO_SHOW",
    }));
}
