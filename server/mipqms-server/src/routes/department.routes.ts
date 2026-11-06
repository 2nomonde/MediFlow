import { Router } from "express";
import { prisma } from "../config/database";
import { authenticate } from "../middleware/authenticate";
import { ApiResponse } from "../utils/ApiResponse";
import { asyncHandler } from "../utils/asyncHandler";

export const departmentRouter = Router();

/**
 * GET /api/departments — read-only, any authenticated user.
 *
 * This is NOT a Department management module (create/edit/delete
 * departments is Administration, a future phase). It exists solely
 * because Phase 9 check-in needs a department to select, and nothing
 * before this phase exposed departments to the frontend at all. Low-
 * sensitivity reference data (just names), so gated by authentication
 * only rather than a specific role list.
 */
departmentRouter.get(
  "/",
  authenticate,
  asyncHandler(async (_req, res) => {
    const departments = await prisma.department.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
    ApiResponse.success(res, departments, "Departments retrieved.");
  })
);
