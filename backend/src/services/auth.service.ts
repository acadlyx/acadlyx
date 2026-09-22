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
import { comparePassword, hashPassword } from "../utils/password";
import { recordAuditLog } from "./audit.service";
import {
  getCanonicalRoleNames,
  getEffectivePermissions,
} from "../config/rbac";
import {
  assertNotLocked,
  clearFailedLogins,
  createMfaChallenge,
  consumeMfaChallenge,
  recordFailedLogin,
} from "./accountSecurity.service";

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

type RoleBinding = {
  role: {
    name: string;
    institutionId: string | null;
    rolePermissions: Array<{
      permission: {
        key: string;
      };
    }>;
  };
};

/**
 * Resolve the tenant from the current database state.
 *
 * SUPER_ADMIN is platform-wide.
 *
 * All other users must resolve to exactly one institution. For legacy
 * accounts where user.institutionId is missing but an institution-scoped
 * role identifies exactly one institution, the account is repaired.
 */
async function resolveEffectiveInstitution(
  user: {
    id: string;
    institutionId: string | null;
  },
  userRoles: RoleBinding[]
): Promise<string | null> {
  const hasSuperAdmin = userRoles.some(
    (binding) => binding.role.name === "SUPER_ADMIN"
  );

  if (hasSuperAdmin) {
    if (user.institutionId !== null) {
      throw new AppError(
        "SUPER_ADMIN must be a platform-level account",
        403
      );
    }

    const hasInstitutionScopedRole = userRoles.some(
      (binding) =>
        binding.role.name !== "SUPER_ADMIN" &&
        binding.role.institutionId !== null
    );

    if (hasInstitutionScopedRole) {
      throw new AppError(
        "SUPER_ADMIN cannot also be bound to an institution-scoped role",
        403
      );
    }

    return null;
  }

  const institutionIds = Array.from(
    new Set(
      userRoles
        .map(
          (binding) =>
            binding.role.institutionId
        )
        .filter(
          (
            institutionId
          ): institutionId is string =>
            Boolean(institutionId)
        )
    )
  );

  if (institutionIds.length > 1) {
    throw new AppError(
      "This account is associated with multiple institutions",
      403
    );
  }

  const roleInstitutionId =
    institutionIds[0] ?? null;

  if (
    user.institutionId &&
    roleInstitutionId &&
    user.institutionId !==
      roleInstitutionId
  ) {
    throw new AppError(
      "User institution and role institution do not match",
      403
    );
  }

  const effectiveInstitutionId =
    user.institutionId ??
    roleInstitutionId;

  if (
    !effectiveInstitutionId
  ) {
    throw new AppError(
      "This account is not associated with an institution",
      403
    );
  }

  /*
   * Repair legacy users safely.
   *
   * We only do this when there is exactly one institution-scoped role
   * binding, so there is no ambiguity about the tenant.
   */
  if (!user.institutionId) {
    await prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        institutionId:
          effectiveInstitutionId,
      },
    });
  }

  return effectiveInstitutionId;
}

/**
 * Load current roles and permissions from the database.
 */
async function loadRolesAndPermissions(
  userId: string
): Promise<{
  roles: string[];
  permissions: string[];
  institutionId: string | null;
}> {
  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      id: true,
      institutionId: true,
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

  if (!user) {
    throw new AppError(
      "User not found",
      401
    );
  }

  const roles = getCanonicalRoleNames(
    user.userRoles.map(
      (userRole) => userRole.role.name
    )
  );

  const permissions = getEffectivePermissions(roles);

  const institutionId =
    await resolveEffectiveInstitution(
      user,
      user.userRoles
    );

  return {
    roles,
    permissions,
    institutionId,
  };
}

function toSafeUser(
  user: User,
  roles: string[],
  permissions: string[],
  institutionId: string | null
): SafeUser {
  return {
    id: user.id,
    institutionId,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    roles,
    permissions,
  };
}

/**
 * Verify that the tenant is active and its subscription is usable.
 */
