import type { QueueEntry } from "./queue";

/** Mirrors the Prisma `TriagePriority` enum exactly (Phase 2 schema). EMERGENCY here IS the emergency indicator — no separate boolean exists. */
export type TriagePriority = "EMERGENCY" | "URGENT" | "HIGH" | "NORMAL" | "LOW";

export interface TriageRecordedBy {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
}

/**
 * Mirrors the Prisma `Triage` model exactly — every field here has a
 * matching column on the backend, nothing invented. No diagnosis or
 * treatment field exists because none exists on the schema; this
 * records staff-entered observations and assessment only.
 */
export interface Triage {
  id: string;
  queueEntryId: string;
  queueEntry: QueueEntry;
  recordedById: string;
  recordedBy: TriageRecordedBy;
  temperature: number | null;
  bloodPressureSys: number | null;
  bloodPressureDia: number | null;
  heartRate: number | null;
  respiratoryRate: number | null;
  oxygenSaturation: number | null;
  weightKg: number | null;
  heightCm: number | null;
  bmi: number | null;
  bloodGlucose: number | null;
  painScore: number | null;
  symptoms: string | null;
  notes: string | null;
  priorityLevel: TriagePriority;
  recordedAt: string;
}

export interface TriageClinicalFields {
  priorityLevel: TriagePriority;
  temperature?: number;
  bloodPressureSys?: number;
  bloodPressureDia?: number;
  heartRate?: number;
  respiratoryRate?: number;
  oxygenSaturation?: number;
  weightKg?: number;
  heightCm?: number;
  bloodGlucose?: number;
  painScore?: number;
  symptoms?: string;
  notes?: string;
}

export interface CreateTriageInput extends TriageClinicalFields {
  queueEntryId: string;
}

export type UpdateTriageInput = Partial<TriageClinicalFields>;
