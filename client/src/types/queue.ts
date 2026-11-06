import type { Gender } from "./patient";

/** Mirrors the Prisma `QueueStatus` enum exactly (Phase 2 schema). */
export type QueueStatus = "WAITING" | "CALLED" | "IN_CONSULTATION" | "COMPLETED" | "CANCELLED" | "NO_SHOW";

/** Mirrors the Prisma `TriagePriority` enum (see types/triage.ts). */
export type TriagePriority = "EMERGENCY" | "URGENT" | "HIGH" | "NORMAL" | "LOW";

export interface Department {
  id: string;
  name: string;
}

export interface QueuePatientSummary {
  id: string;
  patientNumber: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: Gender;
}

/** Matches the backend's PriorityBreakdown exactly — every field is one term of the mandatory formula. */
export interface PriorityBreakdown {
  triageContribution: number;
  emergencyContribution: number;
  waitingTimeContribution: number;
  appointmentContribution: number;
  vulnerabilityContribution: number;
  calculatedScore: number;
}

export interface PriorityOverriddenBy {
  id: string;
  firstName: string;
  lastName: string;
}

/**
 * Mirrors the Prisma `QueueEntry` model, plus the fields the backend
 * computes/attaches: `queueNumber`/`waitingMinutes` (Phase 9) and the
 * full Phase 11 priority picture. `priorityScore` here is always the
 * live-calculated figure the backend returns, not a stale cached value.
 */
export interface QueueEntry {
  id: string;
  patientId: string;
  patient: QueuePatientSummary;
  departmentId: string;
  department: Department;
  assignedDoctorId: string | null;
  status: QueueStatus;
  isEmergency: boolean;
  priorityScore: number | null;
  priorityCalculatedAt: string | null;
  checkInTime: string;
  calledTime: string | null;
  consultationStartTime: string | null;
  consultationEndTime: string | null;
  createdAt: string;
  updatedAt: string;
  queueNumber: string;
  waitingMinutes: number;
  triagePriority: TriagePriority | null;
  hasManualOverride: boolean;
  effectivePriority: number;
  /**
   * These four fields are only present when the backend's viewer-role
   * projection includes them — NURSE/DOCTOR/ADMIN. A RECEPTIONIST's
   * response omits them entirely (not just nulls them), so they're
   * genuinely optional here, not just nullable.
   */
  priorityBreakdown?: PriorityBreakdown;
  manualOverride?: number | null;
  overrideReason?: string | null;
  overriddenBy?: PriorityOverriddenBy | null;
  overriddenAt?: string | null;
}

export interface CheckInInput {
  patientId: string;
  departmentId: string;
  isEmergency?: boolean;
}

export interface OverridePriorityInput {
  overrideValue: number;
  reason: string;
}
