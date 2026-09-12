import { Request, Response } from "express";

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
