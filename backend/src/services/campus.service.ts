import { Prisma } from "@prisma/client";

import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";
import {
  PaginationParams,
} from "../utils/pagination";

import {
  CreateCampusInput,
  UpdateCampusInput,
} from "../validators/campus.validators";

export interface ListCampusFilters
  extends PaginationParams {
  search?: string;
  isActive?: boolean;
}

const campusInclude = {
  _count: {
    select: {
      departments: true,
    },
  },
} satisfies Prisma.CampusInclude;

export async function listCampuses(
  institutionId: string,
  filters: ListCampusFilters
) {
  const search = filters.search?.trim();

  const where: Prisma.CampusWhereInput = {
    institutionId,

    ...(filters.isActive !== undefined
      ? {
          isActive: filters.isActive,
        }
      : {}),

    ...(search
      ? {
          OR: [
            {
              name: {
                contains: search,
                mode: "insensitive",
              },
            },
            {
              code: {
                contains: search,
                mode: "insensitive",
              },
            },
            {
              address: {
                contains: search,
                mode: "insensitive",
              },
            },
          ],
        }
      : {}),
  };

  const [items, total] =
    await Promise.all([
      prisma.campus.findMany({
        where,

        skip: filters.skip,
        take: filters.take,

        orderBy: [
          {
            isActive: "desc",
          },
          {
            name: "asc",
          },
        ],

        include: campusInclude,
      }),

      prisma.campus.count({
        where,
      }),
    ]);

  return {
    items,
    total,
  };
}

export async function getCampusById(
  institutionId: string,
  id: string
) {
  const campus =
    await prisma.campus.findFirst({
      where: {
        id,
        institutionId,
      },

      include: campusInclude,
    });

  if (!campus) {
    throw new AppError(
      "Campus not found",
      404
    );
  }

  return campus;
}

export async function createCampus(
  institutionId: string,
  input: CreateCampusInput
) {
  const name = input.name.trim();
  const code = input.code.trim().toUpperCase();

  const existing =
    await prisma.campus.findFirst({
      where: {
        institutionId,
        code,
      },

      select: {
        id: true,
      },
    });

  if (existing) {
    throw new AppError(
      `A campus with code "${code}" already exists`,
      409
    );
  }

  return prisma.campus.create({
    data: {
      institutionId,
      name,
      code,
      address:
        input.address?.trim() || null,
    },

    include: campusInclude,
  });
}

export async function updateCampus(
  institutionId: string,
  id: string,
  input: UpdateCampusInput
) {
  await getCampusById(
    institutionId,
    id
  );

  const nextCode =
    input.code === undefined
      ? undefined
      : input.code.trim().toUpperCase();

  if (nextCode) {
    const codeTaken =
      await prisma.campus.findFirst({
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
      });

    if (codeTaken) {
      throw new AppError(
        `A campus with code "${nextCode}" already exists`,
        409
      );
    }
  }

  return prisma.campus.update({
    where: {
      id,
    },

    data: {
      ...(input.name !== undefined
        ? {
            name: input.name.trim(),
          }
        : {}),

      ...(nextCode !== undefined
        ? {
            code: nextCode,
          }
        : {}),

      ...(input.address !== undefined
        ? {
            address:
              input.address === null
                ? null
                : input.address.trim(),
          }
        : {}),

      ...(input.isActive !== undefined
        ? {
            isActive: input.isActive,
          }
        : {}),
    },

    include: campusInclude,
  });
}

/**
 * Campuses are soft-deactivated.
 *
 * A campus cannot be deactivated while it still
 * contains active departments because doing so would
 * leave the academic hierarchy in an inconsistent state.
 */
export async function deactivateCampus(
  institutionId: string,
  id: string
) {
  const campus =
    await getCampusById(
      institutionId,
      id
    );

  if (!campus.isActive) {
    return campus;
  }

  const dependencies =
    await prisma.campus.findFirst({
      where: {
        id,
        institutionId,
      },

      select: {
        departments: {
          where: {
            isActive: true,
          },

          select: {
            id: true,
          },

          take: 1,
        },
      },
    });

  if (
    dependencies &&
    dependencies.departments.length > 0
  ) {
    throw new AppError(
      "Deactivate the campus's active departments before deactivating the campus",
      409
    );
  }

  return prisma.campus.update({
    where: {
      id,
    },

    data: {
      isActive: false,
    },

    include: campusInclude,
  });
}
