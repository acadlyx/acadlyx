import {
  NextFunction,
  Request,
  Response,
} from "express";

import { AppError } from "./errorHandler";

/**
 * Permission-based authorization.
 *
 * Requires ALL permissions passed to authorize().
 *
 * Roles themselves are permission bundles. Business APIs
 * should normally authorize permissions instead of hard-coding
 * role names.
 */
export function authorize(
  ...requiredPermissions: string[]
) {
  return (
    req: Request,
    _res: Response,
    next: NextFunction
  ): void => {
    if (!req.user) {
      next(
        new AppError(
          "Authentication required",
          401
        )
      );

      return;
    }

    const missing =
      requiredPermissions.filter(
        (permission) =>
          !req.user!.permissions.includes(
            permission
          )
      );

    if (missing.length > 0) {
      next(
        new AppError(
          `Missing required permission(s): ${missing.join(
            ", "
          )}`,
          403
        )
      );

      return;
    }

    next();
  };
}

/**
 * Requires at least ONE of the supplied permissions.
 */
export function authorizeAny(
  ...allowedPermissions: string[]
) {
  return (
    req: Request,
    _res: Response,
    next: NextFunction
  ): void => {
    if (!req.user) {
      next(
        new AppError(
          "Authentication required",
          401
        )
      );

      return;
    }

    const allowed =
      allowedPermissions.some(
        (permission) =>
          req.user!.permissions.includes(
            permission
          )
      );

    if (!allowed) {
      next(
        new AppError(
          `Requires one of these permissions: ${allowedPermissions.join(
            ", "
          )}`,
          403
        )
      );

      return;
    }

    next();
  };
}

/**
 * Used only when a workspace itself belongs to
 * particular system roles.
 */
export function authorizeRoles(
  ...allowedRoles: string[]
) {
  return (
    req: Request,
    _res: Response,
    next: NextFunction
  ): void => {
    if (!req.user) {
      next(
        new AppError(
          "Authentication required",
          401
        )
      );

      return;
    }

    const hasRole =
      req.user.roles.some((role) =>
        allowedRoles.includes(role)
      );

    if (!hasRole) {
      next(
        new AppError(
          "This workspace is not assigned to your role",
          403
        )
      );

      return;
    }

    next();
  };
}
