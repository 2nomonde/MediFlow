import { api } from "./api";
import type { ApiSuccessResponse } from "@/types/api";
import type { Consultation, ConsultationClinicalFields } from "@/types/consultation";

export const consultationService = {
  async start(queueEntryId: string): Promise<Consultation> {
    const { data } = await api.post<ApiSuccessResponse<Consultation>>(`/consultations/queue/${queueEntryId}/start`);
    return data.data;
  },

  /** Throws (404) if no consultation has been started yet for this queue entry. */
  async getByQueueEntry(queueEntryId: string): Promise<Consultation> {
    const { data } = await api.get<ApiSuccessResponse<Consultation>>(`/consultations/queue/${queueEntryId}`);
    return data.data;
  },

  async getById(id: string): Promise<Consultation> {
    const { data } = await api.get<ApiSuccessResponse<Consultation>>(`/consultations/${id}`);
    return data.data;
  },

  async getPatientHistory(patientId: string): Promise<Consultation[]> {
    const { data } = await api.get<ApiSuccessResponse<Consultation[]>>(`/consultations/patient/${patientId}`);
    return data.data;
  },

  async update(id: string, input: ConsultationClinicalFields): Promise<Consultation> {
    const { data } = await api.patch<ApiSuccessResponse<Consultation>>(`/consultations/${id}`, input);
    return data.data;
  },

  async complete(id: string, input: ConsultationClinicalFields): Promise<Consultation> {
    const { data } = await api.post<ApiSuccessResponse<Consultation>>(`/consultations/${id}/complete`, input);
    return data.data;
  },
};
