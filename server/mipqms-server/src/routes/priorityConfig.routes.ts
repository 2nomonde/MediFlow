import { Router } from "express";
import { priorityConfigController } from "../controllers/priorityConfig.controller";
import { authenticate } from "../middleware/authenticate";
import { requireRole } from "../middleware/requireRole";
import { validateBody } from "../middleware/validate";
import { ROLE_GROUPS } from "../config/rolePermissions";
import { updatePriorityConfigSchema } from "../validators/priorityConfig.validators";

export const priorityConfigRouter = Router();

/** Admin-only, per the Phase 11 brief — configuring the scoring formula is system administration, not a clinical action. */
priorityConfigRouter.use(authenticate, requireRole(...ROLE_GROUPS.priorityConfigManage));

priorityConfigRouter.get("/", priorityConfigController.getActive);
priorityConfigRouter.patch("/", validateBody(updatePriorityConfigSchema), priorityConfigController.updateActive);
