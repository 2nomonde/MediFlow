import { z } from "zod";

/**
 * Every field maps to the existing Prescription model. `consultationId`
 * comes from the route (`/prescriptions/consultation/:consultationId`),
 * never the request body — this is deliberate: it means there is no
 * client-supplied field that could mismatch the consultation a doctor
 * is actually viewing, which is what rule 10 ("never link a prescription
 * to another patient's consultation") ultimately protects against.
 *
 * `instructions` is nullable on the schema, but required here at the
 * validation boundary — a prescription with no directions for use is a
 * real patient-safety gap, and the stricter application-level rule
 * doesn't require a schema change to enforce.
 */
export const createPrescriptionSchema = z
  .object({
    medicineId: z.string().uuid("A valid medicine is required."),
    dosage: z.string().trim().min(1, "Dosage is required.").max(200),
    frequency: z.string().trim().min(1, "Frequency is required.").max(200),
    duration: z.string().trim().min(1, "Duration is required.").max(200),
    route: z.string().trim().max(100).optional().or(z.literal("").transform(() => undefined)),
    instructions: z.string().trim().min(1, "Instructions are required.").max(1000),
    quantity: z.coerce.number().int().positive("Quantity must be a positive number.").max(10000),
  })
  .strict();

export type CreatePrescriptionInput = z.infer<typeof createPrescriptionSchema>;
