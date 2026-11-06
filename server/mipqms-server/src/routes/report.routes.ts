import { Router } from "express";
import { reportController } from "../controllers/report.controller";
import { authenticate } from "../middleware/authenticate";
import { requireRole } from "../middleware/requireRole";
import { validateQuery } from "../middleware/validate";
import { ROLE_GROUPS } from "../config/rolePermissions";
import { reportSummaryQuerySchema } from "../validators/report.validators";

export const reportRouter = Router();

/** ADMIN only. Read-only — no write route exists on this router. */
reportRouter.use(authenticate, requireRole(...ROLE_GROUPS.reportRead));

reportRouter.get("/summary", validateQuery(reportSummaryQuerySchema), reportController.getSummary);
