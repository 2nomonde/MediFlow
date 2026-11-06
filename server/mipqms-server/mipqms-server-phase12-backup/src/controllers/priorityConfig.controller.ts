import { Request, Response } from "express";
import { priorityConfigService } from "../services/priorityConfig.service";
import { ApiResponse } from "../utils/ApiResponse";
import { asyncHandler } from "../utils/asyncHandler";
import type { UpdatePriorityConfigInput } from "../validators/priorityConfig.validators";

export const priorityConfigController = {
  /** GET /api/priority-config */
  getActive: asyncHandler(async (_req: Request, res: Response) => {
    const config = await priorityConfigService.getActive();
    ApiResponse.success(res, config, "Active priority configuration retrieved.");
  }),

  /** PATCH /api/priority-config */
  updateActive: asyncHandler(async (req: Request, res: Response) => {
    const input = req.body as UpdatePriorityConfigInput;
    // req.user is guaranteed set — this route sits behind `authenticate`.
    const config = await priorityConfigService.updateActive(input, req.user!.id);
    ApiResponse.success(res, config, "Priority configuration updated successfully.");
  }),
};
