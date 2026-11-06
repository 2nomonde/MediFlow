import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

/**
 * All environment variables the backend depends on are validated here,
 * once, at startup. If anything required is missing or malformed, the
 * process exits immediately with a clear message instead of failing
 * unpredictably later inside a request handler.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().positive().default(5000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),

  // Auth (Phase 4)
  JWT_SECRET: z
    .string()
    .min(32, "JWT_SECRET must be at least 32 characters long — generate a random one, do not hand-write it"),
  JWT_EXPIRES_IN: z.string().default("15m"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Invalid or missing environment variables:");
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export const isProduction = env.NODE_ENV === "production";
export const isDevelopment = env.NODE_ENV === "development";
