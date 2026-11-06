/**
 * Represents an expected, "operational" failure (bad input, missing
 * resource, conflicting state) that should be reported to the client
 * cleanly — as opposed to an unexpected bug, which the error handler
 * treats differently (see middleware/errorHandler.ts).
 *
 * Controllers/services in later phases should `throw ApiError.xxx(...)`
 * rather than constructing raw Error objects or crafting res.json() error
 * bodies by hand, so every error passes through the same shape.
 */
export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly details?: unknown;

  constructor(statusCode: number, message: string, isOperational = true, details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.details = details;

    Object.setPrototypeOf(this, ApiError.prototype);
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message: string, details?: unknown): ApiError {
    return new ApiError(400, message, true, details);
  }

  static unauthorized(message = "Unauthorized"): ApiError {
    return new ApiError(401, message);
  }

  static forbidden(message = "Forbidden"): ApiError {
    return new ApiError(403, message);
  }

  static notFound(message = "Resource not found"): ApiError {
    return new ApiError(404, message);
  }

  static conflict(message: string, details?: unknown): ApiError {
    return new ApiError(409, message, true, details);
  }

  /** For genuinely unexpected failures — isOperational: false is logged loudly. */
  static internal(message = "Internal server error"): ApiError {
    return new ApiError(500, message, false);
  }
}
