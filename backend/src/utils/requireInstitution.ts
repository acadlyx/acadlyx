import { Request } from "express";

import { AppError } from "../middleware/errorHandler";
import { AuthenticatedUser } from "../types/auth";

/**
 * Ensures authentication context is available.
 */
export function requireAuthenticatedUser(
  req: Request
): AuthenticatedUser {
  if (!req.user) {
    throw new AppError(
      "Authentication required",
      401
    );
  }

  return req.user;
}

/**
 * Returns the tenant ID from the signed authenticated
 * user context.
 *
 * Tenant-scoped APIs must use this function rather than
 * accepting institutionId from request bodies or query strings.
 */
export function requireInstitution(
  req: Request
): string {
  const user =
    requireAuthenticatedUser(req);

  if (!user.institutionId) {
    throw new AppError(
      "This action requires a user scoped to an institution",
      403
    );
  }

  return user.institutionId;
}

/**
 * Restricts a platform operation to SUPER_ADMIN.
 */
export function requirePlatformAdmin(
  req: Request
): AuthenticatedUser {
  const user =
    requireAuthenticatedUser(req);

  if (
    !user.roles.includes("SUPER_ADMIN")
  ) {
    throw new AppError(
      "Platform administrator access is required",
      403
    );
  }

  return user;
}

/**
 * Useful for operations where an explicit institution
 * resource is being accessed.
 *
 * SUPER_ADMIN may cross institution boundaries for
 * platform administration.
 *
 * Normal tenant users may only access their own institution.
 */
export function assertInstitutionAccess(
  req: Request,
  institutionId: string
): void {
  const user =
    requireAuthenticatedUser(req);

  if (
    user.roles.includes("SUPER_ADMIN")
  ) {
    return;
  }

  if (
    !user.institutionId ||
    user.institutionId !== institutionId
  ) {
    throw new AppError(
      "You do not have access to this institution",
      403
    );
  }
}
