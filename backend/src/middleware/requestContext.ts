import { NextFunction, Request, Response } from "express";
import { randomUUID } from "crypto";

const REQUEST_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

/**
 * Gives every response a safe request identifier. Clients may propagate a
 * valid identifier across services; otherwise the API creates one. Keeping it
 * in res.locals avoids expanding the public request type contract.
 */
export function requestContext(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const suppliedId = req.header("x-request-id");
  const requestId =
    suppliedId && REQUEST_ID_PATTERN.test(suppliedId)
      ? suppliedId
      : randomUUID();

  res.locals.requestId = requestId;
  res.setHeader("X-Request-ID", requestId);
  next();
}
