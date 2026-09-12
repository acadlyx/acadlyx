import { NextFunction, Request, Response } from "express";
import { isProduction } from "../config/env";
import { logger } from "../utils/logger";

/**
 * Base error class for predictable, typed application errors.
 * Future phases (auth, validation, RBAC) should throw AppError
 * (or a subclass) instead of raw Error so status codes stay consistent.
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode = 500, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

/**
 * Centralized error handler.
 * Must be registered LAST, after all routes.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const statusCode = err instanceof AppError ? err.statusCode : 500;
  const message = err instanceof AppError ? err.message : "Internal server error";

  logger.error(`${req.method} ${req.originalUrl} -> ${statusCode}`, {
    message: err.message,
    stack: !isProduction ? err.stack : undefined,
  });

  res.status(statusCode).json({
    success: false,
    error: {
      message,
      ...(!isProduction && !(err instanceof AppError) ? { stack: err.stack } : {}),
    },
  });
}
