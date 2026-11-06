import { z } from "zod";

/**
 * DATE HANDLING (documented per the Phase 16 requirement to be careful
 * and consistent about this):
 *
 * `dateFrom`/`dateTo` are plain "YYYY-MM-DD" calendar dates, not exact
 * instants. A naive `new Date("2026-09-14")` is parsed by JavaScript as
 * **UTC** midnight, while the rest of this project's date-boundary code
 * (queue.service.ts's "today" scoping, from Phase 9) uses **local**
 * midnight (`date.setHours(0,0,0,0)`). Mixing those two would silently
 * shift every report by the server's UTC offset — exactly the
 * inconsistency the brief warns against. So this schema parses the
 * Y/M/D components itself and builds the Date with the local-time
 * constructor (`new Date(year, monthIndex, day)`), matching the
 * existing project convention exactly, never the UTC-parsing shorthand.
 *
 * The constructed date is also range-checked against its own inputs
 * (e.g. "2026-02-30" would silently roll over to March 2nd with the
 * native Date constructor) so a nonsensical calendar date is rejected
 * outright rather than silently reinterpreted.
 */
const calendarDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format.")
  .transform((value, ctx) => {
    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(year, month - 1, day);
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Enter a valid calendar date." });
      return z.NEVER;
    }
    return date; // local midnight of the given calendar day
  });

export const reportSummaryQuerySchema = z
  .object({
    dateFrom: calendarDateSchema,
    dateTo: calendarDateSchema,
    departmentId: z.string().uuid().optional(),
  })
  .strict()
  .refine(
    (data) => {
      // Post-review correction: when calendarDateSchema's own transform
      // rejects a value (e.g. "2026-02-30") it reports the issue via
      // ctx.addIssue and returns z.NEVER — but Zod still evaluates
      // these object-level .refine() callbacks in the same pass, with
      // that field's actual runtime value being `undefined`, not a
      // Date. Calling .getTime() on it threw a raw TypeError, which
      // Express's error handling surfaced as a 500 instead of the
      // intended 400. Skipping the cross-field check when either side
      // isn't really a Date lets the field-level issue (a proper
      // ZodError, correctly mapped to 400) stand as the actual reported
      // error, instead of a second, crashing check running on top of it.
      if (!(data.dateFrom instanceof Date) || !(data.dateTo instanceof Date)) return true;
      return data.dateFrom.getTime() <= data.dateTo.getTime();
    },
    { message: "dateFrom must be before or equal to dateTo.", path: ["dateFrom"] }
  )
  .refine(
    (data) => {
      if (!(data.dateFrom instanceof Date) || !(data.dateTo instanceof Date)) return true;
      const days = (data.dateTo.getTime() - data.dateFrom.getTime()) / (24 * 60 * 60 * 1000);
      return days <= 366;
    },
    { message: "Date range cannot exceed 366 days.", path: ["dateTo"] }
  );

export type ReportSummaryQuery = z.infer<typeof reportSummaryQuerySchema>;
