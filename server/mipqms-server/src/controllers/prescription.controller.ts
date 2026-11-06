import { Request, Response } from "express";
import { prescriptionService } from "../services/prescription.service";
import { ApiResponse } from "../utils/ApiResponse";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/ApiError";
import type { CreatePrescriptionInput } from "../validators/prescription.validators";

export const prescriptionController = {
  /** POST /api/prescriptions/consultation/:consultationId */
  create: asyncHandler(async (req: Request, res: Response) => {
    const { consultationId } = req.params;
    if (!consultationId) throw ApiError.badRequest("Consultation id is required.");
    const input = req.body as CreatePrescriptionInput;
    // req.user is guaranteed set — this route sits behind `authenticate`.
    const { prescription, stockWarning } = await prescriptionService.create(consultationId, req.user!.id, input);
    ApiResponse.success(res, { prescription, stockWarning }, "Prescription created successfully.", 201);
  }),

  /** GET /api/prescriptions/consultation/:consultationId */
  listByConsultation: asyncHandler(async (req: Request, res: Response) => {
    const { consultationId } = req.params;
    if (!consultationId) throw ApiError.badRequest("Consultation id is required.");
    const prescriptions = await prescriptionService.listByConsultation(consultationId);
    ApiResponse.success(res, prescriptions, "Prescriptions retrieved.");
  }),

  /** GET /api/prescriptions/pending */
  listPending: asyncHandler(async (_req: Request, res: Response) => {
    const prescriptions = await prescriptionService.listPending();
    ApiResponse.success(res, prescriptions, "Pending prescriptions retrieved.");
  }),

  /** GET /api/prescriptions/:id */
  getById: asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    if (!id) throw ApiError.badRequest("Prescription id is required.");
    const prescription = await prescriptionService.getById(id);
    ApiResponse.success(res, prescription, "Prescription retrieved.");
  }),

  /** POST /api/prescriptions/:id/dispense */
  dispense: asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    if (!id) throw ApiError.badRequest("Prescription id is required.");
    const prescription = await prescriptionService.dispense(id, req.user!.id);
    ApiResponse.success(res, prescription, "Prescription dispensed successfully.");
  }),
};
