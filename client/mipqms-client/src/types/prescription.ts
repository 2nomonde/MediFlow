export type PrescriptionStatus = "PENDING" | "DISPENSED" | "CANCELLED";

export interface PrescriptionMedicineSummary {
  id: string;
  name: string;
  genericName: string | null;
  dosageForm: string | null;
  strength: string | null;
  stockQuantity: number;
}

export interface PrescriptionConsultationSummary {
  id: string;
  patientId: string;
  completedAt: string | null;
  patient: { id: string; patientNumber: string; firstName: string; lastName: string };
  doctor: { id: string; firstName: string; lastName: string };
}

export interface PrescriptionDispensedBy {
  id: string;
  firstName: string;
  lastName: string;
}

/** Mirrors the backend's Prescription response exactly — every field maps to the existing model, nothing invented. */
export interface Prescription {
  id: string;
  consultationId: string;
  medicineId: string;
  medicine: PrescriptionMedicineSummary;
  consultation: PrescriptionConsultationSummary;
  dosage: string;
  frequency: string;
  duration: string;
  route: string | null;
  instructions: string | null;
  quantity: number;
  status: PrescriptionStatus;
  dispensedById: string | null;
  dispensedBy: PrescriptionDispensedBy | null;
  dispensedAt: string | null;
  createdAt: string;
}

export interface CreatePrescriptionInput {
  medicineId: string;
  dosage: string;
  frequency: string;
  duration: string;
  route?: string;
  instructions: string;
  quantity: number;
}
