import { api } from "./api";
import type { ApiSuccessResponse } from "@/types/api";
import type { Pagination } from "@/types/patient";
import type { AuditLogEntry, AuditAction } from "@/types/auditLog";

export interface ListAuditLogsParams {
  action?: AuditAction;
  userId?: string;
  entityType?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}

export const auditLogService = {
  async list(params: ListAuditLogsParams): Promise<{ items: AuditLogEntry[]; pagination: Pagination }> {
    const { data } = await api.get<ApiSuccessResponse<AuditLogEntry[]>>("/audit-logs", { params });
    return { items: data.data, pagination: data.meta?.pagination as Pagination };
  },

  async getById(id: string): Promise<AuditLogEntry> {
    const { data } = await api.get<ApiSuccessResponse<AuditLogEntry>>(`/audit-logs/${id}`);
    return data.data;
  },
};
