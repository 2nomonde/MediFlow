
import { Request, Response } from "express";
import { UserRole } from "@prisma/client";
import { staffService } from "../services/staff.service";
import { ApiResponse } from "../utils/ApiResponse";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/ApiError";

export const staffController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const role = req.query.role;

    if (
      role !== undefined &&
      (typeof role !== "string" ||
        !Object.values(UserRole).includes(role as UserRole))
    ) {
      throw ApiError.badRequest("A valid staff role is required.");
    }

    const staff = await staffService.list(role as UserRole | undefined);
    ApiResponse.success(res, staff, "Staff accounts retrieved.");
  }),

  updateStatus: asyncHandler(async (req: Request, res: Response) => {
    const { isActive } = req.body;

    if (typeof isActive !== "boolean") {
      throw ApiError.badRequest("isActive must be true or false.");
    }

    const actingUserId = req.user!.id;
    const staff = await staffService.updateStatus(
      req.params.id,
      isActive,
      actingUserId
    );

    ApiResponse.success(
      res,
      staff,
      `Staff account ${isActive ? "activated" : "deactivated"} successfully.`
    );
  }),
};
