import { api } from "./api";
import type { ApiSuccessResponse } from "@/types/api";
import type { ReportSummary } from "@/types/report";

export interface ReportSummaryParams {
  dateFrom: string; // YYYY-MM-DD
  dateTo: string; // YYYY-MM-DD
  departmentId?: string;
}

export const reportService = {
  async getSummary(params: ReportSummaryParams): Promise<ReportSummary> {
    const { data } = await api.get<ApiSuccessResponse<ReportSummary>>("/reports/summary", { params });
    return data.data;
  },
};
