import express, { Express } from "express";
import cors from "cors";
import helmet from "helmet";
import { env } from "./config/env";
import { apiRouter } from "./routes";
import { requestLogger } from "./middleware/requestLogger";
import { notFoundHandler } from "./middleware/notFoundHandler";
import { errorHandler } from "./middleware/errorHandler";

/**
 * Builds and configures the Express application. Kept as a factory
 * function (rather than a module-level instance) so it can be imported
 * directly by future test files without also starting a live server —
 * see server.ts for that.
 */
export function createApp(): Express {
  const app = express();

  // Security headers first, before anything else touches the response.
  app.use(helmet());

  // Only the configured frontend origin may call this API with credentials.
  app.use(
    cors({
      origin: env.CORS_ORIGIN,
      credentials: true,
    })
  );

  // Body parsing.
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true }));

  // Request logging (development-friendly format; see requestLogger.ts).
  app.use(requestLogger);

  // All application routes live under /api.
  app.use("/api", apiRouter);

  // Unmatched routes → 404, then every error → centralized handler.
  // Order matters: notFoundHandler must come after all real routes,
  // and errorHandler must be registered last of all.
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
