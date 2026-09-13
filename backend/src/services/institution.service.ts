import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";
import { hashPassword } from "../utils/password";
import {
  PERMISSIONS,
  ROLE_PERMISSIONS,
  SYSTEM_ROLE_NAMES,
} from "../config/rbac";
import {
  CreateInstitutionInput,
  UpdateInstitutionInput,
} from "../validators/institution.validators";

async function ensurePermissionCatalog(
  tx: Prisma.TransactionClient
): Promise<Map<string, string>> {
  const permissionRecords = new Map<string, string>();

  for (const permission of PERMISSIONS) {
    const record = await tx.permission.upsert({
      where: {
        key: permission.key,
      },
      update: {
        module: permission.module,
        description: permission.description,
      },
      create: {
        key: permission.key,
        module: permission.module,
        description: permission.description,
      },
    });

    permissionRecords.set(record.key, record.id);
  }

  return permissionRecords;
}

/**
 * Creates/repairs all standard institution roles.
 *
 * SUPER_ADMIN is intentionally excluded because it is a platform-level
 * role with institutionId = null.
 */
export async function ensureInstitutionSystemRoles(
  tx: Prisma.TransactionClient,
  institutionId: string
): Promise<Map<string, string>> {
  const permissionRecords = await ensurePermissionCatalog(tx);
  const roleRecords = new Map<string, string>();

  for (const roleName of SYSTEM_ROLE_NAMES) {
    if (roleName === "SUPER_ADMIN") {
      continue;
    }

    let role = await tx.role.findFirst({
      where: {
        institutionId,
        name: roleName,
      },
    });

    if (!role) {
      role = await tx.role.create({
        data: {
          institutionId,
          name: roleName,
          isSystem: true,
          description: `${roleName.replace(/_/g, " ")} role`,
        },
      });
    } else if (!role.isSystem) {
      role = await tx.role.update({
        where: {
          id: role.id,
        },
        data: {
          isSystem: true,
        },
      });
    }

    roleRecords.set(roleName, role.id);

    const desiredPermissionIds = (
      ROLE_PERMISSIONS[roleName] ?? []
    )
      .map((key) => permissionRecords.get(key))
      .filter((id): id is string => Boolean(id));

    await tx.rolePermission.deleteMany({
      where: {
        roleId: role.id,
        ...(desiredPermissionIds.length > 0
          ? {
              permissionId: {
                notIn: desiredPermissionIds,
              },
            }
          : {}),
      },
    });

    if (desiredPermissionIds.length > 0) {
      await tx.rolePermission.createMany({
        data: desiredPermissionIds.map((permissionId) => ({
          roleId: role.id,
          permissionId,
        })),
        skipDuplicates: true,
      });
    }
  }

  return roleRecords;
}

export async function listInstitutions(params: {
  page: number;
  pageSize: number;
  search?: string;
  isActive?: boolean;
}) {
  const where: Prisma.InstitutionWhereInput = {};

  if (params.search) {
    where.OR = [
      {
        name: {
          contains: params.search,
          mode: "insensitive",
        },
      },
      {
        slug: {
          contains: params.search,
          mode: "insensitive",
        },
      },
    ];
  }

  if (params.isActive !== undefined) {
    where.isActive = params.isActive;
  }

  const [items, total] = await prisma.$transaction([
    prisma.institution.findMany({
      where,
      orderBy: {
        createdAt: "desc",
      },
      skip: (params.page - 1) * params.pageSize,
      take: params.pageSize,
      include: {
        _count: {
          select: {
            users: true,
            departments: true,
            programs: true,
            studentEnrollments: true,
          },
        },
      },
    }),

    prisma.institution.count({
      where,
    }),
  ]);

  return {
    items,
    total,
  };
}

export async function getInstitutionById(id: string) {
  const institution = await prisma.institution.findUnique({
    where: {
      id,
    },
    include: {
      _count: {
        select: {
          users: true,
          departments: true,
          programs: true,
          studentEnrollments: true,
        },
      },
      users: {
        where: {
          userRoles: {
            some: {
              role: {
                name: "INSTITUTION_ADMIN",
              },
            },
          },
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          phone: true,
          isActive: true,
          createdAt: true,
        },
        orderBy: {
          createdAt: "asc",
        },
      },
    },
  });

  if (!institution) {
    throw new AppError("Institution not found", 404);
  }

  return institution;
}

