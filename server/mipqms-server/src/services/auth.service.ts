import bcrypt from "bcrypt";
import { User } from "@prisma/client";
import { prisma } from "../config/database";
import { ApiError } from "../utils/ApiError";
import { signAccessToken } from "../utils/jwt";
import { RegisterInput, LoginInput } from "../validators/auth.validators";

const SALT_ROUNDS = 12;

export type SafeUser = Omit<User, "passwordHash">;

/** Strips passwordHash before a User record ever leaves the service layer. */
function toSafeUser(user: User): SafeUser {
  const { passwordHash: _passwordHash, ...safe } = user;
  return safe;
}

export const authService = {
  /**
   * Creates a new staff account. Only reachable via a route already
   * gated by `authenticate` + `requireRole(ADMIN)` — this function does
   * not re-check the caller's role itself, since that's the router's job
   * (see routes/auth.routes.ts), not the service's.
   */
  async register(input: RegisterInput): Promise<{ user: SafeUser }> {
    const existing = await prisma.user.findUnique({ where: { email: input.email } });
    if (existing) {
      throw ApiError.conflict("A user with this email already exists.");
    }

    const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);

    const user = await prisma.user.create({
      data: {
        email: input.email,
        passwordHash,
        firstName: input.firstName,
        lastName: input.lastName,
        role: input.role,
        departmentId: input.departmentId,
      },
    });

    return { user: toSafeUser(user) };
  },

  async login(input: LoginInput): Promise<{ user: SafeUser; accessToken: string }> {
    const user = await prisma.user.findUnique({ where: { email: input.email } });

    // Unknown email and wrong password return the identical message and
    // status — this is deliberate, so a caller can't use the error to
    // enumerate which emails have accounts.
    if (!user) {
      throw ApiError.unauthorized("Invalid email or password.");
    }

    const passwordValid = await bcrypt.compare(input.password, user.passwordHash);
    if (!passwordValid) {
      throw ApiError.unauthorized("Invalid email or password.");
    }

    // Checked only AFTER the password is confirmed correct — an attacker
    // guessing passwords for a deactivated account still just sees
    // "Invalid email or password" and learns nothing about account state.
    if (!user.isActive) {
      throw ApiError.forbidden("This account has been deactivated. Contact an administrator.");
    }

    const accessToken = signAccessToken({ sub: user.id, role: user.role, email: user.email });

    return { user: toSafeUser(user), accessToken };
  },

  async getById(userId: string): Promise<SafeUser> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw ApiError.notFound("User not found.");
    }
    return toSafeUser(user);
  },
};
