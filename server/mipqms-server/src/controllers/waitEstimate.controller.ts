import { Request, Response } from "express";
import { waitEstimateService } from "../services/waitEstimate.service";
import { ApiResponse } from "../utils/ApiResponse";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/ApiError";

export const waitEstimateController = {
  /** GET /api/queue/:id/estimate — read-only, see waitEstimate.service.ts. */
  getEstimate: asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    if (!id) throw ApiError.badRequest("Queue entry id is required.");
    const estimate = await waitEstimateService.getEstimate(id);
    ApiResponse.success(res, estimate, "Waiting-time estimate calculated.");
  }),
};
