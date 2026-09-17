import {
  Prisma,
} from "@prisma/client";

import {
  prisma,
} from "../lib/prisma";

import {
  AppError,
} from "../middleware/errorHandler";

import {
  PaginationParams,
} from "../utils/pagination";

import {
  CreateDepartmentInput,
  UpdateDepartmentInput,
} from "../validators/department.validators";

export interface ListFilters
  extends PaginationParams {
  search?: string;
  isActive?: boolean;
}

const departmentInclude = {
  campus: {
    select: {
      id: true,
      name: true,
      code: true,
      isActive: true,
    },
  },

  _count: {
    select: {
      programs: true,
      courses: true,
      departmentAccesses: true,
    },
  },
} satisfies Prisma.DepartmentInclude;

async function assertCampusInInstitution(
  institutionId: string,
  campusId: string
): Promise<void> {
  const campus =
    await prisma.campus.findFirst(
      {
        where: {
          id: campusId,
          institutionId,
        },

        select: {
          id: true,
        },
      }
    );

  if (!campus) {
    throw new AppError(
      "campusId does not belong to this institution",
      400
    );
  }
}

export async function listDepartments(
  institutionId: string,
  filters: ListFilters
) {
  const search =
    filters.search?.trim();

  const where: Prisma.DepartmentWhereInput =
    {
      institutionId,

      ...(filters.isActive !==
      undefined
        ? {
            isActive:
              filters.isActive,
          }
        : {}),

      ...(search
        ? {
            OR: [
              {
                name: {
                  contains:
                    search,
                  mode: "insensitive",
                },
              },
              {
                code: {
                  contains:
                    search,
                  mode: "insensitive",
                },
              },
            ],
          }
        : {}),
    };

  const [
    items,
    total,
  ] =
    await Promise.all([
      prisma.department.findMany(
        {
          where,

          skip:
            filters.skip,

          take:
            filters.take,

          orderBy: [
            {
              isActive:
                "desc",
            },
            {
              name: "asc",
            },
          ],

          include:
            departmentInclude,
        }
      ),

      prisma.department.count(
        {
          where,
        }
      ),
    ]);

  return {
    items,
    total,
  };
}

export async function getDepartmentById(
  institutionId: string,
  id: string
) {
  const department =
    await prisma.department.findFirst(
      {
        where: {
          id,
          institutionId,
        },

        include:
          departmentInclude,
      }
    );

  if (!department) {
    throw new AppError(
      "Department not found",
      404
    );
  }

  return department;
}

export async function createDepartment(
  institutionId: string,
  input: CreateDepartmentInput
) {
  const name =
    input.name.trim();

  const code =
    input.code
      .trim()
      .toUpperCase();

  if (
    input.campusId
  ) {
    await assertCampusInInstitution(
      institutionId,
      input.campusId
    );
  }

  const existing =
    await prisma.department.findFirst(
      {
        where: {
          institutionId,
          code,
        },

        select: {
          id: true,
        },
      }
    );

  if (existing) {
    throw new AppError(
      `A department with code "${code}" already exists`,
      409
    );
  }

  return prisma.department.create(
    {
      data: {
        institutionId,
        name,
        code,

        campusId:
          input.campusId,
      },

      include:
        departmentInclude,
    }
  );
}

export async function updateDepartment(
  institutionId: string,
  id: string,
  input: UpdateDepartmentInput
) {
  await getDepartmentById(
    institutionId,
    id
  );

  if (
    input.campusId
  ) {
    await assertCampusInInstitution(
      institutionId,
      input.campusId
    );
  }

  const nextCode =
    input.code
      ?.trim()
      .toUpperCase();

  if (nextCode) {
    const codeTaken =
      await prisma.department.findFirst(
        {
          where: {
            institutionId,
            code: nextCode,

            NOT: {
              id,
            },
          },

          select: {
            id: true,
          },
        }
      );

    if (
      codeTaken
    ) {
      throw new AppError(
        `A department with code "${nextCode}" already exists`,
        409
      );
    }
  }

  return prisma.department.update(
    {
      where: {
        id,
      },

      data: {
        ...(input.name !==
        undefined
          ? {
              name:
                input.name.trim(),
            }
          : {}),

        ...(nextCode !==
        undefined
          ? {
              code:
                nextCode,
            }
          : {}),

        ...(input.campusId !==
        undefined
          ? {
              campusId:
                input.campusId,
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

      include:
        departmentInclude,
    }
  );
}

/**
 * Soft-deactivation only.
 *
 * Historical academic data is
 * never hard-deleted.
 *
 * A department with active programs
 * or courses cannot be deactivated.
 */
export async function deactivateDepartment(
  institutionId: string,
  id: string
) {
  const department =
    await getDepartmentById(
      institutionId,
      id
    );

  if (
    !department.isActive
  ) {
    return department;
  }

  const dependencies =
    await prisma.department.findFirst(
      {
        where: {
          id,
          institutionId,
        },

        select: {
          programs: {
            where: {
              isActive: true,
            },

            select: {
              id: true,
            },

            take: 1,
          },

          courses: {
            where: {
              isActive: true,
            },

            select: {
              id: true,
            },

            take: 1,
          },
        },
      }
    );

  if (
    dependencies &&
    (
      dependencies.programs.length >
        0 ||
      dependencies.courses.length >
        0
    )
  ) {
    throw new AppError(
      "Deactivate the department's active programs and courses before deactivating the department",
      409
    );
  }

  return prisma.department.update(
    {
      where: {
        id,
      },

      data: {
        isActive: false,
      },

      include:
        departmentInclude,
    }
  );
}
