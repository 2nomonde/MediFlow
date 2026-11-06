import { Prisma, AppointmentStatus, QueueStatus, UserRole, AuditAction } from "@prisma/client";
import { prisma } from "../config/database";
import { ApiError } from "../utils/ApiError";
import type {
  CreateAppointmentInput,
  RescheduleAppointmentInput,
  ListAppointmentsQuery,
} from "../validators/appointment.validators";

/**
 * OVERLAP-DETECTION CONVENTION (documented per the brief's requirement
 * to "prevent overlapping appointments for the same doctor"):
 *
 * The approved Phase 2 `Appointment` model stores only a single point
 * in time (`scheduledAt`) — there is no `durationMinutes` or `endsAt`
 * column, and this phase does not add one. Per the governing
 * instructions ("reuse the existing Prisma Appointment model... do not
 * make schema changes without justification" and "if the existing
 * schema is sufficient, do NOT create a migration"), a genuine overlap
 * check needs *some* notion of how long an appointment occupies a
 * doctor's time, so a fixed, documented slot length is used as an
 * application-layer business rule instead of a schema change:
 *
 *   APPOINTMENT_SLOT_MINUTES = 30
 *
 * Two appointments for the SAME doctor conflict if their `scheduledAt`
 * values are less than 30 minutes apart. This is a deliberate MVP
 * simplification — a real clinic might have variable-length visit
 * types — and is called out explicitly in
 * Phase_Appointments_Module.md's Known Limitations section, not
 * silently assumed.
 *
 * CANCELLED and NO_SHOW appointments never block a new booking (the
 * doctor's time was never actually taken, or the slot is already known
 * to be free) — only SCHEDULED, CONFIRMED, and COMPLETED count as
 * occupying the slot.
 */
const APPOINTMENT_SLOT_MINUTES = 30;
const APPOINTMENT_SLOT_MS = APPOINTMENT_SLOT_MINUTES * 60 * 1000;
const BLOCKING_STATUSES: AppointmentStatus[] = [
  AppointmentStatus.SCHEDULED,
  AppointmentStatus.CONFIRMED,
  AppointmentStatus.COMPLETED,
];

/** Terminal/locked appointment states — reschedule and cancel both refuse to act on these. */
const LOCKED_STATUSES: AppointmentStatus[] = [AppointmentStatus.CANCELLED, AppointmentStatus.COMPLETED, AppointmentStatus.NO_SHOW];

/** Queue statuses that mean the patient has already progressed into an active visit. */
const ACTIVE_QUEUE_STATUSES: QueueStatus[] = [QueueStatus.WAITING, QueueStatus.CALLED, QueueStatus.IN_CONSULTATION];

const appointmentInclude = {
  patient: {
    select: { id: true, patientNumber: true, firstName: true, lastName: true, dateOfBirth: true, gender: true },
  },
  department: { select: { id: true, name: true } },
  doctor: { select: { id: true, firstName: true, lastName: true } },
  queueEntry: { select: { id: true, status: true } },
} satisfies Prisma.AppointmentInclude;

type AppointmentWithRelations = Prisma.AppointmentGetPayload<{ include: typeof appointmentInclude }> & {
  /**
   * Only ever populated when `status === "CANCELLED"` and a reason was
   * recorded at cancellation time. Not a column on Appointment itself —
   * see `cancel()` below for why it lives in AuditLog.reason instead.
   */
  cancellationReason?: string | null;
};

function isExactSlotConflict(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") return false;
  const target = error.meta?.target;
  const targetText = Array.isArray(target) ? target.join(",") : String(target ?? "");
  return targetText.includes("doctorId") && targetText.includes("scheduledAt");
}

async function assertDoctorIsAvailable(
  client: Prisma.TransactionClient,
  doctorId: string,
  scheduledAt: Date,
  excludeAppointmentId?: string
): Promise<void> {
  const windowStart = new Date(scheduledAt.getTime() - APPOINTMENT_SLOT_MS);
  const windowEnd = new Date(scheduledAt.getTime() + APPOINTMENT_SLOT_MS);

  const conflict = await client.appointment.findFirst({
    where: {
      doctorId,
      status: { in: BLOCKING_STATUSES },
      scheduledAt: { gt: windowStart, lt: windowEnd },
      ...(excludeAppointmentId ? { id: { not: excludeAppointmentId } } : {}),
    },
  });

  if (conflict) {
    throw ApiError.conflict(
      `This doctor already has an appointment within ${APPOINTMENT_SLOT_MINUTES} minutes of the requested time.`,
      { conflictingAppointmentId: conflict.id }
    );
  }
}

