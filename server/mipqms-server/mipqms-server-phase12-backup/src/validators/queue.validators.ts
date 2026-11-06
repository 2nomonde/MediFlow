import { z } from "zod";
import { QueueStatus } from "@prisma/client";

/**
 * Check-in accepts only what Phase 9 actually needs to create a
 * WAITING queue entry against the existing QueueEntry model:
 * patientId, departmentId, and the existing isEmergency flag. No
 * appointmentId (appointments aren't built yet — every Phase 9 check-in
 * is a walk-in) and no priorityScore/priorityCalculatedAt (Phase 11).
 */
export const checkInSchema = z
  .object({
    patientId: z.string().uuid("A valid patient is required."),
    departmentId: z.string().uuid("A valid department is required."),
    isEmergency: z.boolean().optional().default(false),
  })
  .strict();

export type CheckInInput = z.infer<typeof checkInSchema>;

/**
 * Targets a controlled subset of QueueStatus — WAITING is deliberately
 * excluded since nothing may transition back into it (it's only ever
 * the creation default), matching the transition map in
 * services/queue.service.ts.
 */
export const updateQueueStatusSchema = z
  .object({
    status: z.enum(
      [
        QueueStatus.CALLED,
        QueueStatus.IN_CONSULTATION,
        QueueStatus.COMPLETED,
        QueueStatus.CANCELLED,
        QueueStatus.NO_SHOW,
      ],
      { errorMap: () => ({ message: "Enter a valid target status." }) }
    ),
  })
  .strict();

export type UpdateQueueStatusInput = z.infer<typeof updateQueueStatusSchema>;

export const callNextSchema = z
  .object({
    departmentId: z.string().uuid("A valid department is required."),
  })
  .strict();

export type CallNextInput = z.infer<typeof callNextSchema>;

export const listQueueQuerySchema = z.object({
  status: z.nativeEnum(QueueStatus).optional(),
  departmentId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(50),
});

export type ListQueueQuery = z.infer<typeof listQueueQuerySchema>;
