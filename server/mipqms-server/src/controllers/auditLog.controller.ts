import { Request, Response } from "express";
import { auditLogService } from "../services/auditLog.service";
import { ApiResponse } from "../utils/ApiResponse";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/ApiError";
import type { ListAuditLogsQuery } from "../validators/auditLog.validators";

export const auditLogController = {
  /** GET /api/audit-logs?action=&userId=&entityType=&dateFrom=&dateTo=&page=&pageSize= */
  list: asyncHandler(async (req: Request, res: Response) => {
    const query = req.query as unknown as ListAuditLogsQuery;
    const { items, pagination } = await auditLogService.list(query);
    ApiResponse.success(res, items, "Audit log entries retrieved.", 200, { pagination });
  }),

  /** GET /api/audit-logs/:id */
  getById: asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    if (!id) throw ApiError.badRequest("Audit log id is required.");
    const entry = await auditLogService.getById(id);
    ApiResponse.success(res, entry, "Audit log entry retrieved.");
  }),
};
