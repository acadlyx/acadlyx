import {
  NextFunction,
  Request,
  Response,
} from "express";

import {
  MulterError,
} from "multer";

import {
  Prisma,
} from "@prisma/client";

import {
  isProduction,
} from "../config/env";

import {
  logger,
} from "../utils/logger";

export class AppError
  extends Error
{
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    statusCode = 500,
    isOperational = true,
  ) {
    super(message);

    this.name =
      "AppError";

    this.statusCode =
      statusCode;

    this.isOperational =
      isOperational;

    Object.setPrototypeOf(
      this,
      AppError.prototype,
    );
  }
}

function prismaStatusCode(
  error: unknown,
): number | null {
  if (
    !(
      error instanceof
      Prisma.PrismaClientKnownRequestError
    )
  ) {
    return null;
  }

  switch (error.code) {
    case "P2002":
      return 409;

    case "P2003":
      return 409;

    case "P2025":
      return 404;

    case "P2014":
      return 409;

    default:
      return null;
  }
}

function prismaMessage(
  error: unknown,
): string | null {
  if (
    !(
      error instanceof
      Prisma.PrismaClientKnownRequestError
    )
  ) {
    return null;
  }

  switch (error.code) {
    case "P2002":
      return "A record with the same unique value already exists.";

    case "P2003":
      return "This record is referenced by protected institutional data and cannot be changed or deleted.";

    case "P2025":
      return "The requested record was not found or has already been removed.";

    case "P2014":
      return "This operation would violate a required institutional relationship.";

    default:
      return null;
  }
}

function isJsonSyntaxError(
  error: unknown,
): boolean {
  return (
    error instanceof
      SyntaxError &&
    typeof (
      error as SyntaxError & {
        status?: unknown;
      }
    ).status === "number"
  );
}

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const prismaCode =
    prismaStatusCode(err);

  const statusCode =
    err instanceof AppError
      ? err.statusCode
      : prismaCode ??
        (
          err instanceof MulterError &&
          err.code ===
            "LIMIT_FILE_SIZE"
            ? 413
            : err instanceof
                MulterError
              ? 400
              : isJsonSyntaxError(err)
                ? 400
                : err.message.startsWith(
                      "CORS origin not allowed:",
                    )
                  ? 403
                  : 500
        );

  const message =
    err instanceof AppError
      ? err.message
      : prismaMessage(err) ||
        (
          err instanceof MulterError &&
          err.code ===
            "LIMIT_FILE_SIZE"
            ? "Uploaded file exceeds the permitted size"
            : err instanceof
                MulterError
              ? "Invalid file upload"
              : isJsonSyntaxError(err)
                ? "Invalid JSON request body"
                : err.message.startsWith(
                      "CORS origin not allowed:",
                    )
                  ? "Request origin is not allowed"
                  : "Internal server error"
        );

  logger.error(
    `${req.method} ${req.originalUrl} -> ${statusCode}`,
    {
      requestId: res.locals.requestId,
      errorName: err.name,
      ...(prismaCode ? { prismaCode } : {}),
      ...(!isProduction
        ? {
            message: err.message,
            stack: err.stack,
          }
        : {}),
    },
  );

  res.status(statusCode).json({
    success: false,

    error: {
      message,

      requestId:
        res.locals.requestId,

      ...(
        !isProduction &&
        !(err instanceof AppError) &&
        !prismaCode
          ? {
              stack:
                err.stack,
            }
          : {}
      ),
    },
  });
}
