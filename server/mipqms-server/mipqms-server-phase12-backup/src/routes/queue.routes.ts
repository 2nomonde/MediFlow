import { Router } from "express";
import { queueController } from "../controllers/queue.controller";
import { priorityController } from "../controllers/priority.controller";
import { waitEstimateController } from "../controllers/waitEstimate.controller";
import { authenticate } from "../middleware/authenticate";
import { requireRole } from "../middleware/requireRole";
import { validateBody, validateQuery } from "../middleware/validate";
import { ROLE_GROUPS } from "../config/rolePermissions";
import {
  checkInSchema,
  updateQueueStatusSchema,
  callNextSchema,
  listQueueQuerySchema,
} from "../validators/queue.validators";
import { overridePrioritySchema } from "../validators/priorityOverride.validators";

export const queueRouter = Router();

/**
 * Every route requires authentication. Role gating is finer-grained than
 * a single `router.use(...)` this time (unlike patients), since read,
 * check-in, and clinical actions have different allowed roles — see
 * config/rolePermissions.ts for the reasoning behind each group.
 *
 * Deliberately absent: DELETE /api/queue/:id. Queue history is never
 * removed — see Phase9_Queue_Management.md, "No Hard Delete."
 */
queueRouter.use(authenticate);

queueRouter.get("/", requireRole(...ROLE_GROUPS.queueRead), validateQuery(listQueueQuerySchema), queueController.list);

queueRouter.post(
  "/check-in",
  requireRole(...ROLE_GROUPS.queueCheckIn),
  validateBody(checkInSchema),
  queueController.checkIn
);

queueRouter.post(
  "/call-next",
  requireRole(...ROLE_GROUPS.queueClinicalAction),
  validateBody(callNextSchema),
  queueController.callNext
);

queueRouter.get("/:id", requireRole(...ROLE_GROUPS.queueRead), queueController.getById);

queueRouter.patch(
  "/:id/status",
  requireRole(...ROLE_GROUPS.queueStatusUpdate),
  validateBody(updateQueueStatusSchema),
  queueController.updateStatus
);

/**
 * Phase 11 — priority sub-resource of an existing queue entry, added to
 * this same router rather than a second queue endpoint, per the Phase
 * 11 brief ("update the existing queue endpoint rather than creating a
 * second queue endpoint"). Read/recalculate is clinical-context
 * (NURSE/DOCTOR/ADMIN); RECEPTIONIST already sees the plain score via
 * GET /api/queue itself (queueRead) but not this detail/action surface.
 */
queueRouter.get("/:id/priority", requireRole(...ROLE_GROUPS.priorityView), priorityController.getBreakdown);
queueRouter.post("/:id/priority/recalculate", requireRole(...ROLE_GROUPS.priorityView), priorityController.recalculate);
queueRouter.post(
  "/:id/priority/override",
  requireRole(...ROLE_GROUPS.priorityOverride),
  validateBody(overridePrioritySchema),
  priorityController.override
);

/**
 * Phase 12 — waiting-time estimate sub-resource, same router as the
 * existing queue and priority endpoints. Read-only, so it uses the same
 * `queueRead` role group as the rest of the queue view (RECEPTIONIST,
 * NURSE, DOCTOR, ADMIN) — anyone who can see the queue can see an
 * estimate for an entry in it.
 */
queueRouter.get("/:id/estimate", requireRole(...ROLE_GROUPS.queueRead), waitEstimateController.getEstimate);
