import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";
import { hashPassword } from "../utils/password";
import { AuthenticatedUser } from "../types/auth";
import { recordAuditLog } from "./audit.service";
import { ensureInstitutionSystemRoles } from "./institution.service";
import {
  ROLE_PERMISSIONS,
  SYSTEM_ROLE_NAMES,
} from "../config/rbac";
import {
  CreateUserInput,
  UpdateUserInput,
} from "../validators/user.validators";
import { assertTenantQuota } from "./entitlement.service";

const SYSTEM_ROLE_SET = new Set<string>(SYSTEM_ROLE_NAMES);

function isSuperAdmin(actor: AuthenticatedUser): boolean {
  return actor.roles.includes("SUPER_ADMIN");
}

/**
 * Resolve the actor's institution safely.
 *
 * The authenticated token may contain institutionId, but older/stale
 * tokens or login flows may not. In that case we resolve it from the
 * database using the authenticated user's id.
 *
 * This prevents valid institution administrators from being treated as
 * platform/unscoped users.
 */
async function requireActorInstitution(
  actor: AuthenticatedUser
): Promise<string> {
  if (actor.institutionId) {
    return actor.institutionId;
  }

  const dbUser = await prisma.user.findUnique({
    where: {
      id: actor.id,
    },
    select: {
      institutionId: true,
      isActive: true,
      userRoles: {
        select: {
          role: {
            select: {
              name: true,
            },
          },
        },
      },
    },
  });

  if (!dbUser) {
    throw new AppError("Authenticated user was not found", 401);
  }

  if (!dbUser.isActive) {
    throw new AppError("Your account is inactive", 403);
  }

  if (!dbUser.institutionId) {
    throw new AppError(
      "This action requires an institution-scoped user",
      403
    );
  }

  return dbUser.institutionId;
}

async function getRoleForUser(
  roleName: string,
  institutionId: string | null
) {
  if (!SYSTEM_ROLE_SET.has(roleName)) {
    throw new AppError(
      `Role "${roleName}" is not a supported system role`,
      400
    );
  }

  const role = await prisma.role.findFirst({
    where: {
      name: roleName,
      institutionId,
    },
  });

  if (role) {
    return role;
  }

  if (!institutionId && roleName === "SUPER_ADMIN") {
    throw new AppError(
      "SUPER_ADMIN role is not initialized",
      500
    );
  }

  if (institutionId) {
    await prisma.$transaction(async (tx) => {
      await ensureInstitutionSystemRoles(
        tx,
        institutionId
      );
    });

    const repairedRole = await prisma.role.findFirst({
      where: {
        name: roleName,
        institutionId,
      },
    });

    if (repairedRole) {
      return repairedRole;
    }
  }

  throw new AppError(
    `Role "${roleName}" is not initialized`,
    500
  );
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function normalizeOptionalString(
  value: string | null | undefined
): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  const normalized = value.trim();

  return normalized.length > 0 ? normalized : null;
}

function getRoleNames(
  user: {
    userRoles: Array<{
      role: {
        name: string;
      };
    }>;
  }
): string[] {
  return user.userRoles.map(
    (userRole) => userRole.role.name
  );
}

function hasRole(
  user: {
    userRoles: Array<{
      role: {
        name: string;
      };
    }>;
  },
  roleName: string
): boolean {
  return getRoleNames(user).includes(roleName);
}

function canManageUsers(
  actor: AuthenticatedUser
): boolean {
  return (
    isSuperAdmin(actor) ||
    actor.permissions.includes("users.manage")
  );
}

async function resolveTargetInstitution(
  actor: AuthenticatedUser,
  requestedInstitutionId: string | null | undefined
): Promise<string | null> {
  if (isSuperAdmin(actor)) {
    if (requestedInstitutionId === undefined) {
      return actor.institutionId ?? null;
    }

    return requestedInstitutionId;
  }

  const actorInstitutionId =
    await requireActorInstitution(actor);

  if (
    requestedInstitutionId &&
    requestedInstitutionId !== actorInstitutionId
  ) {
    throw new AppError(
      "You are not allowed to manage users in another institution",
      403
    );
  }

  return actorInstitutionId;
}

