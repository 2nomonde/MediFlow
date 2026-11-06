import { PrismaClient } from "@prisma/client";
import { isDevelopment } from "./env";

/**
 * Single shared Prisma client for the whole app. Creating more than one
 * PrismaClient instance is a common source of connection-pool exhaustion,
 * so every service/controller in later phases must import { prisma } from
 * here rather than instantiating its own client.
 */
export const prisma = new PrismaClient({
  log: isDevelopment ? ["error", "warn"] : ["error"],
});

const MAX_CONNECT_RETRIES = 5;
const RETRY_DELAY_MS = 3000;

/**
 * Attempts to connect to PostgreSQL with a small retry/backoff loop.
 * This matters in practice: if the database container/service is still
 * starting up when the API boots (e.g. `docker compose up` racing
 * Postgres's own startup), a single failed connection attempt shouldn't
 * be fatal.
 */
export async function connectDatabase(retriesLeft = MAX_CONNECT_RETRIES): Promise<void> {
  try {
    await prisma.$connect();
    await prisma.$queryRaw`SELECT 1`;
    console.log("✅ Database connected successfully");
  } catch (error) {
    console.error(
      `❌ Database connection attempt failed. Retries left: ${retriesLeft}`,
      error instanceof Error ? error.message : error
    );

    if (retriesLeft > 0) {
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
      return connectDatabase(retriesLeft - 1);
    }

    throw new Error(
      "Could not establish a database connection after multiple attempts. " +
        "Check that PostgreSQL is running and DATABASE_URL in .env is correct."
    );
  }
}

export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
  console.log("🔌 Database disconnected");
}

/**
 * Lightweight liveness check used by GET /api/health. Does not throw —
 * returns false on failure so the health endpoint can report a clean
 * "degraded" status instead of crashing.
 */
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}
