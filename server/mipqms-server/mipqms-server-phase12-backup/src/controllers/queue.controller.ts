import { Request, Response } from "express";
import { queueService } from "../services/queue.service";
import { ApiResponse } from "../utils/ApiResponse";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/ApiError";
import type { CheckInInput, ListQueueQuery, UpdateQueueStatusInput, CallNextInput } from "../validators/queue.validators";

export const queueController = {
  /** GET /api/queue?status=&departmentId=&page=&pageSize= */
  list: asyncHandler(async (req: Request, res: Response) => {
    const query = req.query as unknown as ListQueueQuery;
    // req.user is guaranteed set — this route sits behind `authenticate`.
    // The viewer's role determines how much priority detail comes back
    // (see queue.service.ts's projectPriorityFields) — RECEPTIONIST gets
    // the score, not the full breakdown/override detail.
    const { entries, pagination } = await queueService.list(query, req.user!.role);
    ApiResponse.success(res, entries, "Queue retrieved.", 200, { pagination });
  }),

  /** GET /api/queue/:id */
  getById: asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    if (!id) throw ApiError.badRequest("Queue entry id is required.");
    const entry = await queueService.getById(id, req.user!.role);
    ApiResponse.success(res, entry, "Queue entry retrieved.");
  }),

  /** POST /api/queue/check-in */
  checkIn: asyncHandler(async (req: Request, res: Response) => {
    const input = req.body as CheckInInput;
    const entry = await queueService.checkIn(input, req.user!.role);
    ApiResponse.success(res, entry, "Patient checked in successfully.", 201);
  }),

  /** PATCH /api/queue/:id/status */
  updateStatus: asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    if (!id) throw ApiError.badRequest("Queue entry id is required.");
    const { status } = req.body as UpdateQueueStatusInput;
    const entry = await queueService.updateStatus(id, status, req.user!.role);
    ApiResponse.success(res, entry, `Queue entry updated to ${status}.`);
  }),

  /** POST /api/queue/call-next */
  callNext: asyncHandler(async (req: Request, res: Response) => {
    const { departmentId } = req.body as CallNextInput;
    const entry = await queueService.callNext(departmentId, req.user!.role);
    ApiResponse.success(res, entry, "Next patient called.");
  }),
};
