import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";
import { AuthenticatedUser } from "../types/auth";
import { recordAuditLog } from "./audit.service";
import { adminIssueResetToken, clearFailedLogins } from "./accountSecurity.service";

const RECOVERY_DAYS = 90;
const MANAGEMENT_ROLES = new Set(["SUPER_ADMIN", "INSTITUTION_ADMIN"]);

function assertManager(actor: AuthenticatedUser) {
  if (!actor.roles.some((role) => MANAGEMENT_ROLES.has(role))) {
    throw new AppError("User lifecycle management is restricted to authorized administrators", 403);
  }
}

function scope(actor: AuthenticatedUser) {
  return actor.roles.includes("SUPER_ADMIN") ? undefined : actor.institutionId;
}

function deadlineFromDeletedAt(deletedAt: Date) {
  const deadline = new Date(deletedAt);
  deadline.setUTCDate(deadline.getUTCDate() + RECOVERY_DAYS);
  return deadline;
}

async function targetOrThrow(id: string, actor: AuthenticatedUser) {
  const institutionId = scope(actor);
  const target = await prisma.user.findFirst({
    where: {
      id,
      ...(institutionId ? { institutionId } : {}),
    },
    select: {
      id: true,
      institutionId: true,
      email: true,
      firstName: true,
      lastName: true,
      phone: true,
      isActive: true,
      deletedAt: true,
      deletedBy: true,
      deletionReason: true,
      deletionNote: true,
      recoveryDeadline: true,
      permanentlyDeletedAt: true,
      lastLoginAt: true,
      passwordChangedAt: true,
      mustChangePassword: true,
      mfaEnabled: true,
      failedLoginAttempts: true,
      lockedUntil: true,
      createdAt: true,
      updatedAt: true,
      institution: { select: { id: true, name: true, slug: true } },
      userRoles: { select: { role: { select: { id: true, name: true, description: true } } } },
      departmentAccesses: {
        select: {
          departmentId: true,
          scope: true,
          department: { select: { id: true, name: true, code: true } },
        },
      },
      profile: {
        select: {
          id: true,
          admissionNumber: true,
          dateOfBirth: true,
          gender: true,
          bloodGroup: true,
          nationality: true,
          address: true,
          city: true,
          state: true,
          postalCode: true,
          guardianName: true,
          guardianPhone: true,
          guardianEmail: true,
          emergencyContactName: true,
          emergencyContactPhone: true,
          admissionDate: true,
          status: true,
        },
      },
      studentEnrollments: {
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          programId: true,
          academicYearId: true,
          semesterId: true,
          sectionId: true,
          rollNumber: true,
          status: true,
          enrolledAt: true,
          program: { select: { id: true, name: true, code: true, level: true } },
          academicYear: { select: { id: true, name: true } },
          semester: { select: { id: true, name: true, number: true } },
          section: { select: { id: true, name: true } },
        },
      },
    },
  });

  if (!target) throw new AppError("User not found", 404);
  if (target.id === actor.id) {
    throw new AppError("This operation cannot target your own account", 400);
  }
  return target;
}

function publicTarget(target: Awaited<ReturnType<typeof targetOrThrow>>) {
  return {
    ...target,
    roles: target.userRoles.map((binding) => binding.role),
    userRoles: undefined,
    departmentAccesses: target.departmentAccesses.map((item) => ({
      departmentId: item.departmentId,
      scope: item.scope,
      department: item.department,
    })),
  };
}

