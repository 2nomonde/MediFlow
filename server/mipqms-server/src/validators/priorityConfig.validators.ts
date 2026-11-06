import { z } from "zod";

/**
 * Every field maps to an existing PriorityConfig column. Non-negative
 * enforced per the Phase 11 requirement ("do not allow invalid negative
 * configuration"); the upper bound is a sanity ceiling against obvious
 * data-entry mistakes (e.g. an extra zero), not a clinical judgment.
 */
const weightField = z.coerce.number().min(0, "Value cannot be negative.").max(100000, "Value is implausibly large.");

export const updatePriorityConfigSchema = z
  .object({
    triageWeight: weightField.optional(),
    emergencyBonus: weightField.optional(),
    waitingTimeWeightPerMinute: weightField.optional(),
    appointmentOnTimeBonus: weightField.optional(),
    vulnerabilityBonus: weightField.optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one configuration value must be provided.",
  });

export type UpdatePriorityConfigInput = z.infer<typeof updatePriorityConfigSchema>;
