import { Router, Request, Response } from "express";
import { ApiResponse } from "../utils/ApiResponse";
import { checkDatabaseHealth } from "../config/database";

export const healthRouter = Router();

/**
 * GET /api/health
 * Reports API liveness and database connectivity. Returns 200 when the
 * database is reachable, 503 when it isn't — useful both for a manual
 * check and for later hooking into infrastructure health checks.
 */
healthRouter.get("/", async (_req: Request, res: Response) => {
  const databaseHealthy = await checkDatabaseHealth();
  const statusCode = databaseHealthy ? 200 : 503;

  ApiResponse.success(
    res,
    {
      service: "M-IPQMS API",
      status: databaseHealthy ? "ok" : "degraded",
      database: databaseHealthy ? "connected" : "unreachable",
      timestamp: new Date().toISOString(),
    },
    databaseHealthy ? "Service healthy" : "Service degraded",
    statusCode
  );
});
