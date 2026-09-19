import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";
import { PaginationParams } from "../utils/pagination";
import {
  CreateAcademicYearInput,
  UpdateAcademicYearInput,
} from "../validators/academicYear.validators";

export interface ListFilters extends PaginationParams {
  search?: string;
}

export async function listAcademicYears(
  institutionId: string,
  filters: ListFilters
) {
  const where: Prisma.AcademicYearWhereInput = {
    institutionId,
    ...(filters.search
      ? { name: { contains: filters.search, mode: "insensitive" } }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.academicYear.findMany({
      where,
      skip: filters.skip,
      take: filters.take,
      orderBy: { startDate: "desc" },
    }),
    prisma.academicYear.count({ where }),
  ]);

  return { items, total };
}

export async function getAcademicYearById(institutionId: string, id: string) {
  const year = await prisma.academicYear.findFirst({
    where: { id, institutionId },
  });
  if (!year) {
    throw new AppError("Academic year not found", 404);
  }
  return year;
}


export async function createAcademicYear(
  institutionId: string,
  input: CreateAcademicYearInput
) {
  const name = input.name.trim();

  if (input.endDate && input.startDate >= input.endDate) {
    throw new AppError(
      "Academic year end date must be after its start date",
      400
    );
  }

  const existing = await prisma.academicYear.findFirst({
    where: { institutionId, name },
  });
  if (existing) {
    throw new AppError(
      `An academic year named "${input.name}" already exists`,
      409
    );
  }

  return prisma.$transaction(async (tx) => {
    const year = await tx.academicYear.create({
      data: { institutionId, ...input, name },
    });

    if (input.isCurrent) {
      await tx.academicYear.updateMany({
        where: {
          institutionId,
          isCurrent: true,
          NOT: { id: year.id },
        },
        data: { isCurrent: false },
      });
    }

    return year;
  });
}

export async function updateAcademicYear(
  institutionId: string,
  id: string,
  input: UpdateAcademicYearInput
) {
  await getAcademicYearById(institutionId, id);

  if (input.startDate && input.endDate && input.startDate >= input.endDate) {
    throw new AppError(
      "Academic year end date must be after its start date",
      400
    );
  }

  if (input.name) {
    const nameTaken = await prisma.academicYear.findFirst({
      where: { institutionId, name: input.name, NOT: { id } },
    });
    if (nameTaken) {
      throw new AppError(
        `An academic year named "${input.name}" already exists`,
        409
      );
    }
  }

  return prisma.$transaction(async (tx) => {
    const year = await tx.academicYear.update({
      where: { id },
      data: {
        ...input,
        ...(input.name !== undefined
          ? { name: input.name.trim() }
          : {}),
      },
    });

    if (input.isCurrent) {
      await tx.academicYear.updateMany({
        where: {
          institutionId,
          isCurrent: true,
          NOT: { id },
        },
        data: { isCurrent: false },
      });
    }

    return year;
  });
}
