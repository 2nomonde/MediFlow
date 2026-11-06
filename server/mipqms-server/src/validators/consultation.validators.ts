import { z } from "zod";

/**
 * Every field here maps 1:1 to the Consultation model. No diagnosis-
 * coding system, no structured ICD lookup, no AI-assisted field —
 * plain free text, matching the brief's "keep it MVP-sized" instruction.
 */
const clinicalFieldsShape = {
  chiefComplaint: z.string().trim().max(500).optional().or(z.literal("").transform(() => undefined)),
  clinicalNotes: z.string().trim().max(3000).optional().or(z.literal("").transform(() => undefined)),
  assessment: z.string().trim().max(2000).optional().or(z.literal("").transform(() => undefined)),
  diagnosis: z.string().trim().max(500).optional().or(z.literal("").transform(() => undefined)),
  treatmentPlan: z.string().trim().max(2000).optional().or(z.literal("").transform(() => undefined)),
};

/** PATCH /api/consultations/:id — draft save while in progress; at least one field required. */
export const updateConsultationSchema = z
  .object(clinicalFieldsShape)
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided to update.",
  });

export type UpdateConsultationInput = z.infer<typeof updateConsultationSchema>;

/**
 * POST /api/consultations/:id/complete — accepts the same optional
 * fields as a convenience (save-and-complete in one action), but none
 * are required: a doctor may have already saved everything via PATCH
 * and is just completing now.
 */
export const completeConsultationSchema = z.object(clinicalFieldsShape).strict();

export type CompleteConsultationInput = z.infer<typeof completeConsultationSchema>;
