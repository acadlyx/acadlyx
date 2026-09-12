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
    log: isProduction ? ["error", "warn"] : ["warn", "error"],
  });

if (!isProduction) {
  globalForPrisma.prisma = prisma;
}
