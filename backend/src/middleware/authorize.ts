import {
  NextFunction,
  Request,
  Response,
} from "express";

import {
  PermissionKey,
  isPlatformPermission,
  normalizeRoleName,
} from "../config/rbac";

import {
  AppError,
} from "./errorHandler";

/**
 * Permission-based authorization.
 *
 * This middleware is intentionally NOT a role check.
 *
 * Role -> permission assignment happens in RBAC.
 * Data scope and workflow authority are enforced separately.
 *
 * IMPORTANT:
 *
 * SUPER_ADMIN is NOT an automatic bypass anymore.
 *
 * This is deliberate.
 *
 * Platform authority and institution operational authority are separate
 * domains.
 */
export function authorize(
  ...requiredPermissions: PermissionKey[]
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

    const user =
      req.user;

    const hasPlatformRole = user.roles.some(
      (role) => normalizeRoleName(role) === "SUPER_ADMIN"
    );

    /*
     * Institutional permissions require a tenant context.
     * SUPER_ADMIN is the only platform role that may operate without
     * an institutionId at this middleware boundary.
     *
     * Narrower department/program/course/student ownership remains the
     * responsibility of the service/resource authorization layer.
     */
    if (!hasPlatformRole && !user.institutionId) {
      next(
        new AppError(
          "Institution context is required for this operation",
          403
        )
      );
      return;
    }

    const missing =
      requiredPermissions.filter(
        (
          permission
        ) =>
          !user.permissions.includes(
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

    /*
     * Platform permissions have an additional role-level gate.
     *
     * Even if stale permission rows accidentally exist in the database,
     * an institution role cannot use platform permissions.
     */
    const requestingPlatformPermission =
      requiredPermissions.some(
        (
          permission
        ) =>
          isPlatformPermission(
            permission
          )
      );

    if (
      requestingPlatformPermission &&
      !user.roles.some(
        (role) => normalizeRoleName(role) === "SUPER_ADMIN"
      )
    ) {
      next(
        new AppError(
          "Platform authority is restricted to SUPER_ADMIN",
          403
        )
      );

      return;
    }

    next();
  };
}

/**
 * Role boundary for dedicated workspaces.
 *
 * This is a UI/workspace boundary only.
 *
 * Resource-level authorization must still happen through permissions
 * and service-level scope checks.
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

    const normalizedAllowedRoles = new Set(
      allowedRoles
        .map((role) => normalizeRoleName(role))
        .filter(
          (role): role is NonNullable<ReturnType<typeof normalizeRoleName>> =>
            Boolean(role)
        )
    );

    const allowed = req.user.roles.some((role) => {
      const normalized = normalizeRoleName(role);
      return Boolean(
        normalized && normalizedAllowedRoles.has(normalized)
      );
    });

    if (!allowed) {
      next(
        new AppError(
          "This workspace is not assigned to your role",
          403
        )
      );

      return;
    }

    const hasPlatformRole = req.user.roles.some(
      (role) => normalizeRoleName(role) === "SUPER_ADMIN"
    );

    if (!hasPlatformRole && !req.user.institutionId) {
      next(
        new AppError(
          "Institution context is required for this workspace",
          403
        )
      );
      return;
    }

    next();
  };
}

/**
 * Requires the authenticated user to possess one of the supplied roles.
 */
export function authorizeAnyRole(
  ...allowedRoles: string[]
) {
  return authorizeRoles(
    ...allowedRoles
  );
}

/**
 * Requires the authenticated user to possess every supplied permission.
 */
export function authorizeAll(
  ...requiredPermissions: PermissionKey[]
) {
  return authorize(
    ...requiredPermissions
  );
}

/**
 * Requires at least one of the supplied permissions.
 *
 * Useful for read-only dashboards where several specialist roles may
 * legitimately access the same resource.
 */
export function authorizeAnyPermission(
  ...permissions: PermissionKey[]
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
      permissions.some(
        (
          permission
        ) =>
          req.user!.permissions.includes(
            permission
          )
      );

    const hasPlatformRole = req.user.roles.some(
      (role) => normalizeRoleName(role) === "SUPER_ADMIN"
    );

    if (!hasPlatformRole && !req.user.institutionId) {
      next(
        new AppError(
          "Institution context is required for this operation",
          403
        )
      );
      return;
    }

    if (!allowed) {
      next(
        new AppError(
          `At least one required permission is needed: ${permissions.join(
            ", "
          )}`,
          403
        )
      );

      return;
    }

    const platformPermissionRequested =
      permissions.some(
        (
          permission
        ) =>
          isPlatformPermission(
            permission
          )
      );

    if (
      platformPermissionRequested &&
      !req.user.roles.some(
        (role) => normalizeRoleName(role) === "SUPER_ADMIN"
      )
    ) {
      next(
        new AppError(
          "Platform authority is restricted to SUPER_ADMIN",
          403
        )
      );

      return;
    }

    next();
  };
}
