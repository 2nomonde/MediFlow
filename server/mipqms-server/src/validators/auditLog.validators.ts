import { z } from "zod";
import { AuditAction } from "@prisma/client";

/**
 * Every filter maps to an actual AuditLog column. The brief's suggested
 * `resourceType`/`resourceId` filter names don't exist on the schema —
 * the real columns are `entityType`/`entityId`, so the filter is named
 * to match reality rather than the brief's generic suggestion.
 *
 * Dates use `z.coerce.date()`, which rejects unparseable input outright
 * (a ZodError, not a silently-guessed fallback) — per the requirement
 * to reject invalid dates rather than guess. Both bounds are inclusive
 * and treated as literal instants: `dateFrom` means `createdAt >=
 * dateFrom`, `dateTo` means `createdAt <= dateTo`. A caller wanting a
 * whole calendar day should pass a `dateTo` already set to the end of
 * that day (e.g. `23:59:59.999`) — this endpoint does not silently
 * expand a date-only value to end-of-day itself, since that would be
 * exactly the kind of guessing the requirement warns against.
 */
export const listAuditLogsQuerySchema = z
  .object({
    action: z.nativeEnum(AuditAction).optional(),
    userId: z.string().uuid().optional(),
    entityType: z.string().trim().max(100).optional(),
    dateFrom: z.coerce.date().optional(),
    dateTo: z.coerce.date().optional(),
    page: z.coerce.number().int().min(1).optional().default(1),
    pageSize: z.coerce.number().int().min(1).max(100).optional().default(25),
  })
  .strict()
  .refine((data) => !data.dateFrom || !data.dateTo || data.dateFrom <= data.dateTo, {
    message: "dateFrom must be before or equal to dateTo.",
    path: ["dateFrom"],
  });

export type ListAuditLogsQuery = z.infer<typeof listAuditLogsQuerySchema>;
