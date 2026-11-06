import { createApp } from "./app";
import { env } from "./config/env";
import { connectDatabase, disconnectDatabase } from "./config/database";

async function bootstrap(): Promise<void> {
  // The database must be reachable before the API starts accepting
  // traffic — there is no useful degraded mode for M-IPQMS without it.
  try {
    await connectDatabase();
  } catch (error) {
    console.error("❌ Fatal: unable to establish a database connection.");
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }

  const app = createApp();

  const server = app.listen(env.PORT, () => {
    console.log(`🚀 M-IPQMS API running on http://localhost:${env.PORT}`);
    console.log(`   Health check:  http://localhost:${env.PORT}/api/health`);
    console.log(`   Environment:   ${env.NODE_ENV}`);
  });

  const shutdown = (signal: string) => {
    console.log(`\n${signal} received. Shutting down gracefully...`);
    server.close(async () => {
      await disconnectDatabase();
      process.exit(0);
    });

    // Force-exit if graceful shutdown hangs for any reason.
    setTimeout(() => {
      console.error("⏱ Forced shutdown after timeout.");
      process.exit(1);
    }, 10_000).unref();
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  process.on("unhandledRejection", (reason) => {
    console.error("🔥 Unhandled promise rejection:", reason);
  });
}

bootstrap();
