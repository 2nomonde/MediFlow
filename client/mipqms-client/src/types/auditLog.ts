/** Mirrors the Prisma `AuditAction` enum exactly — only 4 of these 13 values are currently written anywhere in the system (see the Phase 15 doc). */
export type AuditAction =
  | "CHECK_IN"
  | "TRIAGE_RECORDED"
  | "PRIORITY_RECALCULATED"
  | "PRIORITY_OVERRIDE"
  | "PATIENT_CALLED"
  | "CONSULTATION_STARTED"
  | "CONSULTATION_COMPLETED"
  | "QUEUE_CANCELLED"
  | "NO_SHOW_MARKED"
  | "PRESCRIPTION_CREATED"
  | "PRESCRIPTION_DISPENSED"
  | "USER_LOGIN"
  | "CONFIG_UPDATED";

export interface AuditLogUser {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
}

/**
 * Mirrors the Prisma `AuditLog` model exactly — every field here has a
 * matching column. Field names match the schema (`entityType`/
 * `entityId`), not the generic `resourceType`/`resourceId` terminology
 * used loosely elsewhere, since those aren't the real column names.
 */
export interface AuditLogEntry {
  id: string;
  userId: string;
  user: AuditLogUser;
  action: AuditAction;
  entityType: string;
  entityId: string;
  queueEntryId: string | null;
  previousValue: unknown;
  newValue: unknown;
  reason: string | null;
  ipAddress: string | null;
  description: string | null;
  createdAt: string;
}
