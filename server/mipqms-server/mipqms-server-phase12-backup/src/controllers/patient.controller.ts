import { Request, Response } from "express";
import { patientService } from "../services/patient.service";
import { ApiResponse } from "../utils/ApiResponse";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/ApiError";
import type { ListPatientsQuery, CreatePatientInput, UpdatePatientInput } from "../validators/patient.validators";

export const patientController = {
  /** GET /api/patients?page=&pageSize=&search= */
  list: asyncHandler(async (req: Request, res: Response) => {
    const query = req.query as unknown as ListPatientsQuery;
    const { patients, pagination } = await patientService.list(query);
    ApiResponse.success(res, patients, "Patients retrieved.", 200, { pagination });
  }),

  /** GET /api/patients/:id */
  getById: asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    if (!id) throw ApiError.badRequest("Patient id is required.");
    const patient = await patientService.getById(id);
    ApiResponse.success(res, patient, "Patient retrieved.");
  }),

  /** POST /api/patients */
  create: asyncHandler(async (req: Request, res: Response) => {
    const input = req.body as CreatePatientInput;
    const patient = await patientService.create(input);
    ApiResponse.success(res, patient, "Patient registered successfully.", 201);
  }),

  /** PATCH /api/patients/:id */
  update: asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    if (!id) throw ApiError.badRequest("Patient id is required.");
    const input = req.body as UpdatePatientInput;
    const patient = await patientService.update(id, input);
    ApiResponse.success(res, patient, "Patient updated successfully.");
  }),
};
