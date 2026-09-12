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

export async function listPrograms(
  institutionId: string,
  filters: ListFilters
) {
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
  await assertDepartmentInInstitution(institutionId, input.departmentId);

  const existing = await prisma.program.findFirst({
    where: { institutionId, code: input.code },
  });
  if (existing) {
    throw new AppError(
      `A program with code "${input.code}" already exists`,
      409
    );
  }

  return prisma.program.create({
    data: { institutionId, ...input },
  });
}

export async function updateProgram(
  institutionId: string,
  id: string,
  input: UpdateProgramInput
) {
  await getProgramById(institutionId, id);

  if (input.departmentId) {
    await assertDepartmentInInstitution(institutionId, input.departmentId);
  }

  if (input.code) {
    const codeTaken = await prisma.program.findFirst({
      where: { institutionId, code: input.code, NOT: { id } },
    });
    if (codeTaken) {
      throw new AppError(
        `A program with code "${input.code}" already exists`,
        409
      );
    }
  }

  return prisma.program.update({ where: { id }, data: input });
}

export async function deactivateProgram(institutionId: string, id: string) {
  await getProgramById(institutionId, id);
  return prisma.program.update({ where: { id }, data: { isActive: false } });
}
