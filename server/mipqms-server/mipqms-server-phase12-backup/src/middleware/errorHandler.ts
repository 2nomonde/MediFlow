import { Request, Response, NextFunction } from "express";
import { Prisma } from "@prisma/client";
import { ApiError } from "../utils/ApiError";
import { isDevelopment } from "../config/env";

/**
 * Single place where every error in the app — thrown ApiErrors, Prisma
 * database errors, and genuinely unexpected exceptions — is translated
 * into the shared { success: false, message, details? } response shape.
 *
 * Must be registered LAST, after all routes (see app.ts).
 */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void {
  // --- Known Prisma database errors -------------------------------------
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case "P2002": {
        // Unique constraint violation — includes the partial-unique-index
        // rules from Phase 2 (one active queue entry per patient, one
        // active PriorityConfig) once those features exist.
        const target = (err.meta?.target as string[] | undefined)?.join(", ") ?? "field";
        res.status(409).json({
          success: false,
          message: `A record with this ${target} already exists.`,
          ...(isDevelopment ? { details: err.meta } : {}),
        });
        return;
      }
      case "P2025":
        res.status(404).json({ success: false, message: "Record not found." });
        return;
      case "P2003":
        res.status(400).json({
          success: false,
          message: "Invalid reference to a related record.",
        });
        return;
      default:
        res.status(400).json({
          success: false,
          message: "Database request could not be completed.",
          ...(isDevelopment ? { details: err.message } : {}),
        });
        return;
    }
  }

  if (err instanceof Prisma.PrismaClientValidationError) {
    res.status(400).json({
      success: false,
      message: "Invalid data provided to the database layer.",
    });
    return;
  }

  if (err instanceof Prisma.PrismaClientInitializationError) {
    console.error("🔥 Database initialization error:", err.message);
    res.status(503).json({
      success: false,
      message: "Database is currently unavailable. Please try again shortly.",
    });
    return;
  }

  // --- Application (operational) errors ----------------------------------
  if (err instanceof ApiError) {
    if (!err.isOperational) {
      console.error("🔥 Non-operational ApiError:", err);
    }
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
      ...(err.details !== undefined ? { details: err.details } : {}),
    });
    return;
  }

  // --- Anything unexpected --------------------------------------------
  console.error("🔥 Unhandled error:", err);
  res.status(500).json({
    success: false,
    message:
      isDevelopment && err instanceof Error ? err.message : "Internal server error.",
  });
}
