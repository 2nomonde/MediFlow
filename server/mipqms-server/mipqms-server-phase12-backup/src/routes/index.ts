import { Router } from "express";
import { healthRouter } from "./health.routes";
import { authRouter } from "./auth.routes";
import { patientRouter } from "./patient.routes";
import { queueRouter } from "./queue.routes";
import { departmentRouter } from "./department.routes";
import { triageRouter } from "./triage.routes";
import { priorityConfigRouter } from "./priorityConfig.routes";

/**
 * All feature routers mount here under a single /api prefix (applied in
 * app.ts). This is the ONLY file later phases need to touch to wire in a
 * new module — controllers/services/validators stay decoupled from app
 * wiring.
 *
 * Deliberately NOT implemented yet (later phases):
 *   apiRouter.use("/appointments", appointmentRouter);
 */
export const apiRouter = Router();

apiRouter.use("/health", healthRouter);
apiRouter.use("/auth", authRouter);
apiRouter.use("/patients", patientRouter);
apiRouter.use("/queue", queueRouter);
apiRouter.use("/departments", departmentRouter);
apiRouter.use("/triage", triageRouter);
apiRouter.use("/priority-config", priorityConfigRouter);
