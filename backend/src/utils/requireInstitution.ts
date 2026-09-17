import { Request } from "express";

import { AuthenticatedUser } from "../types/auth";
import { AppError } from "../middleware/errorHandler";

export function getAuthenticatedUser(
  req: Request
): AuthenticatedUser {
  const user = req.user as AuthenticatedUser | undefined;

  if (!user) {
    throw new AppError(
      "Authentication required.",
      401,
      "AUTHENTICATION_REQUIRED"
    );
  }

  return user;
}

export function requireInstitutionId(
  req: Request
): string {
  const user = getAuthenticatedUser(req);

  if (!user.institutionId) {
    throw new AppError(
      "This account is not associated with an institution.",
      403,
      "INSTITUTION_REQUIRED"
    );
  }

  return user.institutionId;
}

export function requirePlatformAdmin(
  req: Request
): AuthenticatedUser {
  const user = getAuthenticatedUser(req);

  if (user.role !== "SUPER_ADMIN") {
    throw new AppError(
      "Platform administrator access is required.",
      403,
      "PLATFORM_ADMIN_REQUIRED"
    );
  }

  return user;
}

export function requireInstitutionAccess(
  req: Request,
  institutionId: string
): string {
  const user = getAuthenticatedUser(req);

  if (user.role === "SUPER_ADMIN") {
    return institutionId;
  }

  if (!user.institutionId) {
    throw new AppError(
      "This account is not associated with an institution.",
      403,
      "INSTITUTION_REQUIRED"
    );
  }

  if (user.institutionId !== institutionId) {
    throw new AppError(
      "You do not have access to this institution.",
      403,
      "TENANT_ACCESS_DENIED"
    );
  }

  return institutionId;
}

export function assertInstitutionMatch(
  userInstitutionId: string | null | undefined,
  recordInstitutionId: string | null | undefined
): void {
  if (
    !userInstitutionId ||
    !recordInstitutionId ||
    userInstitutionId !== recordInstitutionId
  ) {
    throw new AppError(
      "You do not have access to this institution's data.",
      403,
      "TENANT_ACCESS_DENIED"
    );
  }
}
