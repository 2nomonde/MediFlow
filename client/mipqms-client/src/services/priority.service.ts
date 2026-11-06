import { api } from "./api";
import type { ApiSuccessResponse } from "@/types/api";
import type { QueueEntry, OverridePriorityInput } from "@/types/queue";

/**
 * FullPriorityInfo as returned by GET/POST /api/queue/:id/priority* —
 * a subset of QueueEntry's priority fields, without the rest of the
 * queue-entry shape (used by the breakdown/override modals, which
 * already have the full entry from the queue list).
 */
export interface PriorityInfo {
  breakdown: QueueEntry["priorityBreakdown"];
  triagePriority: QueueEntry["triagePriority"];
  hasManualOverride: boolean;
  manualOverride: number | null;
  overrideReason: string | null;
  overriddenBy: QueueEntry["overriddenBy"];
  overriddenAt: string | null;
  effectivePriority: number;
}

export const priorityService = {
  async getBreakdown(queueEntryId: string): Promise<PriorityInfo> {
    const { data } = await api.get<ApiSuccessResponse<PriorityInfo>>(`/queue/${queueEntryId}/priority`);
    return data.data;
  },

  async recalculate(queueEntryId: string): Promise<PriorityInfo> {
    const { data } = await api.post<ApiSuccessResponse<PriorityInfo>>(`/queue/${queueEntryId}/priority/recalculate`);
    return data.data;
  },

  async override(queueEntryId: string, input: OverridePriorityInput): Promise<PriorityInfo> {
    const { data } = await api.post<ApiSuccessResponse<PriorityInfo>>(`/queue/${queueEntryId}/priority/override`, input);
    return data.data;
  },
};
