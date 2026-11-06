import { api } from "./api";
import type { ApiSuccessResponse } from "@/types/api";
import type { Prescription, CreatePrescriptionInput } from "@/types/prescription";

export const prescriptionService = {
  async listByConsultation(consultationId: string): Promise<Prescription[]> {
    const { data } = await api.get<ApiSuccessResponse<Prescription[]>>(`/prescriptions/consultation/${consultationId}`);
    return data.data;
  },

  async listPending(): Promise<Prescription[]> {
    const { data } = await api.get<ApiSuccessResponse<Prescription[]>>("/prescriptions/pending");
    return data.data;
  },

  async getById(id: string): Promise<Prescription> {
    const { data } = await api.get<ApiSuccessResponse<Prescription>>(`/prescriptions/${id}`);
    return data.data;
  },

  async create(consultationId: string, input: CreatePrescriptionInput): Promise<{ prescription: Prescription; stockWarning: boolean }> {
    const { data } = await api.post<ApiSuccessResponse<{ prescription: Prescription; stockWarning: boolean }>>(
      `/prescriptions/consultation/${consultationId}`,
      input
    );
    return data.data;
  },

  async dispense(id: string): Promise<Prescription> {
    const { data } = await api.post<ApiSuccessResponse<Prescription>>(`/prescriptions/${id}/dispense`);
    return data.data;
  },
};
