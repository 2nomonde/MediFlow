import { api } from "./api";
import type { ApiSuccessResponse } from "@/types/api";
import type { Pagination } from "@/types/patient";
import type { QueueEntry } from "@/types/queue";
import type { Triage, CreateTriageInput, UpdateTriageInput, TriagePriority } from "@/types/triage";

export interface ListTriageParams {
  priorityLevel?: TriagePriority;
  page?: number;
  pageSize?: number;
}

export const triageService = {
  /** Queue entries (WAITING/CALLED) with no triage record yet. */
  async listPending(): Promise<QueueEntry[]> {
    const { data } = await api.get<ApiSuccessResponse<QueueEntry[]>>("/triage/pending");
    return data.data;
  },

  async list(params: ListTriageParams): Promise<{ records: Triage[]; pagination: Pagination }> {
    const { data } = await api.get<ApiSuccessResponse<Triage[]>>("/triage", { params });
    return { records: data.data, pagination: data.meta?.pagination as Pagination };
  },

  async getById(id: string): Promise<Triage> {
    const { data } = await api.get<ApiSuccessResponse<Triage>>(`/triage/${id}`);
    return data.data;
  },

  /** Throws (404) if no triage record exists yet for this queue entry — callers use that to decide create vs. edit. */
  async getByQueueEntry(queueEntryId: string): Promise<Triage> {
    const { data } = await api.get<ApiSuccessResponse<Triage>>(`/triage/queue/${queueEntryId}`);
    return data.data;
  },

  async create(input: CreateTriageInput): Promise<Triage> {
    const { data } = await api.post<ApiSuccessResponse<Triage>>("/triage", input);
    return data.data;
  },

  async update(id: string, input: UpdateTriageInput): Promise<Triage> {
    const { data } = await api.patch<ApiSuccessResponse<Triage>>(`/triage/${id}`, input);
    return data.data;
  },
};
