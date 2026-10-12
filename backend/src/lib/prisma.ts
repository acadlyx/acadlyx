import { PrismaClient } from "@prisma/client";
import { isProduction } from "../config/env";

/**
 * Single shared PrismaClient instance.
 * Reused across hot reloads in dev via globalThis to avoid
 * exhausting the DB connection pool.
 */
const slowQueryThresholdCandidate = Number(process.env.SLOW_DB_QUERY_THRESHOLD_MS || 150);
const slowQueryThresholdMs = Number.isFinite(slowQueryThresholdCandidate) && slowQueryThresholdCandidate > 0
  ? slowQueryThresholdCandidate
  : 150;

const createPrismaClient = () => new PrismaClient({
  // Keep the query event in the inferred client options so Prisma types the
  // $on("query") callback correctly even when the instance is stored globally.
  log: [
    { emit: "event", level: "query" } as const,
    ...(isProduction ? ["error", "warn"] as const : ["warn", "error"] as const),
  ],
});

type SharedPrismaClient = ReturnType<typeof createPrismaClient>;
const globalForPrisma = globalThis as unknown as { prisma?: SharedPrismaClient };

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

// Emit timings only. Never log SQL parameters, which can contain sensitive
// institutional values or personal data.
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
