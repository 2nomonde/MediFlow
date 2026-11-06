import { Router } from "express";
import { UserRole } from "@prisma/client";
import { authController } from "../controllers/auth.controller";
import { authenticate } from "../middleware/authenticate";
import { requireRole } from "../middleware/requireRole";
import { validateBody } from "../middleware/validate";
import { registerSchema, loginSchema } from "../validators/auth.validators";

export const authRouter = Router();

/**
 * POST /api/auth/register
 * Admin-only — creates a new staff account (receptionist, nurse, doctor,
 * pharmacist, or another admin). There is no public self-registration in
 * M-IPQMS. The very first administrator account is created by the
 * database seed script (prisma/seed.ts), not through this endpoint —
 * see the Phase 4 documentation for why.
 */
authRouter.post(
  "/register",
  authenticate,
  requireRole(UserRole.ADMIN),
  validateBody(registerSchema),
  authController.register
);

/** POST /api/auth/login — public. */
authRouter.post("/login", validateBody(loginSchema), authController.login);

/** GET /api/auth/me — any authenticated, active user. */
authRouter.get("/me", authenticate, authController.me);

/** POST /api/auth/logout — any authenticated user. */
authRouter.post("/logout", authenticate, authController.logout);
