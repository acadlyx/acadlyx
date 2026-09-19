import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";
import { PaginationParams } from "../utils/pagination";
import {
  CreateSemesterInput,
  UpdateSemesterInput,
} from "../validators/semester.validators";

export interface ListFilters extends PaginationParams {
  search?: string;
  programId?: string;
  academicYearId?: string;
  isActive?: boolean;
}

async function assertProgramInInstitution(
  institutionId: string,
  programId: string
) {
  const program = await prisma.program.findFirst({
    where: { id: programId, institutionId },
  });
  if (!program) {
    throw new AppError("programId does not belong to this institution", 400);
  }
}

async function assertAcademicYearInInstitution(
  institutionId: string,
  academicYearId: string
) {
  const year = await prisma.academicYear.findFirst({
    where: { id: academicYearId, institutionId },
  });
  if (!year) {
    throw new AppError(
      "academicYearId does not belong to this institution",
      400
    );
  }
}

const include = {
  program: { select: { id: true, name: true, code: true } },
  academicYear: { select: { id: true, name: true } },
} satisfies Prisma.SemesterInclude;

export async function listSemesters(
  institutionId: string,
  filters: ListFilters
) {
  const where: Prisma.SemesterWhereInput = {
    institutionId,
    ...(filters.programId ? { programId: filters.programId } : {}),
    ...(filters.academicYearId
      ? { academicYearId: filters.academicYearId }
      : {}),
    ...(filters.isActive !== undefined ? { isActive: filters.isActive } : {}),
    ...(filters.search
      ? { name: { contains: filters.search, mode: "insensitive" } }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.semester.findMany({
      where,
      skip: filters.skip,
      take: filters.take,
      orderBy: [{ academicYear: { startDate: "desc" } }, { number: "asc" }],
      include,
    }),
    prisma.semester.count({ where }),
  ]);

  return { items, total };
}

export async function getSemesterById(institutionId: string, id: string) {
  const semester = await prisma.semester.findFirst({
    where: { id, institutionId },
    include,
  });
  if (!semester) {
    throw new AppError("Semester not found", 404);
  }
  return semester;
}

async function assertNumberAvailable(
  programId: string,
  academicYearId: string,
  number: number,
  exceptId?: string
) {
  const existing = await prisma.semester.findFirst({
    where: {
      institutionId,
      programId,
      academicYearId,
      number,
      ...(exceptId ? { NOT: { id: exceptId } } : {}),
    },
  });
  if (existing) {
    throw new AppError(
      `Semester ${number} already exists for this program and academic year`,
      409
    );
  }
}

export async function createSemester(
  institutionId: string,
  input: CreateSemesterInput
) {
  await assertProgramInInstitution(institutionId, input.programId);
  await assertAcademicYearInInstitution(institutionId, input.academicYearId);
  await assertNumberAvailable(
    institutionId,
    input.programId,
    input.academicYearId,
    input.number
  );

  return prisma.semester.create({
    data: { institutionId, ...input },
    include,
  });
}

export async function updateSemester(
  institutionId: string,
  id: string,
  input: UpdateSemesterInput
) {
  const current = await getSemesterById(institutionId, id);

  if (input.number !== undefined) {
    await assertNumberAvailable(
      institutionId,
      current.programId,
      current.academicYearId,
      input.number,
      id
    );
  }

  return prisma.semester.update({ where: { id }, data: input, include });
}

/** Soft delete — preserves history for anything scheduled under this semester. */
export async function deactivateSemester(institutionId: string, id: string) {
  await getSemesterById(institutionId, id);
  return prisma.semester.update({
    where: { id },
    data: { isActive: false },
  });
}
