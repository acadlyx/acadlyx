import { createApp } from "./app";
import { assertAuthEnv, env } from "./config/env";
import { syncAllTenantAccess } from "./services/rbacSync.service";
import { logger } from "./utils/logger";
import { cleanupExpiredDeletedUsers } from "./services/userLifecycle.service";
import { drainDomainEventOutbox } from "./services/domainEvent.service";
import { prisma } from "./lib/prisma";

assertAuthEnv();

const app = createApp();

const server = app.listen(env.port, () => {
  server.keepAliveTimeout = 65_000;
  server.headersTimeout = 70_000;

  logger.info(`ACADLYX API running on http://localhost:${env.port}`);
  logger.info(`Health check: http://localhost:${env.port}/api/${env.apiVersion}/health`);
  logger.info("ACADLYX deployment metadata", {
    renderGitBranch: process.env.RENDER_GIT_BRANCH ?? null,
    renderGitCommit: process.env.RENDER_GIT_COMMIT ?? null,
    renderGitRepo: process.env.RENDER_GIT_REPO_SLUG ?? null,
  });
  void cleanupExpiredDeletedUsers().catch((error) => logger.error("Initial deleted-user cleanup failed", { error }));
  void drainDomainEventOutbox(50).catch((error) => logger.error("Initial domain-event outbox drain failed", { error }));

  const lifecycleCleanup = setInterval(() => {
    void cleanupExpiredDeletedUsers().catch((error) => logger.error("Scheduled deleted-user cleanup failed", { error }));
  }, 6 * 60 * 60 * 1000);
  lifecycleCleanup.unref();

  const outboxDrain = setInterval(() => {
    void drainDomainEventOutbox(50).catch((error) =>
      logger.error("Scheduled domain-event outbox drain failed", { error })
    );
  }, 5_000);
  outboxDrain.unref();

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

let shuttingDown = false;

async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;

  logger.info(`${signal} received, shutting down`);

  const forceExit = setTimeout(() => process.exit(1), 10_000);
  forceExit.unref();

  try {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
    await prisma.$disconnect();
    clearTimeout(forceExit);
    process.exit(0);
  } catch (error) {
    logger.error("Graceful shutdown failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    clearTimeout(forceExit);
    process.exit(1);
  }
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
