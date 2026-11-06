import { api } from "./api";
import type { ApiSuccessResponse } from "@/types/api";
import type { Pagination } from "@/types/patient";
import type { QueueEntry, QueueStatus, CheckInInput } from "@/types/queue";

export interface ListQueueParams {
  status?: QueueStatus;
  departmentId?: string;
  page?: number;
  pageSize?: number;
}

export const queueService = {
  async list(params: ListQueueParams): Promise<{ entries: QueueEntry[]; pagination: Pagination }> {
    const { data } = await api.get<ApiSuccessResponse<QueueEntry[]>>("/queue", { params });
    return { entries: data.data, pagination: data.meta?.pagination as Pagination };
  },

  /** Cheap count-only lookup — reuses `list` with pageSize=1 since the backend's `pagination.total` is a real COUNT, not limited by pageSize. */
  async count(status?: QueueStatus): Promise<number> {
    const { pagination } = await this.list({ status, pageSize: 1 });
    return pagination.total;
  },

  async getById(id: string): Promise<QueueEntry> {
    const { data } = await api.get<ApiSuccessResponse<QueueEntry>>(`/queue/${id}`);
    return data.data;
  },

  async checkIn(input: CheckInInput): Promise<QueueEntry> {
    const { data } = await api.post<ApiSuccessResponse<QueueEntry>>("/queue/check-in", input);
    return data.data;
  },

  async updateStatus(id: string, status: QueueStatus): Promise<QueueEntry> {
    const { data } = await api.patch<ApiSuccessResponse<QueueEntry>>(`/queue/${id}/status`, { status });
    return data.data;
  },

  async callNext(departmentId: string): Promise<QueueEntry> {
    const { data } = await api.post<ApiSuccessResponse<QueueEntry>>("/queue/call-next", { departmentId });
    return data.data;
  },
};
