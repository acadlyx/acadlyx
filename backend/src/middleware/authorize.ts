import { NextFunction, Request, Response } from "express";
import { AppError } from "./errorHandler";

/**
 * Permission-based RBAC middleware. Roles are just named bundles of
 * permissions — route handlers should check permissions, never role
 * names, so institutions can define their own roles later without
 * any controller code changing.
 *
 * Must run after `authenticate`. Requires ALL listed permissions.
 */
export function authorize(...requiredPermissions: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new AppError("Authentication required", 401));
      return;
    }

    const missing = requiredPermissions.filter(
      (perm) => !req.user!.permissions.includes(perm)
    );

    if (missing.length > 0) {
      next(
        new AppError(
          `Missing required permission(s): ${missing.join(", ")}`,
          403
        )
      );
      return;
    }

    next();
  };
}

/** Route-level role boundary for dedicated self-service workspaces. */
export function authorizeRoles(...allowedRoles: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) return next(new AppError("Authentication required", 401));
    if (!req.user.roles.some((role) => allowedRoles.includes(role))) {
      return next(new AppError("This workspace is not assigned to your role", 403));
    }
    next();
  };
}
