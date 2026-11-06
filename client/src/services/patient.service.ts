import { api } from "./api";
import type { ApiSuccessResponse } from "@/types/api";
import type { Patient, CreatePatientInput, UpdatePatientInput, Pagination } from "@/types/patient";

export interface ListPatientsParams {
  page?: number;
  pageSize?: number;
  search?: string;
}

export const patientService = {
  async list(params: ListPatientsParams): Promise<{ patients: Patient[]; pagination: Pagination }> {
    const { data } = await api.get<ApiSuccessResponse<Patient[]>>("/patients", { params });
    return {
      patients: data.data,
      pagination: data.meta?.pagination as Pagination,
    };
  },

  async getById(id: string): Promise<Patient> {
    const { data } = await api.get<ApiSuccessResponse<Patient>>(`/patients/${id}`);
    return data.data;
  },

  async create(input: CreatePatientInput): Promise<Patient> {
    const { data } = await api.post<ApiSuccessResponse<Patient>>("/patients", input);
    return data.data;
  },

  async update(id: string, input: UpdatePatientInput): Promise<Patient> {
    const { data } = await api.patch<ApiSuccessResponse<Patient>>(`/patients/${id}`, input);
    return data.data;
  },
};
