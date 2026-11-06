import { Request, Response, NextFunction } from "express";
import { ApiError } from "../utils/ApiError";

/**
 * Catches any request that didn't match a defined route and forwards a
 * consistent 404 ApiError into the centralized error handler, rather than
 * letting Express fall back to its default plain-text 404 page.
 */
export function notFoundHandler(req: Request, _res: Response, next: NextFunction): void {
  next(ApiError.notFound(`Route ${req.method} ${req.originalUrl} not found`));
}
