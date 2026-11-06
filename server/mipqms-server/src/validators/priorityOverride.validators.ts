import { z } from "zod";

/**
 * A required, non-trivial reason is the whole point of a "controlled"
 * override — an override without one is indistinguishable from a
 * silent, unexplained change to queue order, which the Phase 11 brief
 * explicitly forbids ("do not allow silent overrides").
 */
export const overridePrioritySchema = z
  .object({
    overrideValue: z.coerce
      .number()
      .min(0, "Priority value cannot be negative.")
      .max(1000000, "Value is implausibly large."),
    reason: z.string().trim().min(10, "Provide a documented reason of at least 10 characters.").max(500),
  })
  .strict();

export type OverridePriorityInput = z.infer<typeof overridePrioritySchema>;
