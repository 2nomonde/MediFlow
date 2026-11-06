import { api } from "./api";
import type { ApiSuccessResponse } from "@/types/api";
import type { Department } from "@/types/queue";

/** Read-only — Department management (create/edit) is a future Administration module. */
export const departmentService = {
  async list(): Promise<Department[]> {
    const { data } = await api.get<ApiSuccessResponse<Department[]>>("/departments");
    return data.data;
  },
};
