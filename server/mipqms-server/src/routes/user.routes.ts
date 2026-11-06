import { Router } from "express";
import { UserRole } from "@prisma/client";
import { prisma } from "../config/database";
import { authenticate } from "../middleware/authenticate";
import { ApiResponse } from "../utils/ApiResponse";
import { ApiError } from "../utils/ApiError";
import { asyncHandler } from "../utils/asyncHandler";

export const userRouter = Router();

/**
 * GET /api/users?role=DOCTOR — read-only, any authenticated user.
 *
 * New in this phase, added for the same reason department.routes.ts's
 * GET /api/departments was added in Phase 9: the Appointments module
 * needs to let a receptionist pick a doctor, and nothing before this
 * phase exposed staff to the frontend at all (every existing module
 * that needs "the doctor" uses the logged-in user themselves —
 * Consultation, Prescription — never a selectable list). This is NOT a
 * Staff Management module (creating/editing/deactivating accounts is
 * Administration, a future phase); it only ever returns the minimum
 * non-sensitive fields (id, name) for active staff, filtered by role,
 * and only ADMIN/clinical-staff-selection scenarios like this one are
 * expected to call it. No email, no passwordHash, no department.
 *
 * `role` is required and validated against the real UserRole enum —
 * there is no reason to ever return every user to any authenticated
 * caller regardless of role, mirroring the project's general
 * minimum-necessary-data principle (see patient.service.ts's response
 * shaping, queue.service.ts's role-based field projection, etc.).
 */
userRouter.get(
  "/",
  authenticate,
  asyncHandler(async (req, res) => {
    const { role } = req.query;
    if (typeof role !== "string" || !Object.values(UserRole).includes(role as UserRole)) {
      throw ApiError.badRequest("A valid role query parameter is required.");
    }

    const users = await prisma.user.findMany({
      where: { role: role as UserRole, isActive: true },
      select: { id: true, firstName: true, lastName: true, role: true },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    });
    ApiResponse.success(res, users, "Users retrieved.");
  })
);
