import {
  NextFunction,
  Request,
  Response,
} from "express";

import {
  AppError,
} from "./errorHandler";

/**
 * Permission-based authorization.
 *
 * Must run AFTER authenticate.
 *
 * Requires ALL supplied permissions.
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

    /*
     * SUPER_ADMIN is the
     * platform root administrator.
     *
     * Its authorization is still
     * constrained by service-level
     * tenant rules where appropriate.
     */
    if (
      req.user.roles.includes(
        "SUPER_ADMIN"
      )
    ) {
      next();

      return;
    }

    const missing =
      requiredPermissions.filter(
        (permission) =>
          !req.user!.permissions.includes(
            permission
          )
      );

    if (
      missing.length > 0
    ) {
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
 * Role boundary for dedicated
 * role-specific workspaces.
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

    const allowed =
      req.user.roles.some(
        (role) =>
          allowedRoles.includes(
            role
          )
      );

    if (!allowed) {
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
