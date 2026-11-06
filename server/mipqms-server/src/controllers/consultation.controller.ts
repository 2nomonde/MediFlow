import { Request, Response } from "express";
import { consultationService } from "../services/consultation.service";
import { ApiResponse } from "../utils/ApiResponse";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/ApiError";
import type { UpdateConsultationInput, CompleteConsultationInput } from "../validators/consultation.validators";

export const consultationController = {
  /** POST /api/consultations/queue/:queueEntryId/start */
  start: asyncHandler(async (req: Request, res: Response) => {
    const { queueEntryId } = req.params;
    if (!queueEntryId) throw ApiError.badRequest("Queue entry id is required.");
    // req.user is guaranteed set — this route sits behind `authenticate`.
    const consultation = await consultationService.start(queueEntryId, req.user!.id, req.user!.role);
    ApiResponse.success(res, consultation, "Consultation started.", 201);
  }),

  /** PATCH /api/consultations/:id */
  update: asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    if (!id) throw ApiError.badRequest("Consultation id is required.");
    const input = req.body as UpdateConsultationInput;
    const consultation = await consultationService.update(id, input);
    ApiResponse.success(res, consultation, "Consultation updated.");
  }),

  /** POST /api/consultations/:id/complete */
  complete: asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    if (!id) throw ApiError.badRequest("Consultation id is required.");
    const input = req.body as CompleteConsultationInput;
   const consultation = await consultationService.complete(id, input, req.user!.role);
    ApiResponse.success(res, consultation, "Consultation completed.");
  }),

  /** GET /api/consultations/:id */
  getById: asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    if (!id) throw ApiError.badRequest("Consultation id is required.");
    const consultation = await consultationService.getById(id);
    ApiResponse.success(res, consultation, "Consultation retrieved.");
  }),

  /** GET /api/consultations/queue/:queueEntryId */
  getByQueueEntry: asyncHandler(async (req: Request, res: Response) => {
    const { queueEntryId } = req.params;
    if (!queueEntryId) throw ApiError.badRequest("Queue entry id is required.");
    const consultation = await consultationService.getByQueueEntry(queueEntryId);
    ApiResponse.success(res, consultation, "Consultation retrieved.");
  }),

  /** GET /api/consultations/patient/:patientId */
  getPatientHistory: asyncHandler(async (req: Request, res: Response) => {
    const { patientId } = req.params;
    if (!patientId) throw ApiError.badRequest("Patient id is required.");
    const history = await consultationService.getPatientHistory(patientId);
    ApiResponse.success(res, history, "Consultation history retrieved.");
  }),
};
