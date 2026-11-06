import { Router } from "express";
import { auditLogController } from "../controllers/auditLog.controller";
import { authenticate } from "../middleware/authenticate";
import { requireRole } from "../middleware/requireRole";
import { validateQuery } from "../middleware/validate";
import { ROLE_GROUPS } from "../config/rolePermissions";
import { listAuditLogsQuerySchema } from "../validators/auditLog.validators";

export const auditLogRouter = Router();

/**
 * ADMIN only, per the brief's explicit default. No write route exists
 * here at all — this router only ever reads the AuditLog table that
 * other services (priority.service.ts, priorityConfig.service.ts,
 * prescription.service.ts) already write to.
 */
auditLogRouter.use(authenticate, requireRole(...ROLE_GROUPS.auditRead));

auditLogRouter.get("/", validateQuery(listAuditLogsQuerySchema), auditLogController.list);
auditLogRouter.get("/:id", auditLogController.getById);
