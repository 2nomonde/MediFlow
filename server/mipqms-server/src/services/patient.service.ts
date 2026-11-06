import { Prisma, Patient } from "@prisma/client";
import { prisma } from "../config/database";
import { ApiError } from "../utils/ApiError";
import type {
  CreatePatientInput,
  UpdatePatientInput,
  ListPatientsQuery,
} from "../validators/patient.validators";

const MAX_PATIENT_NUMBER_RETRIES = 5;

/**
 * Generates the next patient number for the current year in the form
 * MIP-<year>-<6-digit sequence>, e.g. MIP-2026-000001.
 *
 * No generation mechanism was defined in Phases 1–6 for `patientNumber`
 * (it exists in the Phase 2 schema as a required, unique String with no
 * documented format), so Phase 7 defines one here — deterministic,
 * human-readable, and year-scoped so the sequence naturally resets
 * annually rather than growing indefinitely.
 *
 * Collision-resistance: the count-based number is a best-effort guess
 * under concurrent registrations (two requests could count the same
 * total and generate the same candidate). Correctness doesn't rely on
 * that guess alone — `patientNumber` already has a real database unique
 * constraint from Phase 2, so `createPatient` below catches a P2002 on
 * this specific field and retries with a freshly recomputed number, up
 * to MAX_PATIENT_NUMBER_RETRIES times. The database constraint is the
 * actual source of correctness; this function just picks a good first
 * guess.
 */
async function generatePatientNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `MIP-${year}-`;
  const countThisYear = await prisma.patient.count({
    where: { patientNumber: { startsWith: prefix } },
  });
  const sequence = String(countThisYear + 1).padStart(6, "0");
  return `${prefix}${sequence}`;
}

function isUniqueConstraintOn(error: unknown, field: string): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002" &&
    (error.meta?.target as string[] | undefined)?.includes(field) === true
  );
}

/**
 * Duplicate-detection rule (documented per the Phase 7 requirement):
 *
 * 1. STRONG match — `idOrPassportNumber`. If the incoming registration
 *    includes one and it matches an existing patient's, that is treated
 *    as the same person and registration is refused with 409. This is
 *    also enforced at the database level (unique constraint), so this
 *    check exists for a clean error message, not as the only safeguard.
 *
 * 2. FALLBACK match — only when no `idOrPassportNumber` was supplied.
 *    firstName + lastName + dateOfBirth match an existing patient AND
 *    at least one contact detail (phone OR email) also matches. Name and
 *    date of birth alone are deliberately NOT sufficient (the Phase 7
 *    requirement explicitly forbids rejecting on name alone, and two
 *    real people can share a name and even a birth date) — a matching
 *    contact detail on top of that is the deterministic, explainable
 *    line this system draws between "worth flagging" and "not enough
 *    evidence to refuse a legitimate registration."
 *
 * Anything weaker than that (e.g. name match only, or name + DOB with no
 * contact match) is allowed through — the registration proceeds rather
 * than silently blocking a possibly-legitimate distinct person.
 */
async function findBlockingDuplicate(
  input: CreatePatientInput,
): Promise<Patient | null> {
  // 1. ID/passport is a strong unique identifier.
  if (input.idOrPassportNumber) {
    return prisma.patient.findUnique({
      where: {
        idOrPassportNumber: input.idOrPassportNumber,
      },
    });
  }

  // 2. Phone number must not already belong to another patient.
  if (input.phone) {
    const duplicateByPhone = await prisma.patient.findFirst({
      where: {
        phone: input.phone,
      },
    });

    if (duplicateByPhone) {
      return duplicateByPhone;
    }
  }

  // 3. Email address must not already belong to another patient.
  if (input.email) {
    const duplicateByEmail = await prisma.patient.findFirst({
      where: {
        email: input.email,
      },
    });

    if (duplicateByEmail) {
      return duplicateByEmail;
    }
  }

  // 4. If there is no strong/contact identifier, do not block
  // a patient based only on name and date of birth.
  if (!input.phone && !input.email) {
    return null;
  }

  // 5. Preserve the existing name + DOB matching as an additional
  // duplicate check when contact information is supplied.
  return prisma.patient.findFirst({
    where: {
      firstName: {
        equals: input.firstName,
        mode: "insensitive",
      },
      lastName: {
        equals: input.lastName,
        mode: "insensitive",
      },
      dateOfBirth: input.dateOfBirth,
    },
  });
}

export const patientService = {
  async list(query: ListPatientsQuery) {
    const { page, pageSize, search } = query;

    const where: Prisma.PatientWhereInput = search
      ? {
          OR: [
            { patientNumber: { contains: search, mode: "insensitive" } },
            { firstName: { contains: search, mode: "insensitive" } },
            { lastName: { contains: search, mode: "insensitive" } },
            { idOrPassportNumber: { contains: search, mode: "insensitive" } },
            { phone: { contains: search, mode: "insensitive" } },
          ],
        }
      : {};

    const [total, patients] = await prisma.$transaction([
      prisma.patient.count({ where }),
      prisma.patient.findMany({
        where,
        // Deterministic ordering: lastName/firstName matches the Phase 2
        // index, with id as a stable tiebreaker so paging never
        // reshuffles rows that sort identically.
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }, { id: "asc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return {
      patients,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    };
  },

  async getById(id: string): Promise<Patient> {
    const patient = await prisma.patient.findUnique({ where: { id } });
    if (!patient) {
      throw ApiError.notFound("Patient not found.");
    }
    return patient;
  },

  async create(input: CreatePatientInput): Promise<Patient> {
    const duplicate = await findBlockingDuplicate(input);
    if (duplicate) {
      throw ApiError.conflict(
        "A patient with this identification information already exists.",
        { existingPatientId: duplicate.id, existingPatientNumber: duplicate.patientNumber }
      );
    }

    let lastError: unknown;
    for (let attempt = 0; attempt < MAX_PATIENT_NUMBER_RETRIES; attempt++) {
      const patientNumber = await generatePatientNumber();
      try {
        return await prisma.patient.create({
          data: { ...input, patientNumber },
        });
      } catch (error) {
        if (isUniqueConstraintOn(error, "idOrPassportNumber")) {
          // A concurrent request registered the same ID/passport number
          // between our pre-check and this write — same conflict as
          // above, just caught by the database instead of our earlier
          // read.
          throw ApiError.conflict("A patient with this identification information already exists.");
        }
        if (isUniqueConstraintOn(error, "patientNumber")) {
          lastError = error;
          continue; // retry with a freshly recomputed number
        }
        throw error;
      }
    }

    console.error("Failed to generate a unique patient number after retries:", lastError);
    throw ApiError.internal("Could not generate a patient number. Please try again.");
  },

  async update(id: string, input: UpdatePatientInput): Promise<Patient> {
    await this.getById(id); // 404 if missing, before attempting the write

    try {
      return await prisma.patient.update({ where: { id }, data: input });
    } catch (error) {
      if (isUniqueConstraintOn(error, "idOrPassportNumber")) {
        throw ApiError.conflict("Another patient already uses this identification number.");
      }
      throw error;
    }
  },
};
