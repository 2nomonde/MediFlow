import { z } from "zod";
import { AppointmentStatus } from "@prisma/client";

/**
 * APPOINTMENT DATE/TIME HANDLING
 *
 * The approved Phase 2 schema's `Appointment.scheduledAt` is a single
 * `DateTime` — there is no stored duration/end-time field, and this
 * phase does not add one (see appointment.service.ts's top comment for
 * why a fixed-slot convention is used instead of a schema change).
 *
 * `z.coerce.date()` already rejects anything that doesn't parse to a
 * real date (Zod reports `invalid_date` for those), so no extra
 * "invalid time range" check is needed at the schema level beyond that
 * plus the sanity bound below. The past/future rule (Rule: "past dates
 * where inappropriate") is enforced in the service layer rather than
 * here, because "inappropriate" differs by operation — a brand-new
 * appointment must be in the future, but viewing/listing appointments
 * must obviously still allow querying appointments that are now in the
 * past.
 */
const appointmentDateTimeSchema = z.coerce
  .date()
  .refine((date) => !Number.isNaN(date.getTime()), "Enter a valid appointment date and time.")
  .refine((date) => date.getFullYear() <= new Date().getFullYear() + 2, "Enter a realistic appointment date.");

export const createAppointmentSchema = z
  .object({
    patientId: z.string().uuid("A valid patient is required."),
    departmentId: z.string().uuid("A valid department is required."),
    doctorId: z.string().uuid("A valid doctor is required."),
    scheduledAt: appointmentDateTimeSchema,
    reason: z
      .string()
      .trim()
      .max(500, "Reason must be 500 characters or fewer.")
      .optional()
      .or(z.literal("").transform(() => undefined)),
  })
  .strict();

export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>;

export const rescheduleAppointmentSchema = z
  .object({
    scheduledAt: appointmentDateTimeSchema,
    reason: z
      .string()
      .trim()
      .max(500, "Reason must be 500 characters or fewer.")
      .optional()
      .or(z.literal("").transform(() => undefined)),
  })
  .strict();

export type RescheduleAppointmentInput = z.infer<typeof rescheduleAppointmentSchema>;

/**
 * PATCH /api/appointments/:id/cancel body. The brief asks to "cancel
 * appointments with a recorded reason" — the reason is optional (a
 * receptionist may cancel without typing one) but when given, it's
 * persisted via the existing AuditLog.reason column (the schema already
 * has a dedicated field for exactly this), not a new column on
 * Appointment itself. See appointment.service.ts's `cancel`.
 */
export const cancelAppointmentSchema = z
  .object({
    reason: z
      .string()
      .trim()
      .max(500, "Reason must be 500 characters or fewer.")
      .optional()
      .or(z.literal("").transform(() => undefined)),
  })
  .strict();

export type CancelAppointmentInput = z.infer<typeof cancelAppointmentSchema>;

export const listAppointmentsQuerySchema = z.object({
  search: z.string().trim().max(200).optional(),
  patientId: z.string().uuid().optional(),
  departmentId: z.string().uuid().optional(),
  doctorId: z.string().uuid().optional(),
  status: z.nativeEnum(AppointmentStatus).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export type ListAppointmentsQuery = z.infer<typeof listAppointmentsQuerySchema>;
