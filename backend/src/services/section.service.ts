import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";
import { PaginationParams } from "../utils/pagination";
import {
  CreateSectionInput,
  UpdateSectionInput,
} from "../validators/section.validators";

export interface ListFilters extends PaginationParams {
  search?: string;
  semesterId?: string;
  isActive?: boolean;
}

async function assertSemesterInInstitution(
  institutionId: string,
  semesterId: string
) {
  const semester = await prisma.semester.findFirst({
    where: { id: semesterId, institutionId },
  });
  if (!semester) {
    throw new AppError("semesterId does not belong to this institution", 400);
  }
  return semester;
}

const include = {
  semester: {
    select: {
      id: true,
      number: true,
      name: true,
      program: { select: { id: true, name: true, code: true } },
      academicYear: { select: { id: true, name: true } },
    },
  },
} satisfies Prisma.SectionInclude;

export async function listSections(
  institutionId: string,
  filters: ListFilters
) {
  const where: Prisma.SectionWhereInput = {
    institutionId,
    ...(filters.semesterId ? { semesterId: filters.semesterId } : {}),
    ...(filters.isActive !== undefined ? { isActive: filters.isActive } : {}),
    ...(filters.search
      ? { name: { contains: filters.search, mode: "insensitive" } }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.section.findMany({
      where,
      skip: filters.skip,
      take: filters.take,
      orderBy: { name: "asc" },
      include,
    }),
    prisma.section.count({ where }),
  ]);

  return { items, total };
}

export async function getSectionById(institutionId: string, id: string) {
  const section = await prisma.section.findFirst({
    where: { id, institutionId },
    include,
  });
  if (!section) {
    throw new AppError("Section not found", 404);
  }
  return section;
}

export async function createSection(
  institutionId: string,
  input: CreateSectionInput
) {
  await assertSemesterInInstitution(institutionId, input.semesterId);

  const existing = await prisma.section.findFirst({
    where: {
      institutionId,
      semesterId: input.semesterId,
      name: input.name,
    },
  });
  if (existing) {
    throw new AppError(
      `A section named "${input.name}" already exists for this semester`,
      409
    );
  }

  return prisma.section.create({
    data: { institutionId, ...input },
    include,
  });
}

export async function updateSection(
  institutionId: string,
  id: string,
  input: UpdateSectionInput
) {
  const current = await getSectionById(institutionId, id);

  if (input.name) {
    const nameTaken = await prisma.section.findFirst({
      where: {
        institutionId,
        semesterId: current.semesterId,
        name: input.name,
        NOT: { id },
      },
    });
    if (nameTaken) {
      throw new AppError(
        `A section named "${input.name}" already exists for this semester`,
        409
      );
    }
  }

  return prisma.section.update({ where: { id }, data: input, include });
}

/** Soft delete — preserves history for any CourseOffering referencing this section. */
export async function deactivateSection(institutionId: string, id: string) {
  await getSectionById(institutionId, id);
  return prisma.section.update({ where: { id }, data: { isActive: false } });
}
