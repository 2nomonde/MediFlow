import { UserRole } from "@prisma/client";

/**
 * The Phase 4-approved role-permission matrix, expressed as reusable
 * groups so later phases import from here instead of re-deciding access
 * per feature.
 *
 *   ADMIN        — system administration and configuration
 *   RECEPTIONIST — patient registration, search, appointments, check-in
 *   NURSE        — triage and priority-related clinical input
 *   DOCTOR       — consultation, queue calling, prescriptions
 *   PHARMACIST   — prescription dispensing
 *
 * Whether ADMIN should also be granted override access to each area was
 * left to the phase that builds each route. Phase 7 (Patient Management)
 * made that call explicitly for patients: ADMIN gets full patient
 * management access alongside RECEPTIONIST.
 *
 * Phase 9 (Queue Management) adds three queue-specific groups rather
 * than overloading the phase 4 groups above, since queue permissions
 * split more finely than "one role owns this area":
 *   - queueRead: everyone who needs to see the live queue (matches the
 *     Phase 6 nav matrix for "Queue" exactly — PHARMACIST excluded).
 *   - queueCheckIn: only the front-desk role creates queue entries.
 *   - queueClinicalAction: only clinical roles call/start/complete —
 *     RECEPTIONIST is deliberately excluded from "next patient" and
 *     clinical-progression transitions; it may still record CANCELLED/
 *     NO_SHOW via the status endpoint, enforced in queue.service.ts
 *     (defense in depth, not expressible as a single role list here).
 * Phase 10 (Triage) adds two more: triageRead (NURSE, DOCTOR, ADMIN —
 * "DOCTOR may view triage information where appropriate" per the Phase
 * 10 brief) and triageWrite (NURSE, ADMIN only — RECEPTIONIST and
 * PHARMACIST get no triage access at all, and DOCTOR is deliberately
 * NOT given edit rights here since the brief says not to grant that
 * "unless required by the existing architecture," and nothing in
 * Phases 1–9 requires it).
 * Phase 11 (Intelligent Priority Engine) adds three more:
 *   - priorityConfigManage: ADMIN only — viewing/editing the scoring
 *     formula's weights is system configuration, not a clinical action.
 *   - priorityView: NURSE, DOCTOR, ADMIN — reading a breakdown/
 *     recalculating is a clinical-context action; RECEPTIONIST already
 *     sees the plain priorityScore/effectivePriority number via the
 *     existing queueRead-gated GET /api/queue (Phase 9, now enriched),
 *     but not the dedicated explanation/recalculate endpoints.
 *   - priorityOverride: NURSE, DOCTOR, ADMIN — RECEPTIONIST and
 *     PHARMACIST are explicitly forbidden from overriding priority per
 *     the Phase 11 brief.
 */
export const ROLE_GROUPS = {
  systemAdministration: [UserRole.ADMIN],
  patientRegistrationAndAppointments: [UserRole.RECEPTIONIST, UserRole.ADMIN],
  triageAndClinicalInput: [UserRole.NURSE],
  consultationQueueAndPrescribing: [UserRole.DOCTOR],
  prescriptionDispensing: [UserRole.PHARMACIST],
  queueRead: [UserRole.RECEPTIONIST, UserRole.NURSE, UserRole.DOCTOR, UserRole.ADMIN],
  queueCheckIn: [UserRole.RECEPTIONIST, UserRole.ADMIN],
  queueClinicalAction: [UserRole.NURSE, UserRole.DOCTOR, UserRole.ADMIN],
  queueStatusUpdate: [UserRole.RECEPTIONIST, UserRole.NURSE, UserRole.DOCTOR, UserRole.ADMIN],
  triageRead: [UserRole.NURSE, UserRole.DOCTOR, UserRole.ADMIN],
  triageWrite: [UserRole.NURSE, UserRole.ADMIN],
  priorityConfigManage: [UserRole.ADMIN],
  priorityView: [UserRole.NURSE, UserRole.DOCTOR, UserRole.ADMIN],
  priorityOverride: [UserRole.NURSE, UserRole.DOCTOR, UserRole.ADMIN],
} as const;
