import { z } from "zod";
import { TriagePriority } from "@prisma/client";

/**
 * Every field here maps 1:1 to the approved Triage model. No diagnosis,
 * treatment, or clinical-recommendation field exists in the schema, and
 * none is added here — the system records what staff observed and
 * assessed, nothing more.
 */

const vitalsShape = {
  temperature: z.coerce.number().min(30, "Enter a plausible temperature (°C).").max(45).optional(),
  bloodPressureSys: z.coerce.number().int().min(50).max(260).optional(),
  bloodPressureDia: z.coerce.number().int().min(30).max(150).optional(),
  heartRate: z.coerce.number().int().min(20).max(250).optional(),
  respiratoryRate: z.coerce.number().int().min(5).max(60).optional(),
  oxygenSaturation: z.coerce.number().int().min(0).max(100).optional(),
  weightKg: z.coerce.number().min(0.5).max(500).optional(),
  heightCm: z.coerce.number().min(20).max(250).optional(),
  bloodGlucose: z.coerce.number().min(0).max(50).optional(),
  painScore: z.coerce.number().int().min(0, "Pain score is 0–10.").max(10).optional(),
  symptoms: z.string().trim().max(1000).optional().or(z.literal("").transform(() => undefined)),
  notes: z.string().trim().max(2000).optional().or(z.literal("").transform(() => undefined)),
};

export const createTriageSchema = z
  .object({
    queueEntryId: z.string().uuid("A valid queue entry is required."),
    priorityLevel: z.nativeEnum(TriagePriority, {
      errorMap: () => ({ message: "Select a valid triage priority level." }),
    }),
    ...vitalsShape,
  })
  .strict();

export type CreateTriageInput = z.infer<typeof createTriageSchema>;

export const updateTriageSchema = z
  .object({
    priorityLevel: z.nativeEnum(TriagePriority).optional(),
    ...vitalsShape,
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided to update.",
  });

export type UpdateTriageInput = z.infer<typeof updateTriageSchema>;

export const listTriageQuerySchema = z.object({
  priorityLevel: z.nativeEnum(TriagePriority).optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export type ListTriageQuery = z.infer<typeof listTriageQuerySchema>;
