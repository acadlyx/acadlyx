import { User } from "@prisma/client";
import { AppError } from "../middleware/errorHandler";
import { prisma } from "../lib/prisma";
import { AccessTokenPayload, AuthenticatedUser } from "../types/auth";
import {
  generateRefreshToken,
  hashToken,
  refreshTokenExpiryDate,
  signAccessToken,
} from "../utils/jwt";
import { comparePassword } from "../utils/password";
import { recordAuditLog } from "./audit.service";

export interface RequestMeta {
  ipAddress?: string;
  userAgent?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
}

export interface SafeUser {
  id: string;
  institutionId: string | null;
  email: string;
  firstName: string;
  lastName: string;
  roles: string[];
  permissions: string[];
}

/**
 * Loads a user's current roles and the flattened, de-duplicated set
 * of permission keys those roles grant. Called at login, at refresh,
 * and by /auth/me — always fresh from the database, never cached
 * across requests, so a role/permission change takes effect the
 * next time the user's token is refreshed.
 */
async function loadRolesAndPermissions(
  userId: string
): Promise<{ roles: string[]; permissions: string[] }> {
  const userRoles = await prisma.userRole.findMany({
    where: { userId },
    include: {
      role: {
        include: {
          rolePermissions: { include: { permission: true } },
        },
      },
    },
  });

  const roles = userRoles.map((ur) => ur.role.name);
  const permissionSet = new Set<string>();
  for (const ur of userRoles) {
    for (const rp of ur.role.rolePermissions) {
      permissionSet.add(rp.permission.key);
    }
  }

  return { roles, permissions: Array.from(permissionSet) };
}

function toSafeUser(
  user: User,
  roles: string[],
  permissions: string[]
): SafeUser {
  return {
    id: user.id,
    institutionId: user.institutionId,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    roles,
    permissions,
  };
}

async function issueTokens(
  user: User,
  roles: string[],
  permissions: string[],
  meta: RequestMeta
): Promise<AuthTokens> {
  const payload: AccessTokenPayload = {
    sub: user.id,
    institutionId: user.institutionId,
    email: user.email,
    roles,
    permissions,
  };

  const accessToken = signAccessToken(payload);
  const refreshTokenPlain = generateRefreshToken();

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(refreshTokenPlain),
      expiresAt: refreshTokenExpiryDate(),
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    },
  });

  return {
    accessToken,
    refreshToken: refreshTokenPlain,
    expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || "15m",
  };
}

export async function login(
  email: string,
  password: string,
  meta: RequestMeta
): Promise<{ user: SafeUser; tokens: AuthTokens }> {
  const user = await prisma.user.findUnique({ where: { email } });

  // Same error for "no such user" and "wrong password" — do not
  // reveal which one it was.
  const invalidCredentials = () =>
    new AppError("Invalid email or password", 401);

  if (!user) {
    await recordAuditLog({
      action: "auth.login_failed",
      metadata: { email, reason: "user_not_found" },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });
    throw invalidCredentials();
  }

  if (!user.isActive) {
    await recordAuditLog({
      institutionId: user.institutionId,
      userId: user.id,
      action: "auth.login_failed",
      metadata: { reason: "account_inactive" },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });
    throw new AppError("This account has been deactivated", 403);
  }

  if (user.institutionId) {
    const institution = await prisma.institution.findUnique({
      where: { id: user.institutionId },
    });
    if (!institution || !institution.isActive) {
      throw new AppError("This institution is not currently active", 403);
    }
    const subscription = await prisma.tenantSubscription.findUnique({ where: { institutionId: user.institutionId } });
    if (subscription && (["EXPIRED", "SUSPENDED", "CANCELLED"].includes(subscription.status) || (subscription.expiresAt && subscription.expiresAt < new Date()))) {
      throw new AppError("This tenant subscription is not active", 403);
    }
  }

  const passwordMatches = await comparePassword(password, user.passwordHash);
  if (!passwordMatches) {
    await recordAuditLog({
      institutionId: user.institutionId,
      userId: user.id,
      action: "auth.login_failed",
      metadata: { reason: "bad_password" },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });
    throw invalidCredentials();
  }

  const { roles, permissions } = await loadRolesAndPermissions(user.id);
  const tokens = await issueTokens(user, roles, permissions, meta);

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  await recordAuditLog({
    institutionId: user.institutionId,
    userId: user.id,
    action: "auth.login",
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });

  return { user: toSafeUser(user, roles, permissions), tokens };
}

export async function refresh(
  refreshTokenPlain: string,
  meta: RequestMeta
): Promise<{ user: SafeUser; tokens: AuthTokens }> {
  const tokenHash = hashToken(refreshTokenPlain);
  const existing = await prisma.refreshToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  const invalid = () => new AppError("Invalid or expired refresh token", 401);

  if (!existing) {
    throw invalid();
  }

  if (existing.revokedAt) {
    // Reuse of an already-rotated/revoked token — treat as possible
    // theft and revoke every active token for this user.
    await prisma.refreshToken.updateMany({
      where: { userId: existing.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await recordAuditLog({
      userId: existing.userId,
      action: "auth.refresh_token_reuse_detected",
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });
    throw invalid();
  }

  if (existing.expiresAt < new Date()) {
    throw invalid();
  }

  if (!existing.user.isActive) {
    throw new AppError("This account has been deactivated", 403);
  }

  // Rotate: revoke the presented token, issue a brand new pair.
  await prisma.refreshToken.update({
    where: { id: existing.id },
    data: { revokedAt: new Date() },
  });

  const { roles, permissions } = await loadRolesAndPermissions(
    existing.user.id
  );
  const tokens = await issueTokens(existing.user, roles, permissions, meta);

  await recordAuditLog({
    institutionId: existing.user.institutionId,
    userId: existing.user.id,
    action: "auth.token_refresh",
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });

  return {
    user: toSafeUser(existing.user, roles, permissions),
    tokens,
  };
}

export async function logout(
  refreshTokenPlain: string,
  meta: RequestMeta
): Promise<void> {
  const tokenHash = hashToken(refreshTokenPlain);
  const existing = await prisma.refreshToken.findUnique({
    where: { tokenHash },
  });

  // Idempotent: logging out with an already-invalid token is not an error.
  if (!existing || existing.revokedAt) {
    return;
  }

  await prisma.refreshToken.update({
    where: { id: existing.id },
    data: { revokedAt: new Date() },
  });

  await recordAuditLog({
    userId: existing.userId,
    action: "auth.logout",
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });
}

export async function getCurrentUser(
  authUser: AuthenticatedUser
): Promise<SafeUser> {
  const user = await prisma.user.findUnique({ where: { id: authUser.id } });
  if (!user || !user.isActive) {
    throw new AppError("User not found or inactive", 401);
  }

  const { roles, permissions } = await loadRolesAndPermissions(user.id);
  return toSafeUser(user, roles, permissions);
}
