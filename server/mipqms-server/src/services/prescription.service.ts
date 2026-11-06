import { Prisma, PrescriptionStatus, AuditAction } from "@prisma/client";
import { prisma } from "../config/database";
import { ApiError } from "../utils/ApiError";
import type { CreatePrescriptionInput } from "../validators/prescription.validators";

const prescriptionInclude = {
  medicine: {
    select: { id: true, name: true, genericName: true, dosageForm: true, strength: true, stockQuantity: true },
  },
  consultation: {
    select: {
      id: true,
      patientId: true,
      completedAt: true,
      patient: { select: { id: true, patientNumber: true, firstName: true, lastName: true } },
      doctor: { select: { id: true, firstName: true, lastName: true } },
    },
  },
  dispensedBy: { select: { id: true, firstName: true, lastName: true } },
} satisfies Prisma.PrescriptionInclude;

export const prescriptionService = {
  /**
   * POST /api/prescriptions/consultation/:consultationId
   *
   * `consultationId` is a route param, never body-supplied (see the
   * validator's comment) — there is no client-controllable field that
   * could point a prescription at the wrong patient's consultation.
   *
   * TRANSACTIONAL (post-review correction): the prescription create and
   * its PRESCRIPTION_CREATED audit write now happen inside one
   * `prisma.$transaction`. Previously these were two separate calls —
   * if the audit write failed after the prescription had already
   * committed, the prescription would exist with no corresponding
   * audit trail, which is exactly the kind of partial-write gap this
   * project's transaction-safety rules (Phase 13, Phase 14 dispense)
   * are meant to close. All read-only validation (consultation
   * ownership/completion, medicine existence) still happens before the
   * transaction opens, since none of it needs to be atomic with the
   * write — only the two writes themselves do. No business rule
   * changed; only where the two writes are committed did.
   */
  async create(consultationId: string, doctorId: string, input: CreatePrescriptionInput) {
    const consultation = await prisma.consultation.findUnique({ where: { id: consultationId } });
    if (!consultation) throw ApiError.notFound("Consultation not found.");

    // Judgment call, documented: a doctor may only prescribe against a
    // consultation they themselves are conducting — the brief's rule 4
    // ("only DOCTOR may create") is a role check, but allowing any
    // doctor to add medication to any other doctor's consultation would
    // be a real clinical-safety gap the literal rule doesn't by itself
    // prevent. This mirrors the same kind of interpretive addition
    // Phase 13 made for consultation ownership.
    if (consultation.doctorId !== doctorId) {
      throw ApiError.forbidden("You may only add prescriptions to your own consultations.");
    }

    // Judgment call, documented: once a consultation is completed it's
    // a closed historical record — Phase 13's own `update()` already
    // blocks editing a completed consultation's notes for the same
    // reason. Prescriptions follow the same rule for consistency;
    // prescriptions attached before completion remain fully visible in
    // history regardless (Section 9's requirement), only *new* ones
    // are blocked afterward.
    if (consultation.completedAt) {
      throw ApiError.conflict("Cannot add a prescription to a completed consultation.");
    }

    const medicine = await prisma.medicine.findUnique({ where: { id: input.medicineId } });
    if (!medicine) throw ApiError.notFound("Medicine not found.");

    const created = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const prescription = await tx.prescription.create({
        data: { consultationId, ...input },
        include: prescriptionInclude,
      });

      // Integrates with the existing Phase 11 audit pattern
      // (priority.service.ts / priorityConfig.service.ts) rather than
      // building a second audit mechanism — the schema already has
      // PRESCRIPTION_CREATED defined for exactly this, unused until now.
      // If this write throws, the transaction rolls back the
      // prescription create above too — no orphaned prescription with a
      // missing audit trail is possible.
      await tx.auditLog.create({
        data: {
          userId: doctorId,
          action: AuditAction.PRESCRIPTION_CREATED,
          entityType: "Prescription",
          entityId: prescription.id,
          newValue: {
            medicineId: input.medicineId,
            dosage: input.dosage,
            frequency: input.frequency,
            duration: input.duration,
            quantity: input.quantity,
          },
          description: `Prescription created for consultation ${consultationId}.`,
        },
      });

      return prescription;
    });

    // Non-blocking stock warning, per the brief: "may optionally warn
    // when stock appears insufficient, but this must NOT prevent
    // legitimate prescription creation." The prescription is already
    // created above; this only adds an informational flag to the
    // response, never a rejection.
    const stockWarning = medicine.stockQuantity < input.quantity;

    return { prescription: created, stockWarning };
  },

  /** GET /api/prescriptions/consultation/:consultationId — chronological, oldest first (the order they were prescribed in). */
  async listByConsultation(consultationId: string) {
    return prisma.prescription.findMany({
      where: { consultationId },
      include: prescriptionInclude,
      orderBy: { createdAt: "asc" },
    });
  },

  async getById(id: string) {
    const prescription = await prisma.prescription.findUnique({ where: { id }, include: prescriptionInclude });
    if (!prescription) throw ApiError.notFound("Prescription not found.");
    return prescription;
  },

  /** GET /api/prescriptions/pending — the pharmacist dispensing queue, oldest first (fairness). */
  async listPending() {
    return prisma.prescription.findMany({
      where: { status: PrescriptionStatus.PENDING },
      include: prescriptionInclude,
      orderBy: { createdAt: "asc" },
    });
  },

  /**
   * POST /api/prescriptions/:id/dispense
   *
   * Transactional: the prescription's status change and the medicine's
   * stock decrement happen together, or not at all. This is genuinely
   * a multi-table mutation (unlike a plain status flip), which is why
   * it's wrapped — a partial outcome (prescription marked dispensed but
   * stock unchanged, or vice versa) would be a real data-integrity bug.
   *
   * Stock decrement is intentionally the smallest defensible reading of
   * "dispensing reduces available stock": a simple clamped decrement on
   * `Medicine.stockQuantity`, never negative, never blocking the
   * dispense itself even if stock is already insufficient (consistent
   * with the "warn, never block" philosophy applied to creation above).
   * No movement log, no batch/lot tracking, no purchasing — all
   * explicitly out of scope for this phase.
   */
  async dispense(id: string, pharmacistId: string) {
    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const prescription = await tx.prescription.findUnique({
        where: { id },
        include: { medicine: { select: { id: true, stockQuantity: true } } },
      });
      if (!prescription) throw ApiError.notFound("Prescription not found.");

      if (prescription.status !== PrescriptionStatus.PENDING) {
        throw ApiError.conflict("This prescription is not pending and cannot be dispensed.");
      }

      const updated = await tx.prescription.update({
        where: { id },
        data: { status: PrescriptionStatus.DISPENSED, dispensedById: pharmacistId, dispensedAt: new Date() },
        include: prescriptionInclude,
      });

      const decrementBy = Math.min(prescription.quantity, prescription.medicine.stockQuantity);
      if (decrementBy > 0) {
        await tx.medicine.update({
          where: { id: prescription.medicineId },
          data: { stockQuantity: { decrement: decrementBy } },
        });
      }

      // Written INSIDE the transaction (a small refinement over the
      // Phase 11 precedent, whose own mutation wasn't itself
      // transactional): if the transaction rolls back for any reason,
      // the audit entry never gets created either, so the audit trail
      // can never describe a dispense that didn't actually happen.
      await tx.auditLog.create({
        data: {
          userId: pharmacistId,
          action: AuditAction.PRESCRIPTION_DISPENSED,
          entityType: "Prescription",
          entityId: id,
          previousValue: { status: prescription.status },
          newValue: { status: PrescriptionStatus.DISPENSED, quantity: prescription.quantity },
          description: `Prescription dispensed by pharmacist.`,
        },
      });

      return updated;
    });
  },
};
