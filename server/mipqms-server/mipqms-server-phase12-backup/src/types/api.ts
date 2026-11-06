/**
 * Every successful API response follows this shape. Kept intentionally
 * simple/consistent so the frontend (Phase 5+) can rely on a single
 * response contract across every endpoint, present and future.
 */
export interface ApiSuccessResponse<T = unknown> {
  success: true;
  message: string;
  data: T;
  meta?: Record<string, unknown>;
}

/**
 * Every error response — thrown application errors, validation failures,
 * and translated Prisma/database errors — follows this shape.
 */
export interface ApiErrorResponse {
  success: false;
  message: string;
  details?: unknown;
}
