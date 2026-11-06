import { Prisma, QueueStatus, UserRole } from "@prisma/client";
import { prisma } from "../config/database";
import { ApiError } from "../utils/ApiError";
import { queueEntryInclude, applyQueueStatusTransition } from "./queue.service";
import { refreshDepartmentServiceStat } from "./serviceStats.service";
import type { UpdateConsultationInput, CompleteConsultationInput } from "../validators/consultation.validators";

const consultationInclude = {
  patient: {
    select: { id: true, patientNumber: true, firstName: true, lastName: true, dateOfBirth: true, gender: true },
  },
  doctor: { select: { id: true, firstName: true, lastName: true } },
  queueEntry: {
    select: { id: true, status: true, departmentId: true, department: { select: { id: true, name: true } } },
  },
} satisfies Prisma.ConsultationInclude;

export const consultationService = {
  /**
   * POST /api/consultations/queue/:queueEntryId/start
   *
   * TRANSACTIONAL (post-review correction): the triage check, the
   * consultation create-or-find, and the CALLED → IN_CONSULTATION
   * transition (via `applyQueueStatusTransition`, queue.service.ts's
   * single source of transition truth — `ALLOWED_TRANSITIONS` is not
   * duplicated here) all happen inside one `prisma.$transaction`. If
   * the transition is invalid (entry isn't CALLED), the whole
   * transaction rolls back — including any consultation record that
   * would otherwise have been created — so an invalid
   * WAITING → IN_CONSULTATION attempt can never leave an orphaned
   * consultation behind. Previously these were separate, sequential
   * writes; this closes that data-integrity gap.
   */
  async start(queueEntryId: string, doctorId: string, actingRole: UserRole) {
    try {
      return await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const queueEntry = await tx.queueEntry.findUnique({ where: { id: queueEntryId }, include: queueEntryInclude });
        if (!queueEntry) throw ApiError.notFound("Queue entry not found.");

        // Business rule: a patient must be triaged before a normal
        // consultation. Emergency/fast-track entries (Phase 9's
        // isEmergency flag, set by reception at check-in) may bypass
        // this, per "emergency patients may follow the existing
        // approved emergency workflow." Checked inside the transaction
        // against the same fresh read the transition check uses, not a
        // separate pre-check against possibly-stale data.
        if (!queueEntry.isEmergency && !queueEntry.triage) {
          throw ApiError.conflict("This patient must be triaged before starting a consultation.");
        }

        // Idempotent "start": if a consultation record already exists
        // for this queue entry (queueEntryId is @unique — never more
        // than one), treat this as resuming an in-progress consultation
        // rather than an error.
        let consultation = await tx.consultation.findUnique({ where: { queueEntryId }, include: consultationInclude });

        if (!consultation) {
          consultation = await tx.consultation.create({
            data: {
              queueEntryId,
              patientId: queueEntry.patientId,
              doctorId,
              departmentId: queueEntry.departmentId,
              startedAt: new Date(),
            },
            include: consultationInclude,
          });
        }

        // Validates the CALLED-only transition using the exact same
        // ALLOWED_TRANSITIONS map every other queue status change uses.
        // If this throws, the consultation create/find above is rolled
        // back too — nothing is left behind.
        await applyQueueStatusTransition(tx, queueEntryId, QueueStatus.IN_CONSULTATION, actingRole);

        return consultation;
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        // Lost a race to create the same consultation. Because the
        // winning request's create + transition ran in its own atomic
        // transaction, by the time our create hits this unique-
        // constraint conflict the winner's transaction has already
        // fully committed (or, if theirs had failed, their row
        // wouldn't exist for us to conflict with) — so it's safe to
        // simply fetch and return the already-committed record rather
        // than retry the transition ourselves.
        const existing = await prisma.consultation.findUnique({ where: { queueEntryId }, include: consultationInclude });
        if (existing) return existing;
      }
      throw error;
    }
  },

  /** PATCH /api/consultations/:id — draft save; never touches status or completedAt. */
  async update(id: string, input: UpdateConsultationInput) {
    const existing = await prisma.consultation.findUnique({ where: { id } });
    if (!existing) throw ApiError.notFound("Consultation not found.");
    if (existing.completedAt) {
      throw ApiError.conflict("This consultation has already been completed and can no longer be edited.");
    }

    return prisma.consultation.update({ where: { id }, data: input, include: consultationInclude });
  },

  /**
   * POST /api/consultations/:id/complete
   *
   * TRANSACTIONAL (post-review correction): the final field save
   * (with `completedAt`) and the IN_CONSULTATION → COMPLETED queue
   * transition happen inside one `prisma.$transaction`. If the queue
   * entry isn't actually IN_CONSULTATION (e.g. it was cancelled
   * out-of-band), the whole transaction rolls back — including the
   * consultation's `completedAt` write — so a consultation can never
   * end up marked completed while its queue entry disagrees about its
   * own state. `refreshDepartmentServiceStat` runs AFTER the
   * transaction commits, matching Phase 12's own established
   * best-effort pattern: a stats-cache failure must never undo or
   * block a consultation completion that already succeeded.
   */
  async complete(
  id: string,
  input: CompleteConsultationInput,
  actingRole: UserRole
  
) {
    const updated = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const existing = await tx.consultation.findUnique({ where: { id } });
      if (!existing) throw ApiError.notFound("Consultation not found.");
      if (existing.completedAt) {
        throw ApiError.conflict("This consultation has already been completed.");
      }

      const consultation = await tx.consultation.update({
        where: { id },
        data: { ...input, completedAt: new Date() },
        include: consultationInclude,
      });

      // Validates the IN_CONSULTATION-only transition using the same
      // ALLOWED_TRANSITIONS map as every other queue status change. If
      // this throws, the completedAt write above is rolled back too.
      await applyQueueStatusTransition(tx, existing.queueEntryId, QueueStatus.COMPLETED, actingRole);

      return consultation;
    });

    try {
      await refreshDepartmentServiceStat(updated.departmentId);
    } catch (error) {
      console.error(
        `⚠️ Failed to refresh service-time stats after consultation completion for department ${updated.departmentId}:`,
        error
      );
    }

    return updated;
  },

  async getById(id: string) {
    const consultation = await prisma.consultation.findUnique({ where: { id }, include: consultationInclude });
    if (!consultation) throw ApiError.notFound("Consultation not found.");
    return consultation;
  },

  /** GET /api/consultations/queue/:queueEntryId — 404 if none started yet (mirrors triage's own /queue/:id lookup). */
  async getByQueueEntry(queueEntryId: string) {
    const consultation = await prisma.consultation.findUnique({ where: { queueEntryId }, include: consultationInclude });
    if (!consultation) throw ApiError.notFound("No consultation has been started for this queue entry yet.");
    return consultation;
  },

  /** GET /api/consultations/patient/:patientId — full history, newest first, never overwritten by a later visit. */
  async getPatientHistory(patientId: string) {
    return prisma.consultation.findMany({
      where: { patientId },
      include: consultationInclude,
      orderBy: { createdAt: "desc" },
    });
  },
};
