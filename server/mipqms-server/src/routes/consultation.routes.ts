import { Router } from "express";
import { consultationController } from "../controllers/consultation.controller";
import { authenticate } from "../middleware/authenticate";
import { requireRole } from "../middleware/requireRole";
import { validateBody } from "../middleware/validate";
import { ROLE_GROUPS } from "../config/rolePermissions";
import { updateConsultationSchema, completeConsultationSchema } from "../validators/consultation.validators";

export const consultationRouter = Router();

/**
 * All routes require authentication. Read (DOCTOR, ADMIN) vs. write
 * (DOCTOR only) is split per-route rather than a single router-wide
 * gate — see config/rolePermissions.ts for the full reasoning behind
 * excluding ADMIN from writes here, unlike every other clinical write
 * group in this codebase.
 *
 * Deliberately absent: DELETE /api/consultations/:id and any hard
 * delete of a QueueEntry. Consultation history is permanent — see
 * Phase13_Consultation_Queue_Closure.md, "No Hard Delete."
 *
 * Route naming mirrors the existing triage.routes.ts pattern
 * (`/queue/:queueEntryId` for the by-queue-entry lookup) rather than
 * inventing a new convention.
 */
consultationRouter.use(authenticate);

consultationRouter.get("/queue/:queueEntryId", requireRole(...ROLE_GROUPS.consultationRead), consultationController.getByQueueEntry);
consultationRouter.get("/patient/:patientId", requireRole(...ROLE_GROUPS.consultationRead), consultationController.getPatientHistory);
consultationRouter.get("/:id", requireRole(...ROLE_GROUPS.consultationRead), consultationController.getById);

consultationRouter.post("/queue/:queueEntryId/start", requireRole(...ROLE_GROUPS.consultationWrite), consultationController.start);
consultationRouter.patch(
  "/:id",
  requireRole(...ROLE_GROUPS.consultationWrite),
  validateBody(updateConsultationSchema),
  consultationController.update
);
consultationRouter.post(
  "/:id/complete",
  requireRole(...ROLE_GROUPS.consultationWrite),
  validateBody(completeConsultationSchema),
  consultationController.complete
);
