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
  /**
   * Phase 13 (Consultation) — deliberately DOES NOT follow the "always
   * include ADMIN" pattern every prior clinical write group in this file
   * uses (triageWrite, priorityOverride, etc.). The Phase 13 brief
   * explicitly cautions: "Do not automatically give Admin clinical
   * editing privileges unless existing architecture already defines
   * this." Clinical notes and a diagnosis are more sensitive, more
   * personally attributable content than a triage vital or a priority
   * number, and nothing in this project has previously required an
   * administrator to author one — so this phase does not extend that
   * pattern here. ADMIN gets read access (consultationRead) but not
   * write. RECEPTIONIST and PHARMACIST get neither, matching "must NOT
   * create or edit clinical consultation records" and "must NOT edit
   * consultation records" respectively. NURSE is also excluded from
   * read: the brief only says nurses must not *edit* doctor notes, but
   * never explicitly grants read access to consultation content either,
   * and diagnosis/clinical notes go beyond what a nurse's own triage
   * role has needed to see so far in this system — documented as a
   * judgment call, not an oversight.
   */
  consultationRead: [UserRole.DOCTOR, UserRole.ADMIN],
  consultationWrite: [UserRole.DOCTOR],
  /**
   * Phase 14 (Prescriptions) — same deliberate pattern as Phase 13's
   * consultation groups: ADMIN gets read visibility but not clinical
   * write authority, per the brief's explicit "do not grant clinical
   * prescription-writing capability to ADMIN merely because ADMIN has
   * broad system permissions." Dispensing is its own group, scoped to
   * PHARMACIST only — not ADMIN either, matching the brief's suggested
   * separation exactly (prescriptionDispense: PHARMACIST).
   * RECEPTIONIST and NURSE get none of the three.
   */
  prescriptionRead: [UserRole.DOCTOR, UserRole.PHARMACIST, UserRole.ADMIN],
  prescriptionWrite: [UserRole.DOCTOR],
  prescriptionDispense: [UserRole.PHARMACIST],
  /**
   * Phase 15 (Audit Log) — ADMIN only, per the brief's explicit default
   * ("do not grant audit-log read access to other roles automatically").
   * Unlike every clinical/operational read group in this file, no other
   * role is included here at all — not even the role that performed a
   * given audited action gets to browse the trail through this API.
   */
  auditRead: [UserRole.ADMIN],
  /** Phase 16 (Reporting) — ADMIN only, per the brief's explicit default; no other role granted automatically. */
  reportRead: [UserRole.ADMIN],
} as const;
