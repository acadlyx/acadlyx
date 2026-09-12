import { NextFunction, Request, Response } from "express";
import { ZodError, ZodTypeAny } from "zod";
import { AppError } from "./errorHandler";

function formatZodError(err: ZodError, label: string): AppError {
  const message = err.errors
    .map((e) => `${e.path.join(".") || label}: ${e.message}`)
    .join("; ");
  return new AppError(`Validation error: ${message}`, 400);
}

/**
 * Validates req.body against a Zod schema. On success, replaces
 * req.body with the parsed (typed, stripped-of-extra-fields) result.
 */
export function validateBody(schema: ZodTypeAny) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        next(formatZodError(err, "body"));
        return;
      }
      next(err);
    }
  };
}

/**
 * Validates req.query against a Zod schema. On success, replaces
 * req.query with the parsed result. Use for list-endpoint filters
 * (page, pageSize, search, isActive, etc.).
 */
export function validateQuery(schema: ZodTypeAny) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      req.query = schema.parse(req.query) as typeof req.query;
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        next(formatZodError(err, "query"));
        return;
      }
      next(err);
    }
  };
}
