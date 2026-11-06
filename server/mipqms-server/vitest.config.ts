import { defineConfig } from "vitest/config";

/**
 * Tests in this project are real integration tests — they run the
 * actual Express app (createApp()) via supertest against a real
 * PostgreSQL database through Prisma, not mocks. That means:
 *   - `fileParallelism: false` — test files share the same database
 *     and, in a few cases, the same seeded fixture rows (e.g. the one
 *     active PriorityConfig). Running files in parallel could let one
 *     file's setup/teardown race another's.
 *   - A generous `testTimeout` — real DB round-trips are slower than
 *     mocked calls, especially for the first connection.
 *
 * Requires DATABASE_URL (from .env, loaded the same way the app itself
 * loads it) to point at a real, migrated Postgres database. See
 * Phase17_Testing_Demo_Data.md for setup — ideally a dedicated test
 * database, never a production one.
 */
export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    fileParallelism: false,
    testTimeout: 15000,
    hookTimeout: 15000,
    include: ["tests/**/*.test.ts"],
  },
});
