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
  departmentId?: string;
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
  if (!program.isActive) {
    throw new AppError("Cannot use an inactive program", 400);
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
  return year;
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
    ...(filters.departmentId ? { program: { departmentId: filters.departmentId } } : {}),
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
  institutionId: string,
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
  const academicYear = await assertAcademicYearInInstitution(
    institutionId,
    input.academicYearId
  );

  if (input.startDate && input.startDate < academicYear.startDate) {
    throw new AppError(
      "Semester start date cannot be before the academic year starts",
      400
    );
  }
  if (input.endDate && input.endDate > academicYear.endDate) {
    throw new AppError(
      "Semester end date cannot be after the academic year ends",
      400
    );
  }
  if (input.startDate && input.endDate && input.endDate <= input.startDate) {
    throw new AppError(
      "Semester end date must be after its start date",
      400
    );
  }
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
  const academicYear = await assertAcademicYearInInstitution(
    institutionId,
    current.academicYearId
  );

  const nextStartDate = input.startDate ?? current.startDate;
  const nextEndDate = input.endDate ?? current.endDate;

  if (nextStartDate && nextStartDate < academicYear.startDate) {
    throw new AppError(
      "Semester start date cannot be before the academic year starts",
      400
    );
  }
  if (nextEndDate && nextEndDate > academicYear.endDate) {
    throw new AppError(
      "Semester end date cannot be after the academic year ends",
      400
    );
  }
  if (nextStartDate && nextEndDate && nextEndDate <= nextStartDate) {
    throw new AppError(
      "Semester end date must be after its start date",
      400
    );
  }

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

async function assertSemesterCanDeactivate(
  institutionId: string,
  id: string
) {
  const dependencies = await prisma.semester.findFirst({
    where: { id, institutionId },
    select: {
      sections: {
        where: { isActive: true },
        select: { id: true },
        take: 1,
      },
      courseOfferings: {
        where: { isActive: true },
        select: { id: true },
        take: 1,
      },
      studentEnrollments: {
        where: { status: "ACTIVE" },
        select: { id: true },
        take: 1,
      },
    },
  });

  if (
    dependencies &&
    (dependencies.sections.length > 0 ||
      dependencies.courseOfferings.length > 0 ||
      dependencies.studentEnrollments.length > 0)
  ) {
    throw new AppError(
      "Deactivate the semester's active sections, course offerings, and student enrollments before deactivating the semester",
      409
    );
  }
}

/** Soft delete — preserves history for anything scheduled under this semester. */
export async function deactivateSemester(institutionId: string, id: string) {
  const semester = await getSemesterById(institutionId, id);

  if (!semester.isActive) {
    return semester;
  }

  await assertSemesterCanDeactivate(institutionId, id);

  return prisma.semester.update({
    where: { id },
    data: { isActive: false },
    include,
  });
}
