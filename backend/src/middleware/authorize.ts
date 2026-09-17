import { Request, Response, NextFunction } from "express";

import { AppError } from "./errorHandler";

type Permission =
  | string
  | string[];

function getUser(req: Request) {
  const user = req.user;

  if (!user) {
    throw new AppError(
      "Authentication required.",
      401,
      "AUTHENTICATION_REQUIRED"
    );
  }

  return user;
}

function hasPermission(
  permissions: string[] | undefined,
  required: string
): boolean {
  if (!permissions) {
    return false;
  }

  return (
    permissions.includes("*") ||
    permissions.includes(required)
  );
}

export function authorize(
  required: Permission
) {
  return (
    req: Request,
    _res: Response,
    next: NextFunction
  ) => {
    try {
      const user = getUser(req);

      const requiredPermissions = Array.isArray(
        required
      )
        ? required
        : [required];

      const userPermissions =
        user.permissions ?? [];

      const authorized =
        requiredPermissions.some((permission) =>
          hasPermission(
            userPermissions,
            permission
          )
        );

      /*
       * SUPER_ADMIN is a platform-level role.
       *
       * It is intentionally handled separately from
       * institutional permissions.
       */
      if (user.role === "SUPER_ADMIN") {
        next();
        return;
      }

      if (!authorized) {
        throw new AppError(
          "You do not have permission to perform this action.",
          403,
          "PERMISSION_DENIED"
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

export function authorizeAny(
  permissions: string[]
) {
  return authorize(permissions);
}

export function authorizeAll(
  permissions: string[]
) {
  return (
    req: Request,
    _res: Response,
    next: NextFunction
  ) => {
    try {
      const user = getUser(req);

      if (user.role === "SUPER_ADMIN") {
        next();
        return;
      }

      const userPermissions =
        user.permissions ?? [];

      const authorized = permissions.every(
        (permission) =>
          hasPermission(
            userPermissions,
            permission
          )
      );

      if (!authorized) {
        throw new AppError(
          "You do not have all required permissions.",
          403,
          "PERMISSION_DENIED"
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}
