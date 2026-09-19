import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";
import { PaginationParams } from "../utils/pagination";
import {
  CreateProgramInput,
  UpdateProgramInput,
} from "../validators/program.validators";

export interface ListFilters extends PaginationParams {
  search?: string;
  departmentId?: string;
  isActive?: boolean;
}

async function assertDepartmentInInstitution(
  institutionId: string,
  departmentId: string,
  requireActive = false
) {
  const department = await prisma.department.findFirst({
    where: { id: departmentId, institutionId },
    select: { id: true, isActive: true },
  });

  if (!department) {
    throw new AppError(
      "departmentId does not belong to this institution",
      400
    );
  }

  if (requireActive && !department.isActive) {
    throw new AppError(
      "Cannot use an inactive department",
      400
    );
  }

  return department;
}

export async function listPrograms(
  institutionId: string,
  filters: ListFilters
) {
  if (filters.departmentId) {
    await assertDepartmentInInstitution(institutionId, filters.departmentId);
  }

  const where: Prisma.ProgramWhereInput = {
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
    prisma.program.findMany({
      where,
      skip: filters.skip,
      take: filters.take,
      orderBy: { name: "asc" },
      include: { department: { select: { id: true, name: true, code: true } } },
    }),
    prisma.program.count({ where }),
  ]);

  return { items, total };
}

export async function getProgramById(institutionId: string, id: string) {
  const program = await prisma.program.findFirst({
    where: { id, institutionId },
    include: { department: { select: { id: true, name: true, code: true } } },
  });
  if (!program) {
    throw new AppError("Program not found", 404);
  }
  return program;
}

export async function createProgram(
  institutionId: string,
  input: CreateProgramInput
) {
  await assertDepartmentInInstitution(
    institutionId,
    input.departmentId,
    true
  );

  const code = input.code.trim().toUpperCase();
  const name = input.name.trim();

  const existing = await prisma.program.findFirst({
    where: { institutionId, code },
  });
  if (existing) {
    throw new AppError(
      `A program with code "${code}" already exists`,
      409
    );
  }

  return prisma.program.create({
    data: {
      institutionId,
      ...input,
      name,
      code,
    },
  });
}

export async function updateProgram(
  institutionId: string,
  id: string,
  input: UpdateProgramInput
) {
  const current = await getProgramById(institutionId, id);

  if (input.departmentId) {
    await assertDepartmentInInstitution(
      institutionId,
      input.departmentId,
      input.isActive !== false
    );
  }

  const nextCode = input.code?.trim().toUpperCase();

  if (nextCode) {
    const codeTaken = await prisma.program.findFirst({
      where: { institutionId, code: nextCode, NOT: { id } },
    });
    if (codeTaken) {
      throw new AppError(
        `A program with code "${code}" already exists`,
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

  return prisma.program.update({
    where: { id },
    data: {
      ...(input.departmentId !== undefined
        ? { departmentId: input.departmentId }
        : {}),
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(nextCode !== undefined ? { code: nextCode } : {}),
      ...(input.level !== undefined ? { level: input.level.trim() } : {}),
      ...(input.durationYears !== undefined
        ? { durationYears: input.durationYears }
        : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    },
  });
}

export async function deactivateProgram(institutionId: string, id: string) {
  await getProgramById(institutionId, id);
  return prisma.program.update({ where: { id }, data: { isActive: false } });
}
