import { Request, Response, NextFunction } from "express";
import { UserRole } from "@prisma/client";
import { ApiError } from "../utils/ApiError";

/**
 * Centralized RBAC check — the ONLY place role logic lives. Every
 * protected route in every future phase authorizes with this instead of
 * hand-rolled `if (req.user.role !== "DOCTOR")` checks inside controllers.
 *
 * Usage:
 *   router.post("/patients", authenticate, requireRole(UserRole.RECEPTIONIST, UserRole.ADMIN), controller.create)
 *
 * Must run AFTER `authenticate`, which populates req.user.
 */
export function requireRole(...allowedRoles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      // Defensive — should never happen if `authenticate` ran first,
      // but fail closed rather than silently allowing the request through.
      next(ApiError.unauthorized());
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      next(
        ApiError.forbidden(
          `This action requires one of the following roles: ${allowedRoles.join(", ")}.`
        )
      );
      return;
    }

    next();
  };
}
