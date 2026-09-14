import { NextFunction, Request, Response } from "express";

/**
 * Catches any request that doesn't match a defined route.
 * Must be registered after all routes and before errorHandler.
 */
export function notFound(req: Request, res: Response, _next: NextFunction): void {
  res.status(404).json({
    success: false,
    error: {
      message: `Route not found: ${req.method} ${req.originalUrl}`,
      requestId: res.locals.requestId,
    },
  });
}
