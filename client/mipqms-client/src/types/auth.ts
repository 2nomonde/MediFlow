/**
 * Mirrors the Prisma `UserRole` enum from the backend (Phase 2/4). Kept as
 * a plain union rather than importing from a shared package, since the
 * frontend and backend are separate projects in this architecture — see
 * Phase5_Frontend_Foundation.md for why that's a deliberate choice, not
 * an oversight.
 */
export type UserRole = "ADMIN" | "RECEPTIONIST" | "NURSE" | "DOCTOR" | "PHARMACIST";

/** Matches the SafeUser shape returned by the backend (passwordHash stripped). */
export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  isActive: boolean;
  departmentId: string | null;
  createdAt: string;
  updatedAt: string;
}
