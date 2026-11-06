import { api } from "./api";
import type { ApiSuccessResponse } from "@/types/api";
import type { WaitEstimate } from "@/types/waitEstimate";

export const waitEstimateService = {
  async getEstimate(queueEntryId: string): Promise<WaitEstimate> {
    const { data } = await api.get<ApiSuccessResponse<WaitEstimate>>(`/queue/${queueEntryId}/estimate`);
    return data.data;
  },
};
