import { Router } from "express";
import { triageController } from "../controllers/triage.controller";
import { authenticate } from "../middleware/authenticate";
import { requireRole } from "../middleware/requireRole";
import { validateBody, validateQuery } from "../middleware/validate";
import { ROLE_GROUPS } from "../config/rolePermissions";
import { createTriageSchema, updateTriageSchema, listTriageQuerySchema } from "../validators/triage.validators";

export const triageRouter = Router();

/**
 * All routes require authentication. Read access (NURSE, DOCTOR, ADMIN)
 * vs. write access (NURSE, ADMIN only) is split per-route rather than a
 * single router-wide gate — RECEPTIONIST and PHARMACIST get no access
 * at all, matching "RECEPTIONIST must NOT have clinical triage editing
 * permissions" and "PHARMACIST: no triage editing access."
 *
 * Deliberately absent: DELETE /api/triage/:id. Triage history is
 * retained, not hard-deleted, per the Phase 10 brief.
 */
triageRouter.use(authenticate);

triageRouter.get("/pending", requireRole(...ROLE_GROUPS.triageRead), triageController.listPending);
triageRouter.get("/", requireRole(...ROLE_GROUPS.triageRead), validateQuery(listTriageQuerySchema), triageController.list);
triageRouter.get("/queue/:queueEntryId", requireRole(...ROLE_GROUPS.triageRead), triageController.getByQueueEntry);
triageRouter.get("/:id", requireRole(...ROLE_GROUPS.triageRead), triageController.getById);

triageRouter.post("/", requireRole(...ROLE_GROUPS.triageWrite), validateBody(createTriageSchema), triageController.create);
triageRouter.patch("/:id", requireRole(...ROLE_GROUPS.triageWrite), validateBody(updateTriageSchema), triageController.update);
