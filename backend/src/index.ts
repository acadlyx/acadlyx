import { createApp } from "./app";
import { assertAuthEnv, env } from "./config/env";
import { syncAllTenantAccess } from "./services/rbacSync.service";
import { logger } from "./utils/logger";
import { cleanupExpiredDeletedUsers } from "./services/userLifecycle.service";

assertAuthEnv();

const app = createApp();

const server = app.listen(env.port, () => {
  // Keep HTTP connections reusable on Render/Vercel instead of repeatedly
  // paying TCP/TLS setup costs for authenticated API traffic.
  server.keepAliveTimeout = 65_000;
  server.headersTimeout = 70_000;

  logger.info(`ACADLYX API running on http://localhost:${env.port}`);
  logger.info(`Health check: http://localhost:${env.port}/api/${env.apiVersion}/health`);

  // Reconcile the canonical RBAC catalogue + default entitlements with every
  // existing tenant. Non-blocking: the API is already serving traffic.
  if (process.env.RBAC_SYNC_ON_BOOT !== "false" && env.databaseUrl) {
    syncAllTenantAccess()
      .then((result) => logger.info("RBAC sync complete", result))
      .catch((error) =>
        logger.error("RBAC sync failed", {
          error: error instanceof Error ? error.message : String(error),
        })
      );
  }
});

function shutdown(signal: string) {
  logger.info(`${signal} received, shutting down`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
