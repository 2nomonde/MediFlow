import { Router } from "express";
import { prescriptionController } from "../controllers/prescription.controller";
import { authenticate } from "../middleware/authenticate";
import { requireRole } from "../middleware/requireRole";
import { validateBody } from "../middleware/validate";
import { ROLE_GROUPS } from "../config/rolePermissions";
import { createPrescriptionSchema } from "../validators/prescription.validators";

export const prescriptionRouter = Router();

/**
 * All routes require authentication. Read (DOCTOR, PHARMACIST, ADMIN)
 * vs. write (DOCTOR) vs. dispense (PHARMACIST) is split per-route — see
 * config/rolePermissions.ts for the full reasoning. Route naming
 * mirrors the existing triage.routes.ts / consultation.routes.ts
 * pattern (`/consultation/:consultationId` for the by-consultation
 * lookup, an action route for dispensing) rather than inventing a new
 * convention.
 *
 * Deliberately absent: DELETE /api/prescriptions/:id and any
 * PATCH/update route. Prescription history is permanent once created —
 * see Phase14_Prescriptions.md, "No Hard Delete / No Post-Creation Edit."
 */
prescriptionRouter.use(authenticate);

prescriptionRouter.get("/pending", requireRole(...ROLE_GROUPS.prescriptionRead), prescriptionController.listPending);
prescriptionRouter.get(
  "/consultation/:consultationId",
  requireRole(...ROLE_GROUPS.prescriptionRead),
  prescriptionController.listByConsultation
);
prescriptionRouter.get("/:id", requireRole(...ROLE_GROUPS.prescriptionRead), prescriptionController.getById);

prescriptionRouter.post(
  "/consultation/:consultationId",
  requireRole(...ROLE_GROUPS.prescriptionWrite),
  validateBody(createPrescriptionSchema),
  prescriptionController.create
);

prescriptionRouter.post("/:id/dispense", requireRole(...ROLE_GROUPS.prescriptionDispense), prescriptionController.dispense);
