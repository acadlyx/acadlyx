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

const SYSTEM_ROLE_SET = new Set<string>(
  SYSTEM_ROLE_NAMES
);

function isSuperAdmin(
  actor: AuthenticatedUser
): boolean {
  return actor.roles.includes("SUPER_ADMIN");
}

function requireActorInstitution(
  actor: AuthenticatedUser
): string {
  if (!actor.institutionId) {
    throw new AppError(
      "This action requires an institution-scoped user",
      403
    );
  }

  return actor.institutionId;
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
    await prisma.$transaction(
      async (tx) => {
        await ensureInstitutionSystemRoles(
          tx,
          institutionId
        );
      }
    );

    const repairedRole =
      await prisma.role.findFirst({
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
    `Role "${roleName}" is not available in this scope`,
    400
  );
}

async function getScopedUserOrThrow(
  id: string,
  institutionId: string | null
) {
  const user = await prisma.user.findFirst({
    where: {
      id,
      ...(institutionId !== null
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

export async function listUsers(params: {
  page: number;
  pageSize: number;
  search?: string;
  institutionId?: string;
  role?: string;
  isActive?: boolean;
  scopeInstitutionId?: string | null;
}) {
  const where: Prisma.UserWhereInput = {};

  if (
    params.scopeInstitutionId !== null &&
    params.scopeInstitutionId !== undefined
  ) {
    where.institutionId =
      params.scopeInstitutionId;
  } else if (params.institutionId) {
    where.institutionId =
      params.institutionId;
  }

  if (params.search) {
    where.OR = [
      {
        email: {
          contains: params.search,
          mode: "insensitive",
        },
      },
      {
        firstName: {
          contains: params.search,
          mode: "insensitive",
        },
      },
      {
        lastName: {
          contains: params.search,
          mode: "insensitive",
        },
      },
    ];
  }

  if (params.isActive !== undefined) {
    where.isActive = params.isActive;
  }

  if (params.role) {
    where.userRoles = {
      some: {
        role: {
          name: params.role,
          ...(params.scopeInstitutionId
            ? {
                institutionId:
                  params.scopeInstitutionId,
              }
            : {}),
        },
      },
    };
  }

  const [items, total] =
    await prisma.$transaction([
      prisma.user.findMany({
        where,
        orderBy: {
          createdAt: "desc",
        },
        skip:
          (params.page - 1) *
          params.pageSize,
        take: params.pageSize,
        select: {
          id: true,
          institutionId: true,
          email: true,
          firstName: true,
          lastName: true,
          phone: true,
          isActive: true,
          lastLoginAt: true,
          createdAt: true,
          institution: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
          userRoles: {
            select: {
              role: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      }),

      prisma.user.count({
        where,
      }),
    ]);

  return {
    items: items.map((user) => ({
      ...user,
      roles: user.userRoles.map(
        (binding) => binding.role
      ),
      userRoles: undefined,
    })),
    total,
  };
}

export async function getUserById(
  id: string,
  scopeInstitutionId?: string | null
) {
  const user = await prisma.user.findFirst({
    where: {
      id,
      ...(scopeInstitutionId !==
        undefined &&
      scopeInstitutionId !== null
        ? {
            institutionId:
              scopeInstitutionId,
          }
        : {}),
    },
    select: {
      id: true,
      institutionId: true,
      email: true,
      firstName: true,
      lastName: true,
      phone: true,
      isActive: true,
      lastLoginAt: true,
      createdAt: true,
      updatedAt: true,
      institution: {
        select: {
          id: true,
          name: true,
          slug: true,
          isActive: true,
        },
      },
      userRoles: {
        select: {
          role: {
            select: {
              id: true,
              name: true,
              description: true,
            },
          },
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

  return {
    ...user,
    roles: user.userRoles.map(
      (binding) => binding.role
    ),
    userRoles: undefined,
  };
}

export async function createUser(
  input: CreateUserInput,
  actor: AuthenticatedUser
) {
  // Institution administrators are tenant-scoped. Their institution is
  // derived from the authenticated actor, never from the browser payload.
  // This both fixes the create-user flow and prevents cross-institution
  // assignment if a client tampers with institutionId.
  const targetInstitutionId = isSuperAdmin(actor)
    ? input.institutionId ?? null
    : requireActorInstitution(actor);

  if (isSuperAdmin(actor)) {
    if (
      input.role === "SUPER_ADMIN" &&
      targetInstitutionId !== null
    ) {
      throw new AppError(
        "SUPER_ADMIN must be a platform-level user",
        400
      );
    }

    if (
      input.role !== "SUPER_ADMIN" &&
      !targetInstitutionId
    ) {
      throw new AppError(
        "An institution is required for this role",
        400
      );
    }
  } else if (input.role === "SUPER_ADMIN") {
    throw new AppError(
      "Institution administrators cannot create SUPER_ADMIN users",
      403
    );
  }

  if (
    input.role === "SUPER_ADMIN" &&
    targetInstitutionId
  ) {
    throw new AppError(
      "SUPER_ADMIN cannot be assigned to an institution",
      400
    );
  }

  if (targetInstitutionId) {
    const institution =
      await prisma.institution.findUnique({
        where: {
          id: targetInstitutionId,
        },
        select: {
          id: true,
          isActive: true,
        },
      });

    if (!institution) {
      throw new AppError(
        "Institution not found",
        404
      );
    }

    if (!institution.isActive) {
      throw new AppError(
        "Cannot create users in an inactive institution",
        400
      );
    }
  }

  const email =
    input.email.trim().toLowerCase();

  const existing =
    await prisma.user.findUnique({
      where: {
        email,
      },
    });

  if (existing) {
    throw new AppError(
      "A user with this email already exists",
      409
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
              institutionId:
                targetInstitutionId,
              email,
              passwordHash,
              firstName:
                input.firstName,
              lastName:
                input.lastName,
              phone:
                input.phone || null,
              isActive: true,
            },
          });

        await tx.userRole.create({
          data: {
            userId: created.id,
            roleId: role.id,
          },
        });

        return created;
      }
    );

  await recordAuditLog({
    institutionId:
      user.institutionId,
    userId: actor.id,
    action: "user.create",
    entityType: "User",
    entityId: user.id,
    metadata: {
      role: input.role,
      email: user.email,
    },
  });

  return getUserById(user.id);
}

export async function updateUser(
  id: string,
  input: UpdateUserInput,
  actor: AuthenticatedUser
) {
  const scopeInstitutionId =
    isSuperAdmin(actor)
      ? null
      : requireActorInstitution(actor);

  const existing =
    await getScopedUserOrThrow(
      id,
      scopeInstitutionId
    );

  if (
    !isSuperAdmin(actor) &&
    existing.institutionId !==
      actor.institutionId
  ) {
    throw new AppError(
      "You cannot modify a user outside your institution",
      403
    );
  }

  const currentRole =
    existing.userRoles[0]?.role;

  if (
    currentRole?.name ===
      "SUPER_ADMIN" &&
    !isSuperAdmin(actor)
  ) {
    throw new AppError(
      "Institution administrators cannot modify SUPER_ADMIN users",
      403
    );
  }

  if (
    id === actor.id &&
    input.isActive === false
  ) {
    throw new AppError(
      "You cannot deactivate your own account",
      400
    );
  }

  if (
    id === actor.id &&
    input.role &&
    input.role !== currentRole?.name
  ) {
    throw new AppError(
      "You cannot change your own role",
      400
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

  if (
    input.role === "SUPER_ADMIN" &&
    existing.institutionId !== null
  ) {
    throw new AppError(
      "SUPER_ADMIN must be platform-level",
      400
    );
  }

  if (
    input.isActive === false &&
    currentRole?.name ===
      "INSTITUTION_ADMIN"
  ) {
    const activeAdmins =
      await prisma.user.count({
        where: {
          institutionId:
            existing.institutionId,
          isActive: true,
          userRoles: {
            some: {
              role: {
                name:
                  "INSTITUTION_ADMIN",
              },
            },
          },
          id: {
            not: existing.id,
          },
        },
      });

    if (activeAdmins === 0) {
      throw new AppError(
        "The institution must retain at least one active institution administrator",
        400
      );
    }
  }

  if (input.role) {
    const role =
      await getRoleForUser(
        input.role,
        existing.institutionId
      );

    await prisma.$transaction(
      async (tx) => {
        await tx.user.update({
          where: {
            id,
          },
          data: {
            ...(input.firstName !==
            undefined
              ? {
                  firstName:
                    input.firstName,
                }
              : {}),

            ...(input.lastName !==
            undefined
              ? {
                  lastName:
                    input.lastName,
                }
              : {}),

            ...(input.phone !==
            undefined
              ? {
                  phone:
                    input.phone || null,
                }
              : {}),

            ...(input.isActive !==
            undefined
              ? {
                  isActive:
                    input.isActive,
                }
              : {}),
          },
        });

        await tx.userRole.deleteMany({
          where: {
            userId: id,
          },
        });

        await tx.userRole.create({
          data: {
            userId: id,
            roleId: role.id,
          },
        });

        if (input.isActive === false) {
          await tx.refreshToken.updateMany({
            where: {
              userId: id,
              revokedAt: null,
            },
            data: {
              revokedAt:
                new Date(),
            },
          });
        }
      }
    );
  } else {
    await prisma.user.update({
      where: {
        id,
      },
      data: {
        ...(input.firstName !==
        undefined
          ? {
              firstName:
                input.firstName,
            }
          : {}),

        ...(input.lastName !==
        undefined
          ? {
              lastName:
                input.lastName,
            }
          : {}),

        ...(input.phone !==
        undefined
          ? {
              phone:
                input.phone || null,
            }
          : {}),

        ...(input.isActive !==
        undefined
          ? {
              isActive:
                input.isActive,
            }
          : {}),
      },
    });

    if (input.isActive === false) {
      await prisma.refreshToken.updateMany({
        where: {
          userId: id,
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
        },
      });
    }
  }

  await recordAuditLog({
    institutionId:
      existing.institutionId,
    userId: actor.id,
    action: "user.update",
    entityType: "User",
    entityId: id,
    metadata: {
      changedRole:
        input.role ?? null,
      changedStatus:
        input.isActive ?? null,
    },
  });

  return getUserById(id);
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
  return [
    ...(ROLE_PERMISSIONS[roleName] ?? []),
  ];
}
