import { api } from "./api";
import type { ApiSuccessResponse } from "@/types/api";

export interface StaffSummary {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
}

/** Read-only — matches the new, minimal GET /api/users?role= endpoint. Staff management (create/edit/deactivate) is a future Administration module. */
export const userService = {
  async listByRole(role: "DOCTOR"): Promise<StaffSummary[]> {
    const { data } = await api.get<ApiSuccessResponse<StaffSummary[]>>("/users", { params: { role } });
    return data.data;
  },
};