export async function deactivateUser(
  id: string,
  actor: AuthenticatedUser,
  reason?: string,
  note?: string,
) {
  assertManager(actor);
  const target = await targetOrThrow(id, actor);

  if (target.userRoles.some((x) => x.role.name === "INSTITUTION_ADMIN")) {
    const count = await prisma.user.count({
      where: {
        institutionId: target.institutionId,
        isActive: true,
        deletedAt: null,
        userRoles: { some: { role: { name: "INSTITUTION_ADMIN" } } },
        id: { not: target.id },
      },
    });
    if (count === 0) {
      throw new AppError("The institution must retain at least one active administrator", 400);
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.user.update({
      where: { id: target.id },
      data: { isActive: false },
    });
    await tx.refreshToken.updateMany({
      where: { userId: target.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return row;
  });

  await recordAuditLog({
    institutionId: target.institutionId,
    userId: actor.id,
    action: "USER_DEACTIVATED",
    entityType: "User",
    entityId: target.id,
    metadata: { before: { isActive: target.isActive }, after: { isActive: false }, reason: reason?.trim() || null, note: note?.trim() || null },
  });

  return { id: updated.id, isActive: updated.isActive };
}

export async function reactivateUser(id: string, actor: AuthenticatedUser, reason?: string) {
  assertManager(actor);
  const target = await targetOrThrow(id, actor);
  if (target.deletedAt) throw new AppError("Recover the deleted user before reactivating the account", 409);

  await prisma.user.update({
    where: { id: target.id },
    data: { isActive: true },
  });

  await recordAuditLog({
    institutionId: target.institutionId,
    userId: actor.id,
    action: "USER_REACTIVATED",
    entityType: "User",
    entityId: target.id,
    metadata: { before: { isActive: target.isActive }, after: { isActive: true }, reason: reason?.trim() || null },
  });

  return { id: updated.id, isActive: updated.isActive };
}

export async function softDeleteUser(
  id: string,
  actor: AuthenticatedUser,
  reason: string,
  note?: string,
) {
  assertManager(actor);
  if (!reason.trim()) throw new AppError("A deletion reason is required", 400);

  const target = await targetOrThrow(id, actor);
  if (target.deletedAt) throw new AppError("User is already deleted", 409);

  const targetRoles = target.userRoles.map((x) => x.role.name);
  if (targetRoles.includes("SUPER_ADMIN")) {
    if (!actor.roles.includes("SUPER_ADMIN")) {
      throw new AppError("Only SUPER_ADMIN may delete a SUPER_ADMIN account", 403);
    }
    const otherSuperAdmins = await prisma.user.count({
      where: {
        id: { not: target.id },
        isActive: true,
        deletedAt: null,
        userRoles: { some: { role: { name: "SUPER_ADMIN" } } },
      },
    });
    if (otherSuperAdmins === 0) {
      throw new AppError("The last active SUPER_ADMIN account cannot be deleted", 400);
    }
  }

  const now = new Date();
  const deadline = deadlineFromDeletedAt(now);

  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.user.update({
      where: { id: target.id },
      data: {
        isActive: false,
        deletedAt: now,
        deletedBy: actor.id,
        deletionReason: reason.trim(),
        deletionNote: note?.trim() || null,
        recoveryDeadline: deadline,
      },
    });
    await tx.refreshToken.updateMany({
      where: { userId: target.id, revokedAt: null },
      data: { revokedAt: now },
    });
    return row;
  });

  await recordAuditLog({
    institutionId: target.institutionId,
    userId: actor.id,
    action: "USER_DELETED",
    entityType: "User",
    entityId: target.id,
    metadata: {
      before: { isActive: target.isActive, deletedAt: null },
      after: { isActive: false, deletedAt: now.toISOString(), recoveryDeadline: deadline.toISOString() },
      reason: reason.trim(),
      note: note?.trim() || null,
    },
  });

  return { id: updated.id, deletedAt: updated.deletedAt, recoveryDeadline: updated.recoveryDeadline };
}

export async function listDeletedUsers(
  actor: AuthenticatedUser,
  options: { page: number; pageSize: number; search?: string; role?: string; expiringSoon?: boolean },
) {
  assertManager(actor);
  const institutionId = scope(actor);
  const where: Prisma.UserWhereInput = {
    deletedAt: { not: null },
    ...(institutionId ? { institutionId } : {}),
    ...(options.role ? { userRoles: { some: { role: { name: options.role.toUpperCase() } } } } : {}),
    ...(options.search?.trim()
      ? {
          OR: [
            { firstName: { contains: options.search.trim(), mode: "insensitive" } },
            { lastName: { contains: options.search.trim(), mode: "insensitive" } },
            { email: { contains: options.search.trim(), mode: "insensitive" } },
          ],
        }
      : {}),
  };

  if (options.expiringSoon) {
    const until = new Date();
    until.setUTCDate(until.getUTCDate() + 14);
    where.recoveryDeadline = { lte: until, gt: new Date() };
  }

  const [items, total] = await prisma.$transaction([
    prisma.user.findMany({
      where,
      orderBy: { deletedAt: "desc" },
      skip: (options.page - 1) * options.pageSize,
      take: options.pageSize,
      select: {
        id: true,
        institutionId: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        isActive: true,
        deletedAt: true,
        deletedBy: true,
        deletionReason: true,
        deletionNote: true,
        recoveryDeadline: true,
        createdAt: true,
        userRoles: { select: { role: { select: { name: true } } } },
      },
    }),
    prisma.user.count({ where }),
  ]);

  const deleters = await prisma.user.findMany({
    where: { id: { in: items.map((x) => x.deletedBy).filter((x): x is string => Boolean(x)) } },
    select: { id: true, firstName: true, lastName: true, email: true },
  });
  const byId = new Map(deleters.map((x) => [x.id, x]));

  return {
    items: items.map((item) => ({
      ...item,
      role: item.userRoles[0]?.role.name ?? "—",
      userRoles: undefined,
      deletedByUser: item.deletedBy ? byId.get(item.deletedBy) ?? null : null,
      daysRemaining: item.recoveryDeadline
        ? Math.max(0, Math.ceil((item.recoveryDeadline.getTime() - Date.now()) / 86400000))
        : 0,
    })),
    total,
  };
}

export async function recoverUser(id: string, actor: AuthenticatedUser, reason?: string) {
  assertManager(actor);
  const target = await targetOrThrow(id, actor);
  if (!target.deletedAt || !target.recoveryDeadline) throw new AppError("User is not in the recovery bin", 409);
  if (target.recoveryDeadline.getTime() <= Date.now()) {
    throw new AppError("The 90-day recovery period has expired", 410);
  }

  const updated = await prisma.user.update({
    where: { id: target.id },
    data: {
      isActive: true,
      deletedAt: null,
      deletedBy: null,
      deletionReason: null,
      deletionNote: null,
      recoveryDeadline: null,
    },
  });

  await recordAuditLog({
    institutionId: target.institutionId,
    userId: actor.id,
    action: "USER_RECOVERED",
    entityType: "User",
    entityId: target.id,
    metadata: { originalDeletedAt: target.deletedAt.toISOString(), recoveryDeadline: target.recoveryDeadline.toISOString(), reason: reason?.trim() || null },
  });

  return publicTarget({ ...target, deletedAt: null, recoveryDeadline: null, isActive: true, deletedBy: null, deletionReason: null, deletionNote: null } as typeof target);
}

export async function getUserLifecycleDetails(id: string, actor: AuthenticatedUser) {
  assertManager(actor);
  const target = await targetOrThrow(id, actor);
  const [sessionCount, latestSession, resetCount] = await Promise.all([
    prisma.refreshToken.count({ where: { userId: target.id, revokedAt: null, expiresAt: { gt: new Date() } } }),
    prisma.refreshToken.findFirst({ where: { userId: target.id }, orderBy: { createdAt: "desc" }, select: { ipAddress: true, userAgent: true, createdAt: true } }),
    prisma.passwordResetToken.count({ where: { userId: target.id, expiresAt: { gt: new Date() }, usedAt: null } }),
  ]);

  return {
    ...publicTarget(target),
    authentication: {
      loginEmail: target.email,
      accountId: target.id,
      accountStatus: target.deletedAt ? "DELETED" : target.isActive ? "ACTIVE" : "INACTIVE",
      emailVerificationStatus: "NOT_TRACKED",
      mfaEnabled: target.mfaEnabled,
      lastLogin: target.lastLoginAt,
      lastLoginIp: latestSession?.ipAddress ?? null,
      lastPasswordChange: target.passwordChangedAt,
      failedLoginCount: target.failedLoginAttempts,
      lockedUntil: target.lockedUntil,
      activeSessionCount: sessionCount,
      accountCreatedAt: target.createdAt,
      passwordResetAvailable: resetCount > 0,
      forcePasswordChange: target.mustChangePassword,
      sessionDevice: latestSession ? { userAgent: latestSession.userAgent, createdAt: latestSession.createdAt } : null,
    },
  };
}

export async function cleanupExpiredDeletedUsers(limit = 50) {
  const cutoff = new Date();
  const candidates = await prisma.user.findMany({
    where: {
      deletedAt: { not: null },
      recoveryDeadline: { lte: cutoff },
      permanentlyDeletedAt: null,
    },
    orderBy: { recoveryDeadline: "asc" },
    take: limit,
    select: {
      id: true,
      institutionId: true,
      email: true,
      firstName: true,
      lastName: true,
      deletedAt: true,
      recoveryDeadline: true,
      userRoles: { select: { role: { select: { name: true } } } },
    },
  });

  let permanentlyDeleted = 0;
  let retained = 0;

  for (const target of candidates) {
    try {
      await prisma.$transaction(async (tx) => {
        await tx.user.delete({ where: { id: target.id } });
      });
      await recordAuditLog({
        institutionId: target.institutionId,
        userId: null,
        action: "USER_PERMANENTLY_DELETED",
        entityType: "User",
        entityId: target.id,
        metadata: {
          identitySnapshot: { id: target.id, email: target.email, firstName: target.firstName, lastName: target.lastName },
          originalDeletedAt: target.deletedAt?.toISOString() ?? null,
          recoveryDeadline: target.recoveryDeadline?.toISOString() ?? null,
          automatic: true,
        },
      });
      permanentlyDeleted++;
    } catch (error) {
      retained++;
      if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003")) throw error;
    }
  }

  return { scanned: candidates.length, permanentlyDeleted, retained };
}


export async function forcePasswordChange(id: string, actor: AuthenticatedUser) {
  assertManager(actor);
  const target = await targetOrThrow(id, actor);
  await prisma.user.update({ where: { id: target.id }, data: { mustChangePassword: true } });
  await prisma.refreshToken.updateMany({ where: { userId: target.id, revokedAt: null }, data: { revokedAt: new Date() } });
  await recordAuditLog({
    institutionId: target.institutionId,
    userId: actor.id,
    action: "PASSWORD_RESET_FORCED",
    entityType: "User",
    entityId: target.id,
    metadata: { sessionsRevoked: true },
  });
  return { userId: target.id, forcePasswordChange: true };
}

export async function revokeUserSessions(id: string, actor: AuthenticatedUser) {
  assertManager(actor);
  const target = await targetOrThrow(id, actor);
  const result = await prisma.refreshToken.updateMany({
    where: { userId: target.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  await recordAuditLog({
    institutionId: target.institutionId,
    userId: actor.id,
    action: "SESSIONS_REVOKED",
    entityType: "User",
    entityId: target.id,
    metadata: { revoked: result.count },
  });
  return { userId: target.id, revoked: result.count };
}

export async function unlockUser(id: string, actor: AuthenticatedUser) {
  assertManager(actor);
  const target = await targetOrThrow(id, actor);
  await clearFailedLogins(target.id);
  await recordAuditLog({
    institutionId: target.institutionId,
    userId: actor.id,
    action: "ACCOUNT_UNLOCKED",
    entityType: "User",
    entityId: target.id,
  });
  return { userId: target.id, unlocked: true };
}

export async function issuePasswordReset(id: string, actor: AuthenticatedUser) {
  assertManager(actor);
  const target = await targetOrThrow(id, actor);
  if (!target.institutionId) {
    throw new AppError("Platform account password reset must use the platform security workflow", 403);
  }
  const result = await adminIssueResetToken(target.institutionId, actor, target.id, {});
  return {
    userId: target.id,
    delivered: true,
    expiresAt: result.expiresAt ?? null,
  };
}
