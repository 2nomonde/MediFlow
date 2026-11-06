import type { QueueStatus } from "./queue";

/**
 * Mirrors the backend's WaitEstimateResult exactly. `estimatedWaitMinutes`
 * is only meaningful when `estimateAvailable` is true — when false,
 * `reason` explains why (e.g. "Not enough completed service data yet.",
 * "Already called."), and the frontend must show that reason, never a
 * fabricated number.
 */
export interface WaitEstimate {
  queueEntryId: string;
  queueNumber: string;
  status: QueueStatus;
  effectivePriority: number;
  patientsAhead: number | null;
  averageServiceMinutes: number | null;
  serviceCapacity: number;
  estimatedWaitMinutes: number | null;
  estimateAvailable: boolean;
  reason: string | null;
  sampleSize: number;
  calculatedAt: string;
}
