import axios from "axios";
import type { ApiErrorResponse } from "@/types/api";

/**
 * The backend's validateBody/validateQuery middleware returns Zod's
 * `flatten().fieldErrors` shape as `details` on a 400 response:
 * { fieldName: ["message", ...] }. This extracts a single message per
 * field for inline form display — backend validation stays authoritative,
 * this just surfaces its output next to the right input.
 */
export function extractFieldErrors(error: unknown): Record<string, string> {
  if (!axios.isAxiosError(error)) return {};
  const data = error.response?.data as ApiErrorResponse | undefined;
  if (error.response?.status !== 400 || !data?.details) return {};

  const details = data.details as Record<string, string[] | undefined>;
  const fieldErrors: Record<string, string> = {};
  for (const [field, messages] of Object.entries(details)) {
    if (messages && messages.length > 0) {
      fieldErrors[field] = messages[0];
    }
  }
  return fieldErrors;
}

/** True when the error is a 409 conflict (duplicate patient) — see services/api.ts's getErrorMessage for the message itself. */
export function isConflictError(error: unknown): boolean {
  return axios.isAxiosError(error) && error.response?.status === 409;
}

/** Extracts the existing-patient details a 409 duplicate response includes, if any. */
export function getConflictPatientId(error: unknown): string | undefined {
  if (!isConflictError(error) || !axios.isAxiosError(error)) return undefined;
  const data = error.response?.data as ApiErrorResponse | undefined;
  const details = data?.details as { existingPatientId?: string } | undefined;
  return details?.existingPatientId;
}
