import { Request, Response } from "express";
import { UserRole } from "@prisma/client";
import { appointmentService } from "../services/appointment.service";
import { ApiResponse } from "../utils/ApiResponse";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/ApiError";
import type {
  CreateAppointmentInput,
  RescheduleAppointmentInput,
  CancelAppointmentInput,
  ListAppointmentsQuery,
} from "../validators/appointment.validators";

export const appointmentController = {
  /**
   * GET /api/appointments?search=&patientId=&departmentId=&doctorId=&status=&dateFrom=&dateTo=&page=&pageSize=
   * A DOCTOR is only ever allowed to see their own appointments (Rule:
   * "Doctor: view appointments assigned to them") — enforced here by
   * forcing `doctorId` to the caller's own id, overriding whatever (if
   * anything) was in the query string, rather than trusting the client
   * to send the right filter. RECEPTIONIST/NURSE/ADMIN see everything
   * their query asks for, unchanged.
   */
  list: asyncHandler(async (req: Request, res: Response) => {
    const query = req.query as unknown as ListAppointmentsQuery;
    const effectiveQuery = req.user!.role === UserRole.DOCTOR ? { ...query, doctorId: req.user!.id } : query;
    const { appointments, pagination } = await appointmentService.list(effectiveQuery);
    ApiResponse.success(res, appointments, "Appointments retrieved.", 200, { pagination });
  }),

  /**
   * GET /api/appointments/:id — same DOCTOR-scoping rule as `list`, but
   * since a single record has no query filter to rewrite, a DOCTOR
   * requesting an appointment that isn't theirs gets a 403 rather than
   * a 404 (the record genuinely exists; they're just not allowed to see
   * it) — the same distinction `requireRole` draws at the route level.
   */
  getById: asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    if (!id) throw ApiError.badRequest("Appointment id is required.");
    const appointment = await appointmentService.getById(id);
    if (req.user!.role === UserRole.DOCTOR && appointment.doctorId !== req.user!.id) {
      throw ApiError.forbidden("You can only view appointments assigned to you.");
    }
    ApiResponse.success(res, appointment, "Appointment retrieved.");
  }),

  /** POST /api/appointments — RECEPTIONIST/ADMIN only (route-gated). */
  create: asyncHandler(async (req: Request, res: Response) => {
    const input = req.body as CreateAppointmentInput;
    // req.user is guaranteed set — this route sits behind `authenticate`.
    const appointment = await appointmentService.create(input, req.user!.id);
    ApiResponse.success(res, appointment, "Appointment scheduled successfully.", 201);
  }),

  /** PATCH /api/appointments/:id/reschedule — RECEPTIONIST/ADMIN only (route-gated). */
  reschedule: asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    if (!id) throw ApiError.badRequest("Appointment id is required.");
    const input = req.body as RescheduleAppointmentInput;
    const appointment = await appointmentService.reschedule(id, input, req.user!.id);
    ApiResponse.success(res, appointment, "Appointment rescheduled successfully.");
  }),

  /** PATCH /api/appointments/:id/cancel — RECEPTIONIST/ADMIN only (route-gated). Body: { reason? }. */
  cancel: asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    if (!id) throw ApiError.badRequest("Appointment id is required.");
    const { reason } = req.body as CancelAppointmentInput;
    const appointment = await appointmentService.cancel(id, req.user!.id, reason);
    ApiResponse.success(res, appointment, "Appointment cancelled.");
  }),
};
