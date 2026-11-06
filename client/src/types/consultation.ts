import type { Gender } from "./patient";

export interface ConsultationPatientSummary {
  id: string;
  patientNumber: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: Gender;
}

export interface ConsultationDoctorSummary {
  id: string;
  firstName: string;
  lastName: string;
}

export interface ConsultationQueueEntrySummary {
  id: string;
  status: string;
  departmentId: string;
  department: { id: string; name: string };
}

/**
 * Mirrors the Prisma `Consultation` model exactly, including the Phase
 * 13 additions (`chiefComplaint`, `assessment`) — every field here has
 * a matching column on the backend. No diagnosis-coding, no AI-derived
 * field.
 */
export interface Consultation {
  id: string;
  queueEntryId: string;
  queueEntry: ConsultationQueueEntrySummary;
  patientId: string;
  patient: ConsultationPatientSummary;
  doctorId: string;
  doctor: ConsultationDoctorSummary;
  departmentId: string;
  chiefComplaint: string | null;
  clinicalNotes: string | null;
  assessment: string | null;
  diagnosis: string | null;
  treatmentPlan: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ConsultationClinicalFields {
  chiefComplaint?: string;
  clinicalNotes?: string;
  assessment?: string;
  diagnosis?: string;
  treatmentPlan?: string;
}