export const appointmentService = {
  async list(query: ListAppointmentsQuery) {
    const { page, pageSize, search, patientId, departmentId, doctorId, status, dateFrom, dateTo } = query;

    const where: Prisma.AppointmentWhereInput = {
      ...(patientId ? { patientId } : {}),
      ...(departmentId ? { departmentId } : {}),
      ...(doctorId ? { doctorId } : {}),
      ...(status ? { status } : {}),
      ...(dateFrom || dateTo
        ? {
            scheduledAt: {
              ...(dateFrom ? { gte: dateFrom } : {}),
              ...(dateTo ? { lte: dateTo } : {}),
            },
          }
        : {}),
      ...(search
        ? {
            patient: {
              OR: [
                { patientNumber: { contains: search, mode: "insensitive" } },
                { firstName: { contains: search, mode: "insensitive" } },
                { lastName: { contains: search, mode: "insensitive" } },
              ],
            },
          }
        : {}),
    };

    const [total, appointments] = await prisma.$transaction([
      prisma.appointment.count({ where }),
      prisma.appointment.findMany({
        where,
        include: appointmentInclude,
        orderBy: [{ scheduledAt: "asc" }, { id: "asc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return {
      appointments,
      pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
    };
  },

  async getById(id: string): Promise<AppointmentWithRelations> {
    const appointment = await prisma.appointment.findUnique({ where: { id }, include: appointmentInclude });
    if (!appointment) throw ApiError.notFound("Appointment not found.");

    // The cancellation reason (Rule: "cancel with a recorded reason")
    // lives in AuditLog.reason rather than a new Appointment column —
    // see `cancel()` below. Only looked up when actually cancelled, so
    // this adds no extra query for the common case.
    if (appointment.status === AppointmentStatus.CANCELLED) {
      const cancelLog = await prisma.auditLog.findFirst({
        where: { entityType: "Appointment", entityId: id, action: AuditAction.APPOINTMENT_CANCELLED },
        orderBy: { createdAt: "desc" },
        select: { reason: true },
      });
      return { ...appointment, cancellationReason: cancelLog?.reason ?? null };
    }

    return appointment;
  },

  async create(input: CreateAppointmentInput, createdBy: string): Promise<AppointmentWithRelations> {
    const now = new Date();
    if (input.scheduledAt.getTime() < now.getTime()) {
      throw ApiError.badRequest("Appointment date and time cannot be in the past.");
    }

    const patient = await prisma.patient.findUnique({ where: { id: input.patientId } });
    if (!patient) throw ApiError.notFound("Patient not found.");

    const department = await prisma.department.findUnique({ where: { id: input.departmentId } });
    if (!department) throw ApiError.notFound("Department not found.");

    const doctor = await prisma.user.findUnique({ where: { id: input.doctorId } });
    if (!doctor || doctor.role !== UserRole.DOCTOR) {
      throw ApiError.badRequest("Select a valid doctor for this appointment.");
    }
    if (!doctor.isActive) {
      throw ApiError.badRequest("This doctor's account is inactive.");
    }

    try {
      return await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        await assertDoctorIsAvailable(tx, input.doctorId, input.scheduledAt);
        const appointment = await tx.appointment.create({
          data: {
            patientId: input.patientId,
            departmentId: input.departmentId,
            doctorId: input.doctorId,
            scheduledAt: input.scheduledAt,
            reason: input.reason,
          },
          include: appointmentInclude,
        });

        // Audit logging (Rule: "use the existing AuditLog/AuditAction
        // conventions for appointment creation, rescheduling and
        // cancellation"). Written inside the same transaction as the
        // Phase 14 precedent (prescription.service.ts's
        // PRESCRIPTION_CREATED) — if the audit write fails, the
        // appointment create rolls back too, so an appointment can never
        // exist without a matching audit trail entry.
        await tx.auditLog.create({
          data: {
            userId: createdBy,
            action: AuditAction.APPOINTMENT_CREATED,
            entityType: "Appointment",
            entityId: appointment.id,
            newValue: {
              patientId: input.patientId,
              departmentId: input.departmentId,
              doctorId: input.doctorId,
              scheduledAt: input.scheduledAt,
              reason: input.reason ?? null,
            },
            description: `Appointment scheduled for patient ${input.patientId}.`,
          },
        });

        return appointment;
      });
    } catch (error) {
      if (isExactSlotConflict(error)) {
        throw ApiError.conflict("This doctor already has an appointment scheduled at this exact time.");
      }
      throw error;
    }
  },

  /**
   * PATCH /api/appointments/:id/reschedule — date/time change only.
   * Transactional: the state check, the conflict re-check (excluding
   * this appointment's own current slot), and the update all happen
   * inside one `prisma.$transaction` so a concurrent booking for the
   * same doctor can never slip in between the check and the write.
   */
  async reschedule(id: string, input: RescheduleAppointmentInput, rescheduledBy: string): Promise<AppointmentWithRelations> {
    const now = new Date();
    if (input.scheduledAt.getTime() < now.getTime()) {
      throw ApiError.badRequest("Appointment date and time cannot be in the past.");
    }

    try {
      return await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const existing = await tx.appointment.findUnique({ where: { id } });
        if (!existing) throw ApiError.notFound("Appointment not found.");

        if (LOCKED_STATUSES.includes(existing.status)) {
          throw ApiError.conflict(`A ${existing.status.toLowerCase()} appointment cannot be rescheduled.`);
        }

        await assertDoctorIsAvailable(tx, existing.doctorId, input.scheduledAt, id);

        const updated = await tx.appointment.update({
          where: { id },
          data: {
            scheduledAt: input.scheduledAt,
            ...(input.reason !== undefined ? { reason: input.reason } : {}),
          },
          include: appointmentInclude,
        });

        await tx.auditLog.create({
          data: {
            userId: rescheduledBy,
            action: AuditAction.APPOINTMENT_RESCHEDULED,
            entityType: "Appointment",
            entityId: id,
            previousValue: { scheduledAt: existing.scheduledAt, reason: existing.reason },
            newValue: { scheduledAt: input.scheduledAt, reason: input.reason ?? existing.reason },
            description: `Appointment rescheduled.`,
          },
        });

        return updated;
      });
    } catch (error) {
      if (isExactSlotConflict(error)) {
        throw ApiError.conflict("This doctor already has an appointment scheduled at this exact time.");
      }
      throw error;
    }
  },

  /**
   * PATCH /api/appointments/:id/cancel — preserves the record (status
   * only), never deletes it. Refuses to cancel an appointment that has
   * already progressed into an active queue visit (Rule: "must not
   * automatically bypass... established queue rules" — the inverse
   * also holds: cancelling the appointment record must not silently
   * remove a patient who is currently WAITING/CALLED/IN_CONSULTATION;
   * that must go through the Queue module itself).
   */
  async cancel(id: string, cancelledBy: string, reason?: string): Promise<AppointmentWithRelations> {
    const updated = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const existing = await tx.appointment.findUnique({ where: { id }, include: { queueEntry: true } });
      if (!existing) throw ApiError.notFound("Appointment not found.");

      if (LOCKED_STATUSES.includes(existing.status)) {
        throw ApiError.conflict(`A ${existing.status.toLowerCase()} appointment cannot be cancelled.`);
      }

      if (existing.queueEntry && ACTIVE_QUEUE_STATUSES.includes(existing.queueEntry.status)) {
        throw ApiError.conflict(
          "This appointment already has an active queue check-in. Cancel or resolve the queue entry first."
        );
      }

      const result = await tx.appointment.update({
        where: { id },
        data: { status: AppointmentStatus.CANCELLED },
        include: appointmentInclude,
      });

      // The reason (Rule: "cancel appointments with a recorded reason")
      // is stored on the AuditLog row itself via its existing `reason`
      // column — the Appointment table gets no new column for this.
      // getById() re-reads it back out for display.
      await tx.auditLog.create({
        data: {
          userId: cancelledBy,
          action: AuditAction.APPOINTMENT_CANCELLED,
          entityType: "Appointment",
          entityId: id,
          previousValue: { status: existing.status },
          newValue: { status: AppointmentStatus.CANCELLED },
          reason: reason ?? null,
          description: `Appointment cancelled.`,
        },
      });

      return result;
    });

    return { ...updated, cancellationReason: reason ?? null };
  },
};

export type { AppointmentWithRelations };
