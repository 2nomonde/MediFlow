import { Request, Response } from "express";
import { authService } from "../services/auth.service";
import { ApiResponse } from "../utils/ApiResponse";
import { asyncHandler } from "../utils/asyncHandler";
import { env } from "../config/env";

export const authController = {
  /** POST /api/auth/register — admin-only, see routes/auth.routes.ts. */
  register: asyncHandler(async (req: Request, res: Response) => {
    const { user } = await authService.register(req.body);
    ApiResponse.success(res, { user }, "User registered successfully.", 201);
  }),

  /** POST /api/auth/login */
  login: asyncHandler(async (req: Request, res: Response) => {
    const { user, accessToken } = await authService.login(req.body);
    ApiResponse.success(
      res,
      { user, accessToken, tokenType: "Bearer", expiresIn: env.JWT_EXPIRES_IN },
      "Login successful."
    );
  }),

  /** GET /api/auth/me */
  me: asyncHandler(async (req: Request, res: Response) => {
    // req.user is guaranteed set here — this route is behind `authenticate`.
    const user = await authService.getById(req.user!.id);
    ApiResponse.success(res, { user }, "Current user retrieved.");
  }),

  /**
   * POST /api/auth/logout
   * Stateless JWT means there is no server-side session to destroy — the
   * client simply discards its token. This endpoint exists for API
   * symmetry and as the natural place to add token-blacklisting or
   * refresh-token revocation if that's introduced in a later phase.
   */
  logout: asyncHandler(async (_req: Request, res: Response) => {
    ApiResponse.success(res, null, "Logged out successfully.");
  }),
};
