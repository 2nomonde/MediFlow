import { api } from "./api";
import type { ApiSuccessResponse } from "@/types/api";
import type { Appointment, CreateAppointmentInput, RescheduleAppointmentInput, Pagination, AppointmentStatus } from "@/types/appointment";

export interface ListAppointmentsParams {
  page?: number;
  pageSize?: number;
  search?: string;
  patientId?: string;
  departmentId?: string;
  doctorId?: string;
  status?: AppointmentStatus;
  dateFrom?: string;
  dateTo?: string;
}

export const appointmentService = {
  async list(params: ListAppointmentsParams): Promise<{ appointments: Appointment[]; pagination: Pagination }> {
    const { data } = await api.get<ApiSuccessResponse<Appointment[]>>("/appointments", { params });
    return {
      appointments: data.data,
      pagination: data.meta?.pagination as Pagination,
    };
  },

  async getById(id: string): Promise<Appointment> {
    const { data } = await api.get<ApiSuccessResponse<Appointment>>(`/appointments/${id}`);
    return data.data;
  },

  async create(input: CreateAppointmentInput): Promise<Appointment> {
    const { data } = await api.post<ApiSuccessResponse<Appointment>>("/appointments", input);
    return data.data;
  },

  async reschedule(id: string, input: RescheduleAppointmentInput): Promise<Appointment> {
    const { data } = await api.patch<ApiSuccessResponse<Appointment>>(`/appointments/${id}/reschedule`, input);
    return data.data;
  },

  async cancel(id: string, reason?: string): Promise<Appointment> {
    const { data } = await api.patch<ApiSuccessResponse<Appointment>>(`/appointments/${id}/cancel`, { reason });
    return data.data;
  },
};
