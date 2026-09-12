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

/** Only one academic year can be "current" per institution at a time. */
async function clearOtherCurrentYears(institutionId: string, exceptId?: string) {
  await prisma.academicYear.updateMany({
    where: { institutionId, isCurrent: true, ...(exceptId ? { NOT: { id: exceptId } } : {}) },
    data: { isCurrent: false },
  });
}

export async function createAcademicYear(
  institutionId: string,
  input: CreateAcademicYearInput
) {
  const existing = await prisma.academicYear.findFirst({
    where: { institutionId, name: input.name },
  });
  if (existing) {
    throw new AppError(
      `An academic year named "${input.name}" already exists`,
      409
    );
  }

  const year = await prisma.academicYear.create({
    data: { institutionId, ...input },
  });

  if (input.isCurrent) {
    await clearOtherCurrentYears(institutionId, year.id);
  }

  return year;
}

export async function updateAcademicYear(
  institutionId: string,
  id: string,
  input: UpdateAcademicYearInput
) {
  await getAcademicYearById(institutionId, id);

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

  const year = await prisma.academicYear.update({ where: { id }, data: input });

  if (input.isCurrent) {
    await clearOtherCurrentYears(institutionId, id);
  }

  return year;
}
