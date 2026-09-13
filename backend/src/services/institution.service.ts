import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";
import { hashPassword } from "../utils/password";
import {
  CreateInstitutionInput,
  UpdateInstitutionInput,
} from "../validators/institution.validators";

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
    where: { id },
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
    throw new AppError("An institution with this slug already exists", 409);
  }

  const existingEmail = await prisma.user.findUnique({
    where: {
      email: input.admin.email,
    },
  });

  if (existingEmail) {
    throw new AppError(
      "A user with the institution administrator email already exists",
      409
    );
  }

  const passwordHash = await hashPassword(input.admin.password);

  const institution = await prisma.$transaction(async (tx) => {
    const createdInstitution = await tx.institution.create({
      data: {
        name: input.name,
        slug: input.slug,
        logoUrl: input.logoUrl || null,
        primaryColor: input.primaryColor || null,
        secondaryColor: input.secondaryColor || null,
      },
    });

    const permissions = await tx.permission.findMany({
      where: {
        key: {
          not: "institutions.manage",
        },
      },
      select: {
        id: true,
      },
    });

    const adminRole = await tx.role.create({
      data: {
        institutionId: createdInstitution.id,
        name: "INSTITUTION_ADMIN",
        description: "Institution administrator",
        isSystem: true,
      },
    });

    if (permissions.length > 0) {
      await tx.rolePermission.createMany({
        data: permissions.map((permission) => ({
          roleId: adminRole.id,
          permissionId: permission.id,
        })),
        skipDuplicates: true,
      });
    }

    const adminUser = await tx.user.create({
      data: {
        institutionId: createdInstitution.id,
        email: input.admin.email,
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
        roleId: adminRole.id,
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

  return institution;
}

export async function updateInstitution(
  id: string,
  input: UpdateInstitutionInput
) {
  const existing = await prisma.institution.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new AppError("Institution not found", 404);
  }

  if (input.slug && input.slug !== existing.slug) {
    const duplicate = await prisma.institution.findUnique({
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
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.slug !== undefined ? { slug: input.slug } : {}),
      ...(input.logoUrl !== undefined
        ? { logoUrl: input.logoUrl || null }
        : {}),
      ...(input.primaryColor !== undefined
        ? { primaryColor: input.primaryColor || null }
        : {}),
      ...(input.secondaryColor !== undefined
        ? { secondaryColor: input.secondaryColor || null }
        : {}),
      ...(input.isActive !== undefined
        ? { isActive: input.isActive }
        : {}),
    },
  });
}

export async function setInstitutionActive(
  id: string,
  isActive: boolean
) {
  const institution = await prisma.institution.findUnique({
    where: { id },
  });

  if (!institution) {
    throw new AppError("Institution not found", 404);
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
