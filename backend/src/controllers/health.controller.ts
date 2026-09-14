import { Request, Response } from "express";
import { prisma } from "../lib/prisma";

/**
 * GET /api/v1/health
 * Simple liveness check. No auth, no DB dependency in Phase 0.
 */
export function getHealth(_req: Request, res: Response): void {
  res.status(200).json({
    success: true,
    service: "acadlyx-api",
    status: "healthy",
    timestamp: new Date().toISOString(),
  });
}

/**
 * GET /api/v1/health/ready
 * Readiness check used by the deployment platform. It intentionally verifies
 * only that the application can reach its database and never exposes the
 * underlying connection error.
 */
export async function getReadiness(_req: Request, res: Response): Promise<void> {
  try {
    await prisma.$queryRaw`SELECT 1`;

    res.status(200).json({
      success: true,
      service: "acadlyx-api",
      status: "ready",
      timestamp: new Date().toISOString(),
    });
  } catch {
    res.status(503).json({
      success: false,
      service: "acadlyx-api",
      status: "not_ready",
    });
  }
}
