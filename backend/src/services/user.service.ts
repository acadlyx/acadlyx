import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";
import { hashPassword } from "../utils/password";
import {
  CreateUserInput,
  UpdateUserInput,
} from "../validators/user.validators";

async function getRoleForUser(
  roleName: string,
  institutionId: string | null
) {
  const role = await prisma.role.findFirst({
    where: {
      name: roleName,
      institutionId,
    },
  });

  if (role) {
    return role;
  }

  if (roleName === "SUPER_ADMIN" && institutionId === null) {
    const globalRole = await prisma.role.findFirst({
      where: {
        name: "SUPER_ADMIN",
        institutionId: null,
      },
    });

    if (globalRole) {
      return globalRole;
    }
  }

  throw new AppError(
    `Role "${roleName}" is not available in this scope`,
    400
  );
}

export async function listUsers(params: {
  page: number;
  pageSize: number;
  search?: string;
  institutionId?: string;
  role?: string;
  isActive?: boolean;
}) {
  const where: Prisma.UserWhereInput = {};

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

  if (params.institutionId) {
    where.institutionId = params.institutionId;
  }

  if (params.isActive !== undefined) {
    where.isActive = params.isActive;
  }

  if (params.role) {
    where.userRoles = {
      some: {
        role: {
          name: params.role,
        },
      },
    };
  }

  const [items, total] = await prisma.$transaction([
    prisma.user.findMany({
      where,
      orderBy: {
        createdAt: "desc",
      },
      skip: (params.page - 1) * params.pageSize,
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
      roles: user.userRoles.map((binding) => binding.role),
      userRoles: undefined,
    })),
    total,
  };
}

export async function getUserById(id: string) {
  const user = await prisma.user.findUnique({
    where: {
      id,
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
    throw new AppError("User not found", 404);
  }

  return {
    ...user,
    roles: user.userRoles.map((binding) => binding.role),
    userRoles: undefined,
  };
}

export async function createUser(input: CreateUserInput) {
  const existing = await prisma.user.findUnique({
    where: {
      email: input.email,
    },
  });

  if (existing) {
    throw new AppError("A user with this email already exists", 409);
  }

  if (input.role === "SUPER_ADMIN" && input.institutionId) {
    throw new AppError(
      "SUPER_ADMIN must be a platform-level user",
      400
    );
  }

  if (input.role !== "SUPER_ADMIN" && !input.institutionId) {
    throw new AppError(
      "An institution is required for this role",
      400
    );
  }

  if (input.institutionId) {
    const institution = await prisma.institution.findUnique({
      where: {
        id: input.institutionId,
      },
    });

    if (!institution) {
      throw new AppError("Institution not found", 404);
    }

    if (!institution.isActive) {
      throw new AppError(
        "Cannot create users in an inactive institution",
        400
      );
    }
  }

  const role = await getRoleForUser(
    input.role,
    input.institutionId ?? null
  );

  const passwordHash = await hashPassword(input.password);

  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        institutionId: input.institutionId ?? null,
        email: input.email,
        passwordHash,
        firstName: input.firstName,
        lastName: input.lastName,
        phone: input.phone || null,
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
  });

  return getUserById(user.id);
}

export async function updateUser(
  id: string,
  input: UpdateUserInput,
  actorId: string
) {
  const existing = await prisma.user.findUnique({
    where: {
      id,
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
    throw new AppError("User not found", 404);
  }

  if (id === actorId && input.isActive === false) {
    throw new AppError(
      "You cannot deactivate your own account",
      400
    );
  }

  const currentRole = existing.userRoles[0]?.role;

  if (
    id === actorId &&
    input.role &&
    input.role !== currentRole?.name
  ) {
    throw new AppError(
      "You cannot change your own role",
      400
    );
  }

  if (input.role) {
    const role = await getRoleForUser(
      input.role,
      existing.institutionId
    );

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: {
          id,
        },
        data: {
          ...(input.firstName !== undefined
            ? { firstName: input.firstName }
            : {}),
          ...(input.lastName !== undefined
            ? { lastName: input.lastName }
            : {}),
          ...(input.phone !== undefined
            ? { phone: input.phone || null }
            : {}),
          ...(input.isActive !== undefined
            ? { isActive: input.isActive }
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
    });
  } else {
    await prisma.user.update({
      where: {
        id,
      },
      data: {
        ...(input.firstName !== undefined
          ? { firstName: input.firstName }
          : {}),
        ...(input.lastName !== undefined
          ? { lastName: input.lastName }
          : {}),
        ...(input.phone !== undefined
          ? { phone: input.phone || null }
          : {}),
        ...(input.isActive !== undefined
          ? { isActive: input.isActive }
          : {}),
      },
    });
  }

  return getUserById(id);
}

export async function setUserActive(
  id: string,
  isActive: boolean,
  actorId: string
) {
  if (id === actorId && !isActive) {
    throw new AppError(
      "You cannot deactivate your own account",
      400
    );
  }

  const user = await prisma.user.findUnique({
    where: {
      id,
    },
  });

  if (!user) {
    throw new AppError("User not found", 404);
  }

  await prisma.user.update({
    where: {
      id,
    },
    data: {
      isActive,
    },
  });

  if (!isActive) {
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

  return getUserById(id);
}
