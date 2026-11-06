import { Router } from "express";
import { patientController } from "../controllers/patient.controller";
import { authenticate } from "../middleware/authenticate";
import { requireRole } from "../middleware/requireRole";
import { validateBody, validateQuery } from "../middleware/validate";
import { ROLE_GROUPS } from "../config/rolePermissions";
import {
  createPatientSchema,
  updatePatientSchema,
  listPatientsQuerySchema,
} from "../validators/patient.validators";

export const patientRouter = Router();

/**
 * Every route requires authentication and RECEPTIONIST or ADMIN — per
 * the Phase 7 requirement, NURSE/DOCTOR/PHARMACIST get no patient-
 * management access at all (not even read), and this is the actual
 * security boundary; the frontend hiding the nav item is UX only.
 *
 * Deliberately absent: DELETE /api/patients/:id. Patient records are
 * never hard-deleted, and the Phase 2 Patient model has no active/
 * inactive field to soft-delete against either — see
 * Phase7_Patient_Management.md, "No Hard Delete" section, for why that
 * was not silently added here.
 */
patientRouter.use(authenticate, requireRole(...ROLE_GROUPS.patientRegistrationAndAppointments));

patientRouter.get("/", validateQuery(listPatientsQuerySchema), patientController.list);
patientRouter.get("/:id", patientController.getById);
patientRouter.post("/", validateBody(createPatientSchema), patientController.create);
patientRouter.patch("/:id", validateBody(updatePatientSchema), patientController.update);
