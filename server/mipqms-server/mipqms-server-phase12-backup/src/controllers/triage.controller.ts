import { Request, Response } from "express";
import { triageService } from "../services/triage.service";
import { ApiResponse } from "../utils/ApiResponse";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/ApiError";
import type { CreateTriageInput, UpdateTriageInput, ListTriageQuery } from "../validators/triage.validators";

export const triageController = {
  /** GET /api/triage/pending */
  listPending: asyncHandler(async (_req: Request, res: Response) => {
    const entries = await triageService.listPending();
    ApiResponse.success(res, entries, "Patients awaiting triage retrieved.");
  }),

  /** GET /api/triage?priorityLevel=&page=&pageSize= */
  list: asyncHandler(async (req: Request, res: Response) => {
    const query = req.query as unknown as ListTriageQuery;
    const { records, pagination } = await triageService.list(query);
    ApiResponse.success(res, records, "Triage records retrieved.", 200, { pagination });
  }),

  /** GET /api/triage/:id */
  getById: asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    if (!id) throw ApiError.badRequest("Triage id is required.");
    const record = await triageService.getById(id);
    ApiResponse.success(res, record, "Triage record retrieved.");
  }),

  /** GET /api/triage/queue/:queueEntryId */
  getByQueueEntry: asyncHandler(async (req: Request, res: Response) => {
    const { queueEntryId } = req.params;
    if (!queueEntryId) throw ApiError.badRequest("Queue entry id is required.");
    const record = await triageService.getByQueueEntry(queueEntryId);
    ApiResponse.success(res, record, "Triage record retrieved.");
  }),

  /** POST /api/triage */
  create: asyncHandler(async (req: Request, res: Response) => {
    const input = req.body as CreateTriageInput;
    // req.user is guaranteed set — this route sits behind `authenticate`.
    const record = await triageService.create(input, req.user!.id);
    ApiResponse.success(res, record, "Triage recorded successfully.", 201);
  }),

  /** PATCH /api/triage/:id */
  update: asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    if (!id) throw ApiError.badRequest("Triage id is required.");
    const input = req.body as UpdateTriageInput;
    const record = await triageService.update(id, input);
    ApiResponse.success(res, record, "Triage record updated successfully.");
  }),
};
