
import { Router } from "express";
import { staffController } from "../controllers/staff.controller";
import { authenticate } from "../middleware/authenticate";
import { requireRole } from "../middleware/requireRole";
import { ROLE_GROUPS } from "../config/rolePermissions";

export const staffRouter = Router();

staffRouter.use(
  authenticate,
  requireRole(...ROLE_GROUPS.systemAdministration)
);

staffRouter.get("/", staffController.list);
staffRouter.patch("/:id/status", staffController.updateStatus);
