
import { NextFunction, Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { AccessTokenPayload } from "../types/auth";
import { verifyAccessToken } from "../utils/jwt";
import { AppError } from "./errorHandler";

/**
 * Resolve the effective tenant context from the database.
 *
 * Rules:
 * - SUPER_ADMIN is platform-level and must remain institutionId = null.
 * - Institution-scoped roles must belong to exactly one institution.
 * - For legacy/broken accounts where user.institutionId is null but the
 *   institution-scoped role already identifies the tenant, use that role
 *   binding as the authoritative tenant context.
 * - Conflicting institution assignments are rejected rather than guessed.
 */
function resolveInstitutionContext(
  storedInstitutionId: string | null,
  roleBindings: Array<{
    role: {
      name: string;
      institutionId: string | null;
    };
  }>
): string | null {
  const hasSuperAdmin = roleBindings.some(
    ({ role }) => role.name === "SUPER_ADMIN"
  );

  if (hasSuperAdmin) {
    if (storedInstitutionId !== null) {
      throw new AppError(
        "SUPER_ADMIN must be a platform-level account",
        403
      );
    }

    const hasInstitutionScopedRole = roleBindings.some(
      ({ role }) => role.name !== "SUPER_ADMIN" && role.institutionId !== null
    );

    if (hasInstitutionScopedRole) {
      throw new AppError(
        "SUPER_ADMIN cannot also be bound to an institution-scoped role",
        403
      );
    }

    return null;
  }

  const scopedInstitutionIds = Array.from(
    new Set(
      roleBindings
        .map(({ role }) => role.institutionId)
        .filter(
          (institutionId): institutionId is string =>
            Boolean(institutionId)
        )
    )
  );

  if (scopedInstitutionIds.length > 1) {
    throw new AppError(
      "This account is associated with multiple institutions and cannot be safely scoped",
      403
    );
  }

  const roleInstitutionId =
    scopedInstitutionIds[0] ?? null;

  if (
    storedInstitutionId &&
    roleInstitutionId &&
    storedInstitutionId !== roleInstitutionId
  ) {
    throw new AppError(
      "User institution and role institution do not match",
      403
    );
  }

  return storedInstitutionId ?? roleInstitutionId;
}

/**
 * Verifies the access token and attaches a fresh authenticated context.
 *
 * The JWT establishes the authenticated subject only.
 * Roles, permissions, account status and effective tenant scope are
 * reloaded from the database on every protected request.
 *
 * This prevents stale JWT tenant/RBAC information from bypassing current
 * database state.
 */
export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  const header = req.headers.authorization;

  if (
    !header ||
    !header.startsWith("Bearer ")
  ) {
    next(
      new AppError(
        "Missing or malformed Authorization header",
        401
      )
    );
    return;
  }

  const token = header
    .slice("Bearer ".length)
    .trim();

  if (!token) {
    next(
      new AppError(
        "Missing access token",
        401
      )
    );
    return;
  }

  let payload: AccessTokenPayload;

  try {
    payload = verifyAccessToken(token);
  } catch {
    next(
      new AppError(
        "Invalid or expired access token",
        401
      )
    );
    return;
  }

  try {
    const user =
      await prisma.user.findUnique({
        where: {
          id: payload.sub,
        },
        select: {
          id: true,
          institutionId: true,
          email: true,
          isActive: true,

          userRoles: {
            include: {
              role: {
                include: {
                  rolePermissions: {
                    include: {
                      permission: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

    if (!user || !user.isActive) {
      next(
        new AppError(
          "User not found or inactive",
          401
        )
      );
      return;
    }

    let effectiveInstitutionId: string | null;

    try {
      effectiveInstitutionId =
        resolveInstitutionContext(
          user.institutionId,
          user.userRoles
        );
    } catch (error) {
      next(error);
      return;
    }

    /*
     * If an older institution-admin account has a missing institutionId
     * but its institution-scoped role identifies exactly one tenant,
     * repair the account so subsequent requests, /auth/me and dashboard
     * APIs all receive the same correct tenant context.
     *
     * This is deliberately limited to the safe case:
     * exactly one institution and no SUPER_ADMIN role.
     */
    if (
      user.institutionId === null &&
      effectiveInstitutionId !== null
    ) {
      const isInstitutionAdmin = user.userRoles.some(
        ({ role }) => role.name === "INSTITUTION_ADMIN"
      );

      if (!isInstitutionAdmin) {
        next(
          new AppError(
            "This institution-scoped account has no valid tenant identity",
            403
          )
        );
        return;
      }

      await prisma.user.update({
        where: {
          id: user.id,
        },
        data: {
          institutionId: effectiveInstitutionId,
        },
      });
    }

    if (effectiveInstitutionId) {
      const institution =
        await prisma.institution.findUnique({
          where: {
            id: effectiveInstitutionId,
          },
          select: {
            id: true,
            isActive: true,
            subscription: {
              select: {
                status: true,
                expiresAt: true,
              },
            },
          },
        });

      if (!institution) {
        next(
          new AppError(
            "The institution associated with this account no longer exists",
            403
          )
        );
        return;
      }

      if (!institution.isActive) {
        next(
          new AppError(
            "This institution is not currently active",
            403
          )
        );
        return;
      }

      const subscription =
        institution.subscription;

      if (
        subscription &&
        (
          [
            "EXPIRED",
            "SUSPENDED",
            "CANCELLED",
          ].includes(
            subscription.status
          ) ||
          (
            subscription.expiresAt &&
            subscription.expiresAt <
              new Date()
          )
        )
      ) {
        next(
          new AppError(
            "This tenant subscription is not active",
            403
          )
        );
        return;
      }
    }

    const permissionSet =
      new Set<string>();

    const roles =
      user.userRoles.map(
        (userRole) => {
          for (
            const rolePermission of
              userRole.role
                .rolePermissions
          ) {
            permissionSet.add(
              rolePermission
                .permission.key
            );
          }

          return userRole.role.name;
        }
      );

    /*
     * Never trust tenant context from the JWT or browser.
     * The effective institution comes from the current database state.
     */
    req.user = {
      id: user.id,
      institutionId:
        effectiveInstitutionId,
      email: user.email,
      roles,
      permissions:
        Array.from(
          permissionSet
        ),
    };

    next();
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
      return;
    }

    next(
      new AppError(
        "Authentication could not be verified",
        503
      )
    );
  }
}