export async function createInstitution(
  input: CreateInstitutionInput
) {
  const existingSlug = await prisma.institution.findUnique({
    where: {
      slug: input.slug,
    },
  });

  if (existingSlug) {
    throw new AppError(
      "An institution with this slug already exists",
      409
    );
  }

  const existingEmail = await prisma.user.findUnique({
    where: {
      email: input.admin.email.toLowerCase(),
    },
  });

  if (existingEmail) {
    throw new AppError(
      "A user with the institution administrator email already exists",
      409
    );
  }

  const passwordHash = await hashPassword(
    input.admin.password
  );

  return prisma.$transaction(async (tx) => {
    const createdInstitution =
      await tx.institution.create({
        data: {
          name: input.name,
          slug: input.slug,
          logoUrl: input.logoUrl || null,
          primaryColor: input.primaryColor || null,
          secondaryColor: input.secondaryColor || null,
          isActive: true,
        },
      });

    const roles = await ensureInstitutionSystemRoles(
      tx,
      createdInstitution.id
    );

    const adminRoleId =
      roles.get("INSTITUTION_ADMIN");

    if (!adminRoleId) {
      throw new AppError(
        "Failed to initialize institution administrator role",
        500
      );
    }

    const adminUser = await tx.user.create({
      data: {
        institutionId: createdInstitution.id,
        email: input.admin.email.toLowerCase(),
        passwordHash,
        firstName: input.admin.firstName,
        lastName: input.admin.lastName,
        phone: input.admin.phone || null,
        isActive: true,
      },
    });

    await tx.userRole.create({
      data: {
        userId: adminUser.id,
        roleId: adminRoleId,
      },
    });

    return tx.institution.findUniqueOrThrow({
      where: {
        id: createdInstitution.id,
      },
      include: {
        _count: {
          select: {
            users: true,
            departments: true,
            programs: true,
            studentEnrollments: true,
          },
        },
      },
    });
  });
}

export async function updateInstitution(
  id: string,
  input: UpdateInstitutionInput
) {
  const existing = await prisma.institution.findUnique({
    where: {
      id,
    },
  });

  if (!existing) {
    throw new AppError("Institution not found", 404);
  }

  if (
    input.slug &&
    input.slug !== existing.slug
  ) {
    const duplicate =
      await prisma.institution.findUnique({
        where: {
          slug: input.slug,
        },
      });

    if (duplicate) {
      throw new AppError(
        "An institution with this slug already exists",
        409
      );
    }
  }

  return prisma.institution.update({
    where: {
      id,
    },
    data: {
      ...(input.name !== undefined
        ? { name: input.name }
        : {}),

      ...(input.slug !== undefined
        ? { slug: input.slug }
        : {}),

      ...(input.logoUrl !== undefined
        ? {
            logoUrl: input.logoUrl || null,
          }
        : {}),

      ...(input.primaryColor !== undefined
        ? {
            primaryColor:
              input.primaryColor || null,
          }
        : {}),

      ...(input.secondaryColor !== undefined
        ? {
            secondaryColor:
              input.secondaryColor || null,
          }
        : {}),

      ...(input.isActive !== undefined
        ? {
            isActive: input.isActive,
          }
        : {}),
    },
  });
}

export async function setInstitutionActive(
  id: string,
  isActive: boolean
) {
  const institution =
    await prisma.institution.findUnique({
      where: {
        id,
      },
    });

  if (!institution) {
    throw new AppError(
      "Institution not found",
      404
    );
  }

  return prisma.institution.update({
    where: {
      id,
    },
    data: {
      isActive,
    },
  });
}

export async function getPlatformStats() {
  const [
    institutions,
    activeInstitutions,
    users,
    activeUsers,
    students,
    faculty,
    departments,
  ] = await prisma.$transaction([
    prisma.institution.count(),

    prisma.institution.count({
      where: {
        isActive: true,
      },
    }),

    prisma.user.count(),

    prisma.user.count({
      where: {
        isActive: true,
      },
    }),

    prisma.user.count({
      where: {
        userRoles: {
          some: {
            role: {
              name: "STUDENT",
            },
          },
        },
      },
    }),

    prisma.user.count({
      where: {
        userRoles: {
          some: {
            role: {
              name: "FACULTY",
            },
          },
        },
      },
    }),

    prisma.department.count(),
  ]);

  return {
    institutions,
    activeInstitutions,
    users,
    activeUsers,
    students,
    faculty,
    departments,
  };
}
