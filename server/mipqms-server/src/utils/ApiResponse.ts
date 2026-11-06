import { Response } from "express";
import { ApiSuccessResponse } from "../types/api";

/**
 * Wraps every successful response in the shared { success, message, data }
 * envelope. Use this instead of calling res.json() directly so every
 * endpoint added in later phases stays consistent automatically.
 */
export class ApiResponse {
  static success<T>(
    res: Response,
    data: T,
    message = "Success",
    statusCode = 200,
    meta?: Record<string, unknown>
  ): Response<ApiSuccessResponse<T>> {
    return res.status(statusCode).json({
      success: true,
      message,
      data,
      ...(meta ? { meta } : {}),
    });
  }
}