async function assertInstitutionUsable(
  institutionId: string | null
): Promise<void> {
  if (!institutionId) {
    return;
  }

  const institution =
    await prisma.institution.findUnique({
      where: {
        id: institutionId,
      },
      select: {
        id: true,
        isActive: true,
      },
    });

  if (!institution) {
    throw new AppError(
      "The institution associated with this account no longer exists",
      403
    );
  }

  if (!institution.isActive) {
    throw new AppError(
      "This institution is not currently active",
      403
    );
  }

  const subscription =
    await prisma.tenantSubscription.findUnique(
      {
        where: {
          institutionId,
        },
        select: {
          status: true,
          expiresAt: true,
        },
      }
    );

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
    throw new AppError(
      "This tenant subscription is not active",
      403
    );
  }
}

async function issueTokens(
  user: User,
  roles: string[],
  permissions: string[],
  institutionId: string | null,
  meta: RequestMeta
): Promise<AuthTokens> {
  const payload: AccessTokenPayload = {
    sub: user.id,
    institutionId,
    email: user.email,
    roles,
    permissions,
  };

  const accessToken =
    signAccessToken(payload);

  const refreshTokenPlain =
    generateRefreshToken();

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash:
        hashToken(
          refreshTokenPlain
        ),
      expiresAt:
        refreshTokenExpiryDate(),
      ipAddress:
        meta.ipAddress,
      userAgent:
        meta.userAgent,
    },
  });

  return {
    accessToken,
    refreshToken:
      refreshTokenPlain,
    expiresIn:
      process.env
        .JWT_ACCESS_EXPIRES_IN ||
      "15m",
  };
}

/**
 * Result of a password check.
 *
 * When the account has a second factor enrolled, no tokens are issued:
 * the caller receives a short-lived challenge and must complete
 * `completeMfaLogin` before holding any credential.
 */
export type LoginResult =
  | { mfaRequired: false; user: SafeUser; tokens: AuthTokens }
  | { mfaRequired: true; challengeToken: string; expiresAt: Date };

