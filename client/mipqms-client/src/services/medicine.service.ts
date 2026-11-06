import { api } from "./api";
import type { ApiSuccessResponse } from "@/types/api";
import type { Medicine } from "@/types/medicine";

/** Read-only — Medicine management (create/edit) is not part of Phase 14, per the brief. */
export const medicineService = {
  async list(search?: string): Promise<Medicine[]> {
    const { data } = await api.get<ApiSuccessResponse<Medicine[]>>("/medicines", { params: { search } });
    return data.data;
  },
};
