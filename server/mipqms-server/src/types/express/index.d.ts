import { UserRole } from "@prisma/client";

/**
 * Adds `req.user` to Express's Request type. Populated by the
 * `authenticate` middleware once a JWT has been verified and the
 * corresponding active user confirmed to exist in the database.
 * Deliberately minimal — just enough for authorization checks
 * (`requireRole`) and for controllers to know who's making the request.
 */
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: UserRole;
      };
    }
  }
}

export {};