export async function login(
  email: string,
  password: string,
  meta: RequestMeta
): Promise<LoginResult> {
  const user =
    await prisma.user.findUnique({
      where: {
        email,
      },
    });

  const invalidCredentials =
    () =>
      new AppError(
        "Invalid email or password",
        401
      );

  if (!user) {
    await recordAuditLog({
      action:
        "auth.login_failed",
      metadata: {
        email,
        reason:
          "user_not_found",
      },
      ipAddress:
        meta.ipAddress,
      userAgent:
        meta.userAgent,
    });

    throw invalidCredentials();
  }

  if (!user.isActive) {
    await recordAuditLog({
      institutionId:
        user.institutionId,
      userId: user.id,
      action:
        "auth.login_failed",
      metadata: {
        reason:
          "account_inactive",
      },
      ipAddress:
        meta.ipAddress,
      userAgent:
        meta.userAgent,
    });

    throw new AppError(
      "This account has been deactivated",
      403
    );
  }

  /*
   * Brute-force guard. Runs before the (deliberately slow) bcrypt
   * comparison so a locked account also stops burning CPU.
   */
  await assertNotLocked(user);

  const passwordMatches =
    await comparePassword(
      password,
      user.passwordHash
    );

  if (!passwordMatches) {
    await recordFailedLogin(
      user.id,
      user.institutionId,
      meta
    );

    await recordAuditLog({
      institutionId:
        user.institutionId,
      userId: user.id,
      action:
        "auth.login_failed",
      metadata: {
        reason:
          "bad_password",
      },
      ipAddress:
        meta.ipAddress,
      userAgent:
        meta.userAgent,
    });

    throw invalidCredentials();
  }

  await clearFailedLogins(user.id);

  /*
   * Second factor. The password was correct, but nothing is issued yet:
   * the challenge only authorises the verification step.
   */
  if (user.mfaEnabled && user.mfaSecret) {
    const challenge = await createMfaChallenge(
      user.id,
      meta.ipAddress
    );

    await recordAuditLog({
      institutionId: user.institutionId,
      userId: user.id,
      action: "auth.mfa_challenged",
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return {
      mfaRequired: true,
      challengeToken: challenge.challengeToken,
      expiresAt: challenge.expiresAt,
    };
  }

  /*
   * Load current role/permission state BEFORE issuing tokens.
   * This also repairs a legacy institution-admin account whose
   * institutionId is missing.
   */
  const {
    roles,
    permissions,
    institutionId,
  } =
    await loadRolesAndPermissions(
      user.id
    );

  await assertInstitutionUsable(
    institutionId
  );

  /*
   * Re-read the user after possible tenant repair so the returned
   * object and token are guaranteed to contain the same tenant.
   */
  const freshUser =
    await prisma.user.findUnique({
      where: {
        id: user.id,
      },
    });

  if (!freshUser) {
    throw new AppError(
      "User could not be loaded after authentication",
      500
    );
  }

  const tokens =
    await issueTokens(
      freshUser,
      roles,
      permissions,
      institutionId,
      meta
    );

  await prisma.user.update({
    where: {
      id: freshUser.id,
    },
    data: {
      lastLoginAt:
        new Date(),
    },
  });

  await recordAuditLog({
    institutionId,
    userId:
      freshUser.id,
    action:
      "auth.login",
    ipAddress:
      meta.ipAddress,
    userAgent:
      meta.userAgent,
  });

  return {
    mfaRequired: false,
    user: toSafeUser(
      freshUser,
      roles,
      permissions,
      institutionId
    ),
    tokens,
  };
}

/**
 * Second step of an MFA sign-in. The challenge is verified and consumed
 * by accountSecurity.service; only then are real tokens minted, through
 * exactly the same path a non-MFA login uses.
 */
export async function completeMfaLogin(
  challengeToken: string,
  code: string,
  meta: RequestMeta
): Promise<{ user: SafeUser; tokens: AuthTokens }> {
  const userId = await consumeMfaChallenge(
    challengeToken,
    code,
    meta
  );

  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user || !user.isActive) {
    throw new AppError("This account is no longer active", 403);
  }

  const { roles, permissions, institutionId } =
    await loadRolesAndPermissions(user.id);

  await assertInstitutionUsable(institutionId);

  const tokens = await issueTokens(
    user,
    roles,
    permissions,
    institutionId,
    meta
  );

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  await recordAuditLog({
    institutionId,
    userId: user.id,
    action: "auth.login",
    metadata: { secondFactor: true },
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });

  return {
    user: toSafeUser(user, roles, permissions, institutionId),
    tokens,
  };
}

export async function refresh(
  refreshTokenPlain: string,
  meta: RequestMeta
): Promise<{
  user: SafeUser;
  tokens: AuthTokens;
}> {
  const tokenHash =
    hashToken(
      refreshTokenPlain
    );

  const existing =
    await prisma.refreshToken.findUnique(
      {
        where: {
          tokenHash,
        },
        include: {
          user: true,
        },
      }
    );

  const invalid =
    () =>
      new AppError(
        "Invalid or expired refresh token",
        401
      );

  if (!existing) {
    throw invalid();
  }

  if (existing.revokedAt) {
    await prisma.refreshToken.updateMany(
      {
        where: {
          userId:
            existing.userId,
          revokedAt: null,
        },
        data: {
          revokedAt:
            new Date(),
        },
      }
    );

    await recordAuditLog({
      userId:
        existing.userId,
      action:
        "auth.refresh_token_reuse_detected",
      ipAddress:
        meta.ipAddress,
      userAgent:
        meta.userAgent,
    });

    throw invalid();
  }

  if (
    existing.expiresAt <
    new Date()
  ) {
    throw invalid();
  }

  if (!existing.user.isActive) {
    throw new AppError(
      "This account has been deactivated",
      403
    );
  }

  /*
   * Resolve current roles and tenant again.
   * This means a tenant change, role change, suspension or entitlement
   * change is not hidden behind an old refresh token.
   */
  const {
    roles,
    permissions,
    institutionId,
  } =
    await loadRolesAndPermissions(
      existing.user.id
    );

  await assertInstitutionUsable(
    institutionId
  );

  await prisma.refreshToken.update({
    where: {
      id: existing.id,
    },
    data: {
      revokedAt:
        new Date(),
    },
  });

  const freshUser =
    await prisma.user.findUnique({
      where: {
        id: existing.user.id,
      },
    });

  if (!freshUser) {
    throw invalid();
  }

  const tokens =
    await issueTokens(
      freshUser,
      roles,
      permissions,
      institutionId,
      meta
    );

  await recordAuditLog({
    institutionId,
    userId:
      freshUser.id,
    action:
      "auth.token_refresh",
    ipAddress:
      meta.ipAddress,
    userAgent:
      meta.userAgent,
  });

  return {
    user: toSafeUser(
      freshUser,
      roles,
      permissions,
      institutionId
    ),
    tokens,
  };
}

export async function logout(
  refreshTokenPlain: string,
  meta: RequestMeta
): Promise<void> {
  const tokenHash =
    hashToken(
      refreshTokenPlain
    );

  const existing =
    await prisma.refreshToken.findUnique(
      {
        where: {
          tokenHash,
        },
      }
    );

  if (
    !existing ||
    existing.revokedAt
  ) {
    return;
  }

  await prisma.refreshToken.update({
    where: {
      id: existing.id,
    },
    data: {
      revokedAt:
        new Date(),
    },
  });

  await recordAuditLog({
    userId:
      existing.userId,
    action:
      "auth.logout",
    ipAddress:
      meta.ipAddress,
    userAgent:
      meta.userAgent,
  });
}

export async function getCurrentUser(
  authUser: AuthenticatedUser
): Promise<SafeUser> {
  const user =
    await prisma.user.findUnique({
      where: {
        id: authUser.id,
      },
    });

  if (!user || !user.isActive) {
    throw new AppError(
      "User not found or inactive",
      401
    );
  }

  const {
    roles,
    permissions,
    institutionId,
  } =
    await loadRolesAndPermissions(
      user.id
    );

  await assertInstitutionUsable(
    institutionId
  );

  const freshUser =
    await prisma.user.findUnique({
      where: {
        id: user.id,
      },
    });

  if (!freshUser) {
    throw new AppError(
      "User not found",
      401
    );
  }

  return toSafeUser(
    freshUser,
    roles,
    permissions,
    institutionId
  );
}

export async function getMyAccount(
  userId: string
) {
  const user =
    await prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        id: true,
        institutionId: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        lastLoginAt: true,
        createdAt: true,
        institution: {
          select: {
            name: true,
            logoUrl: true,
          },
        },
      },
    });

  if (!user) {
    throw new AppError(
      "User not found",
      404
    );
  }

  return user;
}