export async function listUsers(
  actor: AuthenticatedUser,
  options?: {
    institutionId?: string;
    search?: string;
    role?: string;
    isActive?: boolean;
    page?: number;
    pageSize?: number;
  }
) {
  if (!canManageUsers(actor)) {
    throw new AppError(
      "You are not allowed to manage users",
      403
    );
  }

  const page = Math.max(
    1,
    options?.page ?? 1
  );

  const pageSize = Math.min(
    100,
    Math.max(
      1,
      options?.pageSize ?? 25
    )
  );

  const skip =
    (page - 1) * pageSize;

  let institutionId =
    options?.institutionId;

  if (!isSuperAdmin(actor)) {
    institutionId =
      await requireActorInstitution(actor);
  }

  const search =
    options?.search?.trim();

  const where: Prisma.UserWhereInput = {
    ...(institutionId
      ? {
          institutionId,
        }
      : {}),
    ...(options?.isActive !== undefined
      ? {
          isActive:
            options.isActive,
        }
      : {}),
    ...(search
      ? {
          OR: [
            {
              email: {
                contains: search,
                mode: "insensitive",
              },
            },
            {
              firstName: {
                contains: search,
                mode: "insensitive",
              },
            },
            {
              lastName: {
                contains: search,
                mode: "insensitive",
              },
          ],
        },
      }
      : {}),
    ...(options?.role
      ? {
          userRoles: {
            some: {
              role: {
                name: options.role,
              },
            },
          },
        }
      : {}),
  };

  const [
    total,
    users,
  ] = await prisma.$transaction([
    prisma.user.count({
      where,
    }),
    prisma.user.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: [
        {
          createdAt: "desc",
        },
        {
          id: "desc",
        },
      ],
      include: {
        userRoles: {
          include: {
            role: true,
          },
        },
        institution: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    }),
  ]);

  return {
    data: users,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(
        total / pageSize
      ),
    },
  };
}

