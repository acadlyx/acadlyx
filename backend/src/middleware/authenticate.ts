import { NextFunction, Request, Response } from "express";
import { verifyAccessToken } from "../utils/jwt";
import { AppError } from "./errorHandler";

/**
 * Verifies the access token and attaches req.user.
 *
 * Tenant context rule: req.user.institutionId comes ONLY from the
 * verified JWT (which was itself built from the database at
 * login/refresh time). No route handler should ever read an
 * institutionId from req.body/req.query/req.params and trust it
 * for authorization or data scoping — always use req.user.institutionId.
 */
export function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const header = req.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    next(new AppError("Missing or malformed Authorization header", 401));
    return;
  }

  const token = header.slice("Bearer ".length).trim();

  try {
    const payload = verifyAccessToken(token);
    req.user = {
      id: payload.sub,
      institutionId: payload.institutionId,
      email: payload.email,
      roles: payload.roles,
      permissions: payload.permissions,
    };
    next();
  } catch {
    next(new AppError("Invalid or expired access token", 401));
  }
}
