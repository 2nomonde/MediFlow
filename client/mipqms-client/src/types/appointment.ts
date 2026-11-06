import type { Gender } from "./patient";
import type { Department } from "./queue";

/** Mirrors the Prisma `AppointmentStatus` enum exactly (Phase 2 schema). */
export type AppointmentStatus = "SCHEDULED" | "CONFIRMED" | "CANCELLED" | "NO_SHOW" | "COMPLETED";

export interface AppointmentPatientSummary {
  id: string;
  patientNumber: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: Gender;
}

export interface AppointmentDoctorSummary {
  id: string;
  firstName: string;
  lastName: string;
}

export interface AppointmentQueueEntrySummary {
  id: string;
  status: string;
}

/**
 * Mirrors the Prisma `Appointment` model exactly — every field here has
 * a matching column on the backend, nothing invented. `queueEntry` is
 * null until the patient is actually checked in against this
 * appointment (see appointment.service.ts on the backend).
 */
export interface Appointment {
  id: string;
  patientId: string;
  patient: AppointmentPatientSummary;
  departmentId: string;
  department: Department;
  doctorId: string;
  doctor: AppointmentDoctorSummary;
  scheduledAt: string;
  reason: string | null;
  status: AppointmentStatus;
  queueEntry: AppointmentQueueEntrySummary | null;
  createdAt: string;
  updatedAt: string;
  /** Only present when status is CANCELLED and a reason was recorded at cancellation time. */
  cancellationReason?: string | null;
}

export interface CreateAppointmentInput {
  patientId: string;
  departmentId: string;
  doctorId: string;
  scheduledAt: string;
  reason?: string;
}

export interface RescheduleAppointmentInput {
  scheduledAt: string;
  reason?: string;
}

export interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}
