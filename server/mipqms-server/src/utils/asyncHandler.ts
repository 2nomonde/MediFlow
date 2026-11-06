import { Request, Response, NextFunction, RequestHandler } from "express";

/**
 * Wraps an async controller so a rejected promise (e.g. a thrown ApiError,
 * or any Prisma error) is forwarded to next() and lands in the centralized
 * errorHandler, instead of needing a try/catch in every controller.
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
