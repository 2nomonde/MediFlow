import jwt, { SignOptions } from "jsonwebtoken";
import { UserRole } from "@prisma/client";
import { env } from "../config/env";

export interface JwtPayload {
  sub: string; // user id
  role: UserRole;
  email: string;
}

/**
 * Signs a JWT access token. Secret and expiry both come from validated
 * environment variables (config/env.ts) — never hardcoded, per the
 * "no secrets in source code" requirement.
 */
export function signAccessToken(payload: JwtPayload): string {
  const options: SignOptions = {
    expiresIn: env.JWT_EXPIRES_IN as SignOptions["expiresIn"],
  };
  return jwt.sign(payload, env.JWT_SECRET, options);
}

/**
 * Verifies a JWT and returns its payload. Throws jwt's own
 * TokenExpiredError / JsonWebTokenError on failure — the caller
 * (middleware/authenticate.ts) is responsible for translating those
 * into ApiError responses.
 */
export function verifyAccessToken(token: string): JwtPayload {
  return jwt.verify(token, env.JWT_SECRET) as JwtPayload;
}
