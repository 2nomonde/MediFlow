/** Mirrors the Prisma `Gender` enum exactly (Phase 2 schema). */
export type Gender = "MALE" | "FEMALE" | "OTHER" | "UNSPECIFIED";

/** Mirrors the Prisma `VulnerabilityCategory` enum exactly (Phase 2 schema). */
export type VulnerabilityCategory = "NONE" | "ELDERLY" | "PREGNANT" | "CHILD" | "CHRONIC_CONDITION";

/**
 * Mirrors the Prisma `Patient` model exactly (Phase 2 schema) — every
 * field here has a matching column on the backend. Nothing invented,
 * nothing renamed. Optional/nullable string fields are `string | null`
 * to match what the JSON API actually returns for an unset Prisma
 * `String?` column.
 */
export interface Patient {
  id: string;
  patientNumber: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string; // ISO date string over the wire
  gender: Gender;
  idOrPassportNumber: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  vulnerabilityCategory: VulnerabilityCategory;
  allergies: string | null;
  chronicConditions: string | null;
  registrationDate: string;
  createdAt: string;
  updatedAt: string;
}

/** Fields the backend accepts on POST /api/patients — patientNumber is server-generated. */
export interface CreatePatientInput {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: Gender;
  idOrPassportNumber?: string;
  phone?: string;
  email?: string;
  address?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  vulnerabilityCategory?: VulnerabilityCategory;
  allergies?: string;
  chronicConditions?: string;
}

/** Same allow-list as create, all optional — matches the backend's PATCH allow-list exactly. */
export type UpdatePatientInput = Partial<CreatePatientInput>;

export interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}
