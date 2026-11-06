import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../config/database";
import { ApiError } from "../utils/ApiError";
import { verifyAccessToken } from "../utils/jwt";

/**
 * Verifies the Authorization: Bearer <token> header and attaches the
 * corresponding user to req.user. Must run before any `requireRole` check
 * and before any protected controller.
 *
 * Deliberately re-fetches the user from the database on every request
 * rather than trusting the token's embedded role alone. This is what
 * makes deactivating a staff account take effect on their very next
 * request, instead of only once their existing (still-valid) token
 * expires on its own.
 */
export async function authenticate(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    next(ApiError.unauthorized("Authentication token missing."));
    return;
  }

  const token = header.slice("Bearer ".length).trim();
  if (!token) {
    next(ApiError.unauthorized("Authentication token missing."));
    return;
  }

  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      next(ApiError.unauthorized("Session expired. Please log in again."));
      return;
    }
    next(ApiError.unauthorized("Invalid authentication token."));
    return;
  }

  const user = await prisma.user.findUnique({ where: { id: payload.sub } });

  if (!user) {
    next(ApiError.unauthorized("User no longer exists."));
    return;
  }

  if (!user.isActive) {
    next(ApiError.forbidden("This account has been deactivated."));
    return;
  }

  req.user = { id: user.id, email: user.email, role: user.role };
  next();
}
