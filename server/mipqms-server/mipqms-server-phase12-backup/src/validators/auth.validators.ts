import { z } from "zod";
import { UserRole } from "@prisma/client";

/**
 * Only an authenticated ADMIN can hit the register endpoint (enforced in
 * routes/auth.routes.ts via requireRole), so `role` is a required field
 * here — the admin creating the account chooses what the new staff
 * member's role is.
 */
export const registerSchema = z.object({
  email: z.string().email("A valid email is required"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  role: z.nativeEnum(UserRole, { errorMap: () => ({ message: "A valid role is required" }) }),
  departmentId: z.string().uuid("departmentId must be a valid id").optional(),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().email("A valid email is required"),
  password: z.string().min(1, "Password is required"),
});
export type LoginInput = z.infer<typeof loginSchema>;
