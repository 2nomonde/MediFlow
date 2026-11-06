/** Matches the { success, message, data } envelope from ApiResponse.ts on the backend. */
export interface ApiSuccessResponse<T> {
  success: true;
  message: string;
  data: T;
  meta?: Record<string, unknown>;
}

/** Matches the { success: false, message, details? } shape from errorHandler.ts. */
export interface ApiErrorResponse {
  success: false;
  message: string;
  details?: unknown;
}
