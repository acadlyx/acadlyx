import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";
import { PaginationParams } from "../utils/pagination";
import {
  CreateCourseInput,
  UpdateCourseInput,
} from "../validators/course.validators";

export interface ListFilters extends PaginationParams {
  search?: string;
  departmentId?: string;
  isActive?: boolean;
}

async function assertDepartmentInInstitution(
  institutionId: string,
  departmentId: string
) {
  const department = await prisma.department.findFirst({
    where: { id: departmentId, institutionId },
  });
  if (!department) {
    throw new AppError(
      "departmentId does not belong to this institution",
      400
    );
  }
}

const include = {
  department: { select: { id: true, name: true, code: true } },
} satisfies Prisma.CourseInclude;

export async function listCourses(institutionId: string, filters: ListFilters) {
  const where: Prisma.CourseWhereInput = {
    institutionId,
    ...(filters.departmentId ? { departmentId: filters.departmentId } : {}),
    ...(filters.isActive !== undefined ? { isActive: filters.isActive } : {}),
    ...(filters.search
      ? {
          OR: [
            { name: { contains: filters.search, mode: "insensitive" } },
            { code: { contains: filters.search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.course.findMany({
      where,
      skip: filters.skip,
      take: filters.take,
      orderBy: { code: "asc" },
      include,
    }),
    prisma.course.count({ where }),
  ]);

  return { items, total };
}

export async function getCourseById(institutionId: string, id: string) {
  const course = await prisma.course.findFirst({
    where: { id, institutionId },
    include,
  });
  if (!course) {
    throw new AppError("Course not found", 404);
  }
  return course;
}

export async function createCourse(
  institutionId: string,
  input: CreateCourseInput
) {
  await assertDepartmentInInstitution(institutionId, input.departmentId);

  const code = input.code.trim().toUpperCase();
  const name = input.name.trim();

  const existing = await prisma.course.findFirst({
    where: { institutionId, code },
  });
  if (existing) {
    throw new AppError(`A course with code "${code}" already exists`, 409);
  }

  return prisma.course.create({
    data: {
      institutionId,
      ...input,
      code,
      name,
    },
    include,
  });
}

export async function updateCourse(
  institutionId: string,
  id: string,
  input: UpdateCourseInput
) {
  const current = await getCourseById(institutionId, id);

  if (input.departmentId) {
    await assertDepartmentInInstitution(institutionId, input.departmentId);
  }

  const nextCode = input.code?.trim().toUpperCase();

  if (nextCode) {
    const codeTaken = await prisma.course.findFirst({
      where: { institutionId, code: nextCode, NOT: { id } },
    });
    if (codeTaken) {
      throw new AppError(
        `A course with code "${nextCode}" already exists`,
        409
      );
    }
  }

  if (input.isActive === true) {
    await assertDepartmentInInstitution(
      institutionId,
      input.departmentId ?? current.departmentId,
      true
    );
  }

  return prisma.course.update({
    where: { id },
    data: {
      ...(input.departmentId !== undefined
        ? { departmentId: input.departmentId }
        : {}),
      ...(nextCode !== undefined ? { code: nextCode } : {}),
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.credits !== undefined ? { credits: input.credits } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    },
    include,
  });
}

/** Soft delete — preserves history for any CourseOffering referencing this course. */
export async function deactivateCourse(institutionId: string, id: string) {
  await getCourseById(institutionId, id);
  return prisma.course.update({ where: { id }, data: { isActive: false } });
}
