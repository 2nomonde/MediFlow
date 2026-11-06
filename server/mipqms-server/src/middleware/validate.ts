import { Request, Response, NextFunction } from "express";
import { ZodSchema } from "zod";
import { ApiError } from "../utils/ApiError";

/**
 * Validates req.body against a Zod schema before the request reaches a
 * controller. On success, req.body is replaced with the parsed (and
 * type-coerced) data. On failure, forwards a 400 ApiError with per-field
 * details — this is the backend-side validation the requirements call
 * for, independent of whatever the frontend does in later phases.
 */
export function validateBody(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      next(ApiError.badRequest("Validation failed.", result.error.flatten().fieldErrors));
      return;
    }
    req.body = result.data;
    next();
  };
}

/**
 * Same pattern as validateBody, for req.query — used by list endpoints
 * (e.g. GET /api/patients?page=&pageSize=&search=) so pagination/search
 * params are validated and type-coerced (query values arrive as strings)
 * before a controller ever sees them.
 */
export function validateQuery(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      next(ApiError.badRequest("Invalid query parameters.", result.error.flatten().fieldErrors));
      return;
    }
    req.query = result.data as typeof req.query;
    next();
  };
}
