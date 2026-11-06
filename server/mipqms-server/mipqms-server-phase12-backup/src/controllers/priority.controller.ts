import { Request, Response } from "express";
import { priorityService } from "../services/priority.service";
import { ApiResponse } from "../utils/ApiResponse";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/ApiError";
import type { OverridePriorityInput } from "../validators/priorityOverride.validators";

export const priorityController = {
  /** GET /api/queue/:id/priority */
  getBreakdown: asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    if (!id) throw ApiError.badRequest("Queue entry id is required.");
    const info = await priorityService.getBreakdown(id);
    ApiResponse.success(res, info, "Priority breakdown retrieved.");
  }),

  /** POST /api/queue/:id/priority/recalculate */
  recalculate: asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    if (!id) throw ApiError.badRequest("Queue entry id is required.");
    const info = await priorityService.recalculateAndPersist(id);
    ApiResponse.success(res, info, "Priority recalculated.");
  }),

  /** POST /api/queue/:id/priority/override */
  override: asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    if (!id) throw ApiError.badRequest("Queue entry id is required.");
    const input = req.body as OverridePriorityInput;
    // req.user is guaranteed set — this route sits behind `authenticate`.
    const info = await priorityService.override(id, input, { id: req.user!.id, role: req.user!.role });
    ApiResponse.success(res, info, "Priority override recorded.");
  }),
};