export async function updateMyProfile(
  userId: string,
  input: {
    firstName?: string;
    lastName?: string;
    phone?: string | null;
  }
) {
  const updated =
    await prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        ...(input.firstName !==
        undefined
          ? {
              firstName:
                input.firstName.trim(),
            }
          : {}),
        ...(input.lastName !==
        undefined
          ? {
              lastName:
                input.lastName.trim(),
            }
          : {}),
        ...(input.phone !==
        undefined
          ? {
              phone:
                input.phone?.trim() ||
                null,
            }
          : {}),
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
      },
    });

  await recordAuditLog({
    userId,
    action:
      "account.profile_updated",
    entityType: "User",
    entityId: userId,
  });

  return updated;
}

export async function changeMyPassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
  meta: RequestMeta
) {
  const user =
    await prisma.user.findUnique({
      where: {
        id: userId,
      },
    });

  if (
    !user ||
    !(
      await comparePassword(
        currentPassword,
        user.passwordHash
      )
    )
  ) {
    throw new AppError(
      "Current password is incorrect",
      400
    );
  }

  if (
    await comparePassword(
      newPassword,
      user.passwordHash
    )
  ) {
    throw new AppError(
      "Choose a password that has not been used as your current password",
      400
    );
  }

  await prisma.$transaction([
    prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        passwordHash:
          await hashPassword(
            newPassword
          ),
      },
    }),
    prisma.refreshToken.updateMany({
      where: {
        userId,
        revokedAt: null,
      },
      data: {
        revokedAt:
          new Date(),
      },
    }),
  ]);

  await recordAuditLog({
    institutionId:
      user.institutionId,
    userId,
    action:
      "account.password_changed",
    ipAddress:
      meta.ipAddress,
    userAgent:
      meta.userAgent,
  });
}

export async function listRecoveryInstitutions() {
  return prisma.institution.findMany({
    where: {
      isActive: true,
    },
    orderBy: {
      name: "asc",
    },
    select: {
      id: true,
      name: true,
      slug: true,
      adminOfficeEmail: true,
    },
  });
}

