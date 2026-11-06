import { api } from "./api";
import type { ApiSuccessResponse } from "@/types/api";
import type { PriorityConfig, UpdatePriorityConfigInput } from "@/types/priorityConfig";

export const priorityConfigService = {
  async getActive(): Promise<PriorityConfig> {
    const { data } = await api.get<ApiSuccessResponse<PriorityConfig>>("/priority-config");
    return data.data;
  },

  async updateActive(input: UpdatePriorityConfigInput): Promise<PriorityConfig> {
    const { data } = await api.patch<ApiSuccessResponse<PriorityConfig>>("/priority-config", input);
    return data.data;
  },
};
