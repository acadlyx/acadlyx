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
import { provisionTenantEntitlements } from "./entitlement.service";

async function ensurePermissionCatalog(
  tx: Prisma.TransactionClient
): Promise<Map<string, string>> {
  /*
   * The permission catalog is global.
   *
   * Do not perform dozens of sequential upserts here. Institution
   * creation runs inside a transaction and Supabase's pooler can
   * otherwise hit Prisma's default transaction timeout.
   *
   * The production bootstrap already repairs the catalog, so this
   * function only creates missing permissions and then reads the
   * complete catalog in one query.
   */

  const existing = await tx.permission.findMany({
    where: {
      key: {
        in: PERMISSIONS.map((permission) => permission.key),
      },
    },
    select: {
      id: true,
      key: true,
    },
  });

  const existingKeys = new Set(
    existing.map((permission) => permission.key)
  );

  const missing = PERMISSIONS.filter(
    (permission) => !existingKeys.has(permission.key)
  );

  if (missing.length > 0) {
    await tx.permission.createMany({
      data: missing.map((permission) => ({
        key: permission.key,
        module: permission.module,
        description: permission.description,
      })),
      skipDuplicates: true,
    });
  }

  const records = await tx.permission.findMany({
    where: {
      key: {
        in: PERMISSIONS.map((permission) => permission.key),
      },
    },
    select: {
      id: true,
      key: true,
    },
  });

  return new Map(
    records.map((permission) => [
      permission.key,
      permission.id,
    ])
  );
}

/**
 * Creates/repairs all standard institution roles.
 *
 * SUPER_ADMIN is intentionally excluded because it is a
 * platform-level role with institutionId = null.
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
      select: {
        id: true,
        isSystem: true,
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
        select: {
          id: true,
          isSystem: true,
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
        select: {
          id: true,
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

    /*
     * Remove permissions no longer belonging to the system role.
     */
    if (desiredPermissionIds.length > 0) {
      await tx.rolePermission.deleteMany({
        where: {
          roleId: role.id,
          permissionId: {
            notIn: desiredPermissionIds,
          },
        },
      });
    } else {
      await tx.rolePermission.deleteMany({
        where: {
          roleId: role.id,
        },
      });
    }

    /*
     * Re-create the desired links idempotently.
     */
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

function mapInstitutionCreateError(
  error: unknown
): never {
  if (error instanceof AppError) {
    throw error;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      const target = Array.isArray(error.meta?.target)
        ? error.meta.target.join(", ")
        : String(error.meta?.target ?? "");

      if (target.includes("slug")) {
        throw new AppError(
          "An institution with this slug already exists",
          409
        );
      }

      if (target.includes("email")) {
        throw new AppError(
          "A user with the institution administrator email already exists",
          409
        );
      }

      throw new AppError(
        "A record with the same unique value already exists",
        409
      );
    }

    if (error.code === "P2028") {
      throw new AppError(
        "Institution creation timed out while initializing roles and permissions. Please try again.",
        503
      );
    }

    if (error.code === "P2003") {
      throw new AppError(
        "Institution creation failed because a required related record is missing.",
        409
      );
    }
  }

  throw error;
}

export async function createInstitution(
  input: CreateInstitutionInput
) {
  const normalizedSlug = input.slug.trim().toLowerCase();
  const normalizedEmail =
    input.admin.email.trim().toLowerCase();

  const existingSlug = await prisma.institution.findUnique({
    where: {
      slug: normalizedSlug,
    },
    select: {
      id: true,
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
      email: normalizedEmail,
    },
    select: {
      id: true,
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

  try {
    /*
     * Explicitly extend the transaction timeout.
     *
     * This is important for Supabase pooled PostgreSQL because
     * institution creation initializes the institution-scoped
     * system roles and their permissions.
     */
    return await prisma.$transaction(
      async (tx) => {
        const createdInstitution =
          await tx.institution.create({
            data: {
              name: input.name.trim(),
              slug: normalizedSlug,
              logoUrl: input.logoUrl?.trim()
                ? input.logoUrl.trim()
                : null,
              primaryColor:
                input.primaryColor?.trim()
                  ? input.primaryColor.trim()
                  : null,
              secondaryColor:
                input.secondaryColor?.trim()
                  ? input.secondaryColor.trim()
                  : null,
              isActive: true,
            },
          });

        const roles =
          await ensureInstitutionSystemRoles(
            tx,
            createdInstitution.id
          );

        await provisionTenantEntitlements(tx, createdInstitution.id);

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
            institutionId:
              createdInstitution.id,
            email: normalizedEmail,
            passwordHash,
            firstName:
              input.admin.firstName.trim(),
            lastName:
              input.admin.lastName.trim(),
            phone:
              input.admin.phone?.trim()
                ? input.admin.phone.trim()
                : null,
            isActive: true,
          },
          select: {
            id: true,
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
      },
      {
        maxWait: 10000,
        timeout: 30000,
      }
    );
  } catch (error) {
    return mapInstitutionCreateError(error);
  }
}

export async function updateInstitution(
  id: string,
  input: UpdateInstitutionInput
) {
  const existing = await prisma.institution.findUnique({
    where: {
      id,
    },
    select: {
      id: true,
      slug: true,
    },
  });

  if (!existing) {
    throw new AppError(
      "Institution not found",
      404
    );
  }

  const normalizedSlug =
    input.slug !== undefined
      ? input.slug.trim().toLowerCase()
      : undefined;

  if (
    normalizedSlug &&
    normalizedSlug !== existing.slug
  ) {
    const duplicate =
      await prisma.institution.findUnique({
        where: {
          slug: normalizedSlug,
        },
        select: {
          id: true,
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
        ? {
            name: input.name.trim(),
          }
        : {}),

      ...(normalizedSlug !== undefined
        ? {
            slug: normalizedSlug,
          }
        : {}),

      ...(input.logoUrl !== undefined
        ? {
            logoUrl: input.logoUrl.trim()
              ? input.logoUrl.trim()
              : null,
          }
        : {}),

      ...(input.primaryColor !== undefined
        ? {
            primaryColor:
              input.primaryColor.trim()
                ? input.primaryColor.trim()
                : null,
          }
        : {}),

      ...(input.secondaryColor !== undefined
        ? {
            secondaryColor:
              input.secondaryColor.trim()
                ? input.secondaryColor.trim()
                : null,
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
      select: {
        id: true,
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
