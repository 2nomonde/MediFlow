import { Router } from "express";
import { appointmentController } from "../controllers/appointment.controller";
import { authenticate } from "../middleware/authenticate";
import { requireRole } from "../middleware/requireRole";
import { validateBody, validateQuery } from "../middleware/validate";
import { ROLE_GROUPS } from "../config/rolePermissions";
import {
  createAppointmentSchema,
  rescheduleAppointmentSchema,
  cancelAppointmentSchema,
  listAppointmentsQuerySchema,
} from "../validators/appointment.validators";

export const appointmentRouter = Router();

/**
 * All routes require authentication. Reading (list/getById) is gated to
 * `appointmentRead` (RECEPTIONIST, NURSE, DOCTOR, ADMIN); creating,
 * rescheduling and cancelling stay gated to the narrower, pre-existing
 * `patientRegistrationAndAppointments` group (RECEPTIONIST, ADMIN) — see
 * rolePermissions.ts for the full reasoning. DOCTOR's read access is
 * further scoped to their own appointments inside
 * appointment.controller.ts (role middleware alone can't express
 * "only rows where doctorId === the caller").
 *
 * Deliberately absent: DELETE /api/appointments/:id. Appointment
 * records are never hard-deleted — cancelling preserves the row (see
 * appointment.service.ts's `cancel`).
 */
appointmentRouter.use(authenticate);

appointmentRouter.get(
  "/",
  requireRole(...ROLE_GROUPS.patientRegistrationAndAppointments),
  validateQuery(listAppointmentsQuerySchema),
  appointmentController.list
);

appointmentRouter.post(
  "/",
  requireRole(...ROLE_GROUPS.patientRegistrationAndAppointments),
  validateBody(createAppointmentSchema),
  appointmentController.create
);

appointmentRouter.get("/:id", requireRole(...ROLE_GROUPS.patientRegistrationAndAppointments), appointmentController.getById);

appointmentRouter.patch(
  "/:id/reschedule",
  requireRole(...ROLE_GROUPS.patientRegistrationAndAppointments),
  validateBody(rescheduleAppointmentSchema),
  appointmentController.reschedule
);

appointmentRouter.patch(
  "/:id/cancel",
  requireRole(...ROLE_GROUPS.patientRegistrationAndAppointments),
  validateBody(cancelAppointmentSchema),
  appointmentController.cancel
);
