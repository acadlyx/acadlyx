import { NextFunction, Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { AccessTokenPayload } from "../types/auth";
import { verifyAccessToken } from "../utils/jwt";
import { AppError } from "./errorHandler";

/**
 * Verifies the access token and attaches req.user.
 *
 * The JWT establishes the authenticated subject only. Roles, permissions,
 * account activity, and tenant context are reloaded from the database for
 * every protected request so deactivation and RBAC changes take effect
 * immediately instead of waiting for an access token to expire.
 */
export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  const header = req.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    next(new AppError("Missing or malformed Authorization header", 401));
    return;
  }

  const token = header.slice("Bearer ".length).trim();

  let payload: AccessTokenPayload;
  try {
    payload = verifyAccessToken(token);
  } catch {
    next(new AppError("Invalid or expired access token", 401));
    return;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        institutionId: true,
        email: true,
        isActive: true,
        userRoles: {
          include: {
            role: {
              include: {
                rolePermissions: { include: { permission: true } },
              },
            },
          },
        },
      },
    });

    if (!user || !user.isActive) {
      next(new AppError("User not found or inactive", 401));
      return;
    }

    if (user.institutionId) {
      const institution = await prisma.institution.findUnique({
        where: { id: user.institutionId },
        select: { isActive: true },
      });

      if (!institution?.isActive) {
        next(new AppError("This institution is not currently active", 403));
        return;
      }
    }

    const permissionSet = new Set<string>();
    const roles = user.userRoles.map((userRole) => {
      for (const rolePermission of userRole.role.rolePermissions) {
        permissionSet.add(rolePermission.permission.key);
      }
      return userRole.role.name;
    });

    req.user = {
      id: user.id,
      institutionId: user.institutionId,
      email: user.email,
      roles,
      permissions: Array.from(permissionSet),
    };
    next();
  } catch {
    next(new AppError("Authentication could not be verified", 503));
  }
}
