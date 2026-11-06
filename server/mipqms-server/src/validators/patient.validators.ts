import { z } from "zod";
import { Gender, VulnerabilityCategory } from "@prisma/client";

/**
 * Every field below maps 1:1 to the approved Phase 2 Patient model —
 * nothing invented. `patientNumber`, `id`, `registrationDate`,
 * `createdAt`, `updatedAt` are never accepted from the client: the first
 * is server-generated (see services/patient.service.ts), the rest are
 * database-managed.
 */

const dateOfBirthSchema = z.coerce
  .date({ errorMap: () => ({ message: "Enter a valid date of birth." }) })
  .max(new Date(), { message: "Date of birth cannot be in the future." })
  .min(new Date("1900-01-01"), { message: "Enter a valid date of birth." });

// South African phone numbers in common local/international forms — kept
// lenient (this isn't a phone-verification system) but rejects obvious
// garbage.
const phoneSchema = z
  .string()
  .trim()
  .regex(/^[0-9+()\-\s]{7,20}$/, "Enter a valid phone number.")
  .optional()
  .or(z.literal("").transform(() => undefined));

const emailSchema = z
  .string()
  .trim()
  .email("Enter a valid email address.")
  .optional()
  .or(z.literal("").transform(() => undefined));

const idOrPassportSchema = z
  .string()
  .trim()
  .min(4, "ID/passport number looks too short.")
  .max(30, "ID/passport number looks too long.")
  .optional()
  .or(z.literal("").transform(() => undefined));

export const createPatientSchema = z
  .object({
    firstName: z.string().trim().min(1, "First name is required.").max(100),
    lastName: z.string().trim().min(1, "Last name is required.").max(100),
    dateOfBirth: dateOfBirthSchema,
    gender: z.nativeEnum(Gender, { errorMap: () => ({ message: "Select a valid gender." }) }),
    idOrPassportNumber: idOrPassportSchema,
    phone: phoneSchema,
    email: emailSchema,
    address: z.string().trim().max(300).optional().or(z.literal("").transform(() => undefined)),
    emergencyContactName: z.string().trim().max(150).optional().or(z.literal("").transform(() => undefined)),
    emergencyContactPhone: phoneSchema,
    vulnerabilityCategory: z.nativeEnum(VulnerabilityCategory).optional().default(VulnerabilityCategory.NONE),
    allergies: z.string().trim().max(1000).optional().or(z.literal("").transform(() => undefined)),
    chronicConditions: z.string().trim().max(1000).optional().or(z.literal("").transform(() => undefined)),
  })
  .strict();

export type CreatePatientInput = z.infer<typeof createPatientSchema>;

/**
 * Same field set as create, all optional (a PATCH may touch just one
 * field), still `.strict()` so any field not explicitly listed here —
 * including `patientNumber`, `id`, or anything unrecognized — is
 * rejected by Zod before it ever reaches the service layer. This is the
 * allow-list the Phase 7 requirements call for.
 */
export const updatePatientSchema = z
  .object({
    firstName: z.string().trim().min(1).max(100).optional(),
    lastName: z.string().trim().min(1).max(100).optional(),
    dateOfBirth: dateOfBirthSchema.optional(),
    gender: z.nativeEnum(Gender).optional(),
    idOrPassportNumber: idOrPassportSchema,
    phone: z
      .string()
      .trim()
      .regex(/^[0-9+()\-\s]{7,20}$/, "Enter a valid phone number.")
      .optional()
      .or(z.literal("").transform(() => null)),
    email: emailSchema,
    address: z.string().trim().max(300).optional().or(z.literal("").transform(() => undefined)),
    emergencyContactName: z.string().trim().max(150).optional().or(z.literal("").transform(() => undefined)),
    emergencyContactPhone: phoneSchema,
    vulnerabilityCategory: z.nativeEnum(VulnerabilityCategory).optional(),
    allergies: z.string().trim().max(1000).optional().or(z.literal("").transform(() => undefined)),
    chronicConditions: z.string().trim().max(1000).optional().or(z.literal("").transform(() => undefined)),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided to update.",
  });

export type UpdatePatientInput = z.infer<typeof updatePatientSchema>;

export const listPatientsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
  search: z.string().trim().max(200).optional(),
});

export type ListPatientsQuery = z.infer<typeof listPatientsQuerySchema>;
