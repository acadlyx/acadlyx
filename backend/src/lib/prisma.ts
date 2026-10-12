import { PrismaClient } from "@prisma/client";
import { isProduction } from "../config/env";

/**
 * Single shared PrismaClient instance.
 * Reused across hot reloads in dev via globalThis to avoid
 * exhausting the DB connection pool.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    // Query events contain parameterized SQL but may include timing and target
    // metadata only in our logs; values/params are deliberately not emitted.
    log: [
      ...(isProduction ? ["error", "warn"] as const : ["warn", "error"] as const),
      { emit: "event", level: "query" },
    ],
  });

const slowQueryThresholdMs = Number(process.env.SLOW_DB_QUERY_THRESHOLD_MS || 150);

// This lets slow_api request logs be correlated with slow database operations
// without logging query parameters or user-provided values.
prisma.$on("query", (event) => {
  if (event.duration >= slowQueryThresholdMs) {
    console.warn(JSON.stringify({
      type: "slow_db_query",
      durationMs: event.duration,
      target: event.target,
    }));
  }
});

if (!isProduction) {
  globalForPrisma.prisma = prisma;
}
