import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";
import { PaginationParams } from "../utils/pagination";
import {
  CreateDepartmentInput,
  UpdateDepartmentInput,
} from "../validators/department.validators";

export interface ListFilters extends PaginationParams {
  search?: string;
  isActive?: boolean;
}

/**
 * Every query here is scoped by institutionId — the caller must
 * pass the value from req.user.institutionId, never from client input.
 */
export async function listDepartments(
  institutionId: string,
  filters: ListFilters
) {
  const where: Prisma.DepartmentWhereInput = {
    institutionId,
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
    prisma.department.findMany({
      where,
      skip: filters.skip,
      take: filters.take,
      orderBy: { name: "asc" },
      include: { campus: { select: { id: true, name: true, code: true } } },
    }),
    prisma.department.count({ where }),
  ]);

  return { items, total };
}

export async function getDepartmentById(
  institutionId: string,
  id: string
) {
  const department = await prisma.department.findFirst({
    where: { id, institutionId },
    include: { campus: { select: { id: true, name: true, code: true } } },
  });

  if (!department) {
    throw new AppError("Department not found", 404);
  }

  return department;
}

export async function createDepartment(
  institutionId: string,
  input: CreateDepartmentInput
) {
  if (input.campusId) {
    const campus = await prisma.campus.findFirst({
      where: { id: input.campusId, institutionId },
    });
    if (!campus) {
      throw new AppError("campusId does not belong to this institution", 400);
    }
  }

  const existing = await prisma.department.findFirst({
    where: { institutionId, code: input.code },
  });
  if (existing) {
    throw new AppError(
      `A department with code "${input.code}" already exists`,
      409
    );
  }

  return prisma.department.create({
    data: {
      institutionId,
      name: input.name,
      code: input.code,
      campusId: input.campusId,
    },
  });
}

export async function updateDepartment(
  institutionId: string,
  id: string,
  input: UpdateDepartmentInput
) {
  await getDepartmentById(institutionId, id); // 404s if not found / wrong tenant

  if (input.campusId) {
    const campus = await prisma.campus.findFirst({
      where: { id: input.campusId, institutionId },
    });
    if (!campus) {
      throw new AppError("campusId does not belong to this institution", 400);
    }
  }

  if (input.code) {
    const codeTaken = await prisma.department.findFirst({
      where: { institutionId, code: input.code, NOT: { id } },
    });
    if (codeTaken) {
      throw new AppError(
        `A department with code "${input.code}" already exists`,
        409
      );
    }
  }

  return prisma.department.update({
    where: { id },
    data: input,
  });
}

/** Soft delete — preserves history for anything that references this department. */
export async function deactivateDepartment(institutionId: string, id: string) {
  await getDepartmentById(institutionId, id);

  return prisma.department.update({
    where: { id },
    data: { isActive: false },
  });
}
