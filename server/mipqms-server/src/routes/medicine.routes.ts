import { Router } from "express";
import { prisma } from "../config/database";
import { authenticate } from "../middleware/authenticate";
import { requireRole } from "../middleware/requireRole";
import { ROLE_GROUPS } from "../config/rolePermissions";
import { ApiResponse } from "../utils/ApiResponse";
import { asyncHandler } from "../utils/asyncHandler";

export const medicineRouter = Router();

/**
 * GET /api/medicines?search= — read-only, mirrors the exact pattern
 * `department.routes.ts` established in Phase 9 for the same reason:
 * nothing before Phase 14 exposed Medicine to the frontend at all, and
 * a doctor needs to select an existing medicine when writing a
 * prescription. This is NOT a Medicine management module — no create/
 * edit/delete here, per the brief's explicit instruction not to let
 * doctors create medicines from the prescription screen. Gated to
 * `prescriptionRead` (DOCTOR, PHARMACIST, ADMIN) rather than any
 * authenticated user, since medicine names/stock are more
 * operationally specific than department names.
 */
medicineRouter.get(
  "/",
  authenticate,
  requireRole(...ROLE_GROUPS.prescriptionRead),
  asyncHandler(async (req, res) => {
    const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
    const medicines = await prisma.medicine.findMany({
      where: search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { genericName: { contains: search, mode: "insensitive" } },
            ],
          }
        : undefined,
      select: { id: true, name: true, genericName: true, dosageForm: true, strength: true, stockQuantity: true },
      orderBy: { name: "asc" },
      take: 50,
    });
    ApiResponse.success(res, medicines, "Medicines retrieved.");
  })
);
