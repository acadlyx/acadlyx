import {
  Request,
} from "express";

import {
  AppError,
} from "../middleware/errorHandler";

import {
  AuthenticatedUser,
} from "../types/auth";

/**
 * Returns the authenticated
 * request context.
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
 * Every tenant-scoped operation must
 * derive institutionId from the
 * authenticated request context.
 *
 * Never trust institutionId supplied
 * by browser/client input.
 */
export function requireInstitution(
  req: Request
): string {
  const user =
    requireAuthenticatedUser(
      req
    );

  if (
    !user.institutionId
  ) {
    throw new AppError(
      "This action requires a user scoped to an institution",
      403
    );
  }

  return user.institutionId;
}

/**
 * Platform-level operations only.
 */
export function requirePlatformAdmin(
  req: Request
): AuthenticatedUser {
  const user =
    requireAuthenticatedUser(
      req
    );

  if (
    !user.roles.includes(
      "SUPER_ADMIN"
    )
  ) {
    throw new AppError(
      "Platform administrator access is required",
      403
    );
  }

  return user;
}

/**
 * Reusable protection for entities
 * where institution ownership must
 * be checked manually.
 */
export function assertSameInstitution(
  user: AuthenticatedUser,
  recordInstitutionId: string
): void {
  /*
   * Platform administrator may
   * inspect platform-managed data.
   */
  if (
    user.roles.includes(
      "SUPER_ADMIN"
    )
  ) {
    return;
  }

  if (
    !user.institutionId ||
    user.institutionId !==
      recordInstitutionId
  ) {
    throw new AppError(
      "Cross-institution access is not permitted",
      403
    );
  }
}