export async function getUserById(
  id: string,
  institutionId?: string | null
) {
  const user = await prisma.user.findFirst({
    where: {
      id,
      ...(institutionId
        ? {
            institutionId,
          }
        : {}),
    },
    include: {
      userRoles: {
        include: {
          role: true,
        },
      },
      institution: {
        select: {
          id: true,
          name: true,
          slug: true,
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

export async function createUser(
  input: CreateUserInput,
  actor: AuthenticatedUser
) {
  if (!canManageUsers(actor)) {
    throw new AppError(
      "You are not allowed to create users",
      403
    );
  }

  const email = normalizeEmail(
    input.email
  );

  const targetInstitutionId =
    await resolveTargetInstitution(
      actor,
      input.institutionId
    );

  if (!targetInstitutionId) {
    if (input.role !== "SUPER_ADMIN") {
      throw new AppError(
        "Institution is required for this role",
        400
      );
    }
  }

  if (input.role === "STUDENT") {
    throw new AppError(
      "Student accounts must be created through the student administration workflow so User + StudentProfile + StudentEnrollment are created atomically",
      400
    );
  }

  // CMS is a dedicated website-management account.
  // Only SUPER_ADMIN may create it.
  if (
    input.role === "CMS" &&
    !isSuperAdmin(actor)
  ) {
    throw new AppError(
      "Only SUPER_ADMIN may create CMS users",
      403
    );
  }

  if (isSuperAdmin(actor)) {
    if (
      input.role === "SUPER_ADMIN" &&
      targetInstitutionId !== null
    ) {
      throw new AppError(
        "SUPER_ADMIN accounts must be platform-level and cannot belong to an institution",
        400
      );
    }

    if (
      input.role !== "SUPER_ADMIN" &&
      !targetInstitutionId
    ) {
      throw new AppError(
        "Institution is required for institution-scoped users",
        400
      );
    }
  } else {
    if (
      input.role === "SUPER_ADMIN"
    ) {
      throw new AppError(
        "Institution administrators cannot create SUPER_ADMIN accounts",
        403
      );
    }
  }

  const existing =
    await prisma.user.findUnique({
      where: {
        email,
      },
      select: {
        id: true,
      },
    });

  if (existing) {
    throw new AppError(
      "A user with this email already exists",
      409
    );
  }

  if (targetInstitutionId) {
    await assertTenantQuota(
      targetInstitutionId,
      "users"
    );
  }

  const role = await getRoleForUser(
    input.role,
    targetInstitutionId
  );

  const passwordHash =
    await hashPassword(
      input.password
    );

  const user =
    await prisma.$transaction(
      async (tx) => {
        const created =
          await tx.user.create({
            data: {
              email,
              passwordHash,
              firstName:
                input.firstName.trim(),
              lastName:
                input.lastName.trim(),
              phone:
                normalizeOptionalString(
                  input.phone
                ),
              institutionId:
                targetInstitutionId,
              isActive:
                input.isActive ??
                true,
              userRoles: {
                create: {
                  roleId: role.id,
                },
              },
            },
            include: {
              userRoles: {
                include: {
                  role: true,
                },
              },
              institution: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                },
              },
            },
          });

        return created;
      }
    );

  await recordAuditLog({
    actorId: actor.id,
    action: "USER_CREATED",
    entityType: "User",
    entityId: user.id,
    metadata: {
      email: user.email,
      role: input.role,
      institutionId:
        targetInstitutionId,
    },
  });

  return user;
}

export async function updateUser(
  id: string,
  input: UpdateUserInput,
  actor: AuthenticatedUser
) {
  if (!canManageUsers(actor)) {
    throw new AppError(
      "You are not allowed to update users",
      403
    );
  }

  const actorInstitutionId =
    isSuperAdmin(actor)
      ? null
      : await requireActorInstitution(actor);

  const existing =
    await prisma.user.findFirst({
      where: {
        id,
        ...(actorInstitutionId
          ? {
              institutionId:
                actorInstitutionId,
            }
          : {}),
      },
      include: {
        userRoles: {
          include: {
            role: true,
          },
        },
      },
    });

  if (!existing) {
    throw new AppError(
      "User not found",
      404
    );
  }

  if (
    existing.id === actor.id &&
    input.role &&
    input.role !==
      getRoleNames(existing)[0]
  ) {
    throw new AppError(
      "You cannot change your own role",
      403
    );
  }

  const existingRoles =
    getRoleNames(existing);

  if (
    existingRoles.includes(
      "SUPER_ADMIN"
    ) &&
    !isSuperAdmin(actor)
  ) {
    throw new AppError(
      "Institution administrators cannot modify SUPER_ADMIN",
      403
    );
  }

  if (
    input.role === "SUPER_ADMIN" &&
    !isSuperAdmin(actor)
  ) {
    throw new AppError(
      "Institution administrators cannot assign SUPER_ADMIN",
      403
    );
  }

  // CMS assignment is explicitly controlled by SUPER_ADMIN.
  if (
    input.role === "CMS" &&
    !isSuperAdmin(actor)
  ) {
    throw new AppError(
      "Only SUPER_ADMIN may assign CMS access",
      403
    );
  }

  if (
    input.role === "SUPER_ADMIN" &&
    existing.institutionId !== null
  ) {
    throw new AppError(
      "SUPER_ADMIN accounts must be platform-level",
      400
    );
  }

  if (
    input.role &&
    input.role === "STUDENT"
  ) {
    throw new AppError(
      "Student accounts must be managed through the student administration workflow",
      400
    );
  }

  if (
    input.institutionId &&
    !isSuperAdmin(actor)
  ) {
    if (
      input.institutionId !==
      actorInstitutionId
    ) {
      throw new AppError(
        "You cannot move a user to another institution",
        403
      );
    }
  }

  const targetInstitutionId =
    input.institutionId !== undefined
      ? input.institutionId
      : existing.institutionId;

  if (
    input.role &&
    input.role !==
      existingRoles[0]
  ) {
    if (
      input.role !==
        "SUPER_ADMIN" &&
      !targetInstitutionId
    ) {
      throw new AppError(
        "Institution is required for institution-scoped users",
        400
      );
    }
  }

  if (
    input.email &&
    normalizeEmail(input.email) !==
      existing.email
  ) {
    const normalizedEmail =
      normalizeEmail(
        input.email
      );

    const duplicate =
      await prisma.user.findFirst({
        where: {
          email:
            normalizedEmail,
          id: {
            not: id,
          },
        },
        select: {
          id: true,
        },
      });

    if (duplicate) {
      throw new AppError(
        "A user with this email already exists",
        409
      );
    }
  }

  let roleId:
    | string
    | undefined;

  if (input.role) {
    const role =
      await getRoleForUser(
        input.role,
        targetInstitutionId
      );

    roleId = role.id;
  }

  const data: Prisma.UserUpdateInput = {};

  if (input.email !== undefined) {
    data.email =
      normalizeEmail(
        input.email
      );
  }

  if (
    input.firstName !==
    undefined
  ) {
    data.firstName =
      input.firstName.trim();
  }

  if (
    input.lastName !==
    undefined
  ) {
    data.lastName =
      input.lastName.trim();
  }

  if (input.phone !== undefined) {
    data.phone =
      normalizeOptionalString(
        input.phone
      );
  }

  if (
    input.password !==
    undefined
  ) {
    data.passwordHash =
      await hashPassword(
        input.password
      );
  }

  if (
    input.isActive !==
    undefined
  ) {
    data.isActive =
      input.isActive;
  }

  if (
    input.institutionId !==
    undefined
  ) {
    data.institution =
      input.institutionId
        ? {
            connect: {
              id: input.institutionId,
            },
          }
        : {
            disconnect: true,
          };
  }

  const updated =
    await prisma.$transaction(
      async (tx) => {
        const user =
          await tx.user.update({
            where: {
              id,
            },
            data,
            include: {
              userRoles: {
                include: {
                  role: true,
                },
              },
              institution: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                },
              },
            },
          });

        if (roleId) {
          await tx.userRole.deleteMany({
            where: {
              userId: id,
            },
          });

          await tx.userRole.create({
            data: {
              userId: id,
              roleId,
            },
          });
        }

        return tx.user.findUniqueOrThrow({
          where: {
            id,
          },
          include: {
            userRoles: {
              include: {
                role: true,
              },
            },
            institution: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        });
      }
    );

  await recordAuditLog({
    actorId: actor.id,
    action: "USER_UPDATED",
    entityType: "User",
    entityId: id,
    metadata: {
      changedRole:
        input.role ?? null,
      changedStatus:
        input.isActive ?? null,
    },
  });

  return updated;
}

export async function deleteUser(
  id: string,
  actor: AuthenticatedUser
) {
  if (!canManageUsers(actor)) {
    throw new AppError(
      "You are not allowed to delete users",
      403
    );
  }

  const actorInstitutionId =
    isSuperAdmin(actor)
      ? null
      : await requireActorInstitution(actor);

  const existing =
    await prisma.user.findFirst({
      where: {
        id,
        ...(actorInstitutionId
          ? {
              institutionId:
                actorInstitutionId,
            }
          : {}),
      },
      include: {
        userRoles: {
          include: {
            role: true,
          },
        },
      },
    });

  if (!existing) {
    throw new AppError(
      "User not found",
      404
    );
  }

  if (existing.id === actor.id) {
    throw new AppError(
      "You cannot delete your own account",
      400
    );
  }

  if (
    hasRole(
      existing,
      "SUPER_ADMIN"
    ) &&
    !isSuperAdmin(actor)
  ) {
    throw new AppError(
      "Institution administrators cannot delete SUPER_ADMIN",
      403
    );
  }

  await prisma.$transaction(
    async (tx) => {
      await tx.userRole.deleteMany({
        where: {
          userId: id,
        },
      });

      await tx.user.delete({
        where: {
          id,
        },
      });
    }
  );

  await recordAuditLog({
    actorId: actor.id,
    action: "USER_DELETED",
    entityType: "User",
    entityId: id,
    metadata: {
      email: existing.email,
      roles:
        getRoleNames(existing),
    },
  });

  return {
    success: true,
  };
}

export async function setUserActive(
  id: string,
  isActive: boolean,
  actor: AuthenticatedUser
) {
  return updateUser(
    id,
    {
      isActive,
    },
    actor
  );
}

/**
 * Exposed for future RBAC administration UI.
 */
export function getSystemRolePermissionKeys(
  roleName: string
): string[] {
  if (
    !SYSTEM_ROLE_SET.has(
      roleName
    )
  ) {
    return [];
  }

  const role =
    roleName as keyof typeof ROLE_PERMISSIONS;

  return [
    ...(ROLE_PERMISSIONS[
      role
    ] ?? []),
  ];
}
