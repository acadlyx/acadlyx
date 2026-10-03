import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";
import { PaginationParams } from "../utils/pagination";

export interface BatchListFilters extends PaginationParams {
  search?: string;
  programId?: string;
  isActive?: boolean;
}

async function assertProgram(institutionId: string, programId: string, requireActive = false) {
  const program = await prisma.program.findFirst({
    where: { id: programId, institutionId },
    select: { id: true, isActive: true },
  });
  if (!program) throw new AppError("programId does not belong to this institution", 400);
  if (requireActive && !program.isActive) throw new AppError("Cannot use an inactive program", 400);
  return program;
}

export async function listBatches(institutionId: string, filters: BatchListFilters) {
  if (filters.programId) await assertProgram(institutionId, filters.programId);
  const where: Prisma.BatchWhereInput = {
    institutionId,
    ...(filters.programId ? { programId: filters.programId } : {}),
    ...(filters.isActive !== undefined ? { isActive: filters.isActive } : {}),
    ...(filters.search ? {
      OR: [
        { name: { contains: filters.search, mode: "insensitive" } },
        { code: { contains: filters.search, mode: "insensitive" } },
      ],
    } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.batch.findMany({
      where, skip: filters.skip, take: filters.take, orderBy: { admissionYear: "desc" },
      include: { program: { select: { id: true, name: true, code: true, departmentId: true } } },
    }),
    prisma.batch.count({ where }),
  ]);
  return { items, total };
}

export async function getBatch(institutionId: string, id: string) {
  const batch = await prisma.batch.findFirst({
    where: { id, institutionId },
    include: {
      program: { select: { id: true, name: true, code: true, departmentId: true } },
      _count: { select: { studentEnrollments: true } },
    },
  });
  if (!batch) throw new AppError("Batch not found", 404);
  return batch;
}

export async function createBatch(institutionId: string, input: {
  name: string; code: string; programId: string; admissionYear: number; completionYear: number;
}) {
  await assertProgram(institutionId, input.programId, true);
  const name = input.name.trim();
  const code = input.code.trim().toUpperCase();
  if (!name || !code) throw new AppError("Batch name and code are required", 400);
  if (!Number.isInteger(input.admissionYear) || !Number.isInteger(input.completionYear) ||
      input.completionYear <= input.admissionYear) {
    throw new AppError("Batch completionYear must be greater than admissionYear", 400);
  }
  const existing = await prisma.batch.findFirst({ where: { institutionId, code } });
  if (existing) throw new AppError(`A batch with code "${code}" already exists`, 409);
  return prisma.batch.create({ data: { institutionId, programId: input.programId, name, code, admissionYear: input.admissionYear, completionYear: input.completionYear } });
}

export async function updateBatch(institutionId: string, id: string, input: {
  name?: string; code?: string; programId?: string; admissionYear?: number; completionYear?: number; isActive?: boolean;
}) {
  const current = await getBatch(institutionId, id);
  const nextProgram = input.programId ?? current.programId;
  if (input.programId) await assertProgram(institutionId, input.programId, input.isActive !== false);
  const admissionYear = input.admissionYear ?? current.admissionYear;
  const completionYear = input.completionYear ?? current.completionYear;
  if (completionYear <= admissionYear) throw new AppError("Batch completionYear must be greater than admissionYear", 400);
  const code = input.code?.trim().toUpperCase();
  if (code) {
    const taken = await prisma.batch.findFirst({ where: { institutionId, code, NOT: { id } } });
    if (taken) throw new AppError(`A batch with code "${code}" already exists`, 409);
  }
  return prisma.batch.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(code !== undefined ? { code } : {}),
      programId: nextProgram, admissionYear, completionYear,
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    },
  });
}

export async function deactivateBatch(institutionId: string, id: string) {
  const current = await getBatch(institutionId, id);
  const activeEnrollment = await prisma.studentEnrollment.findFirst({
    where: { institutionId, batchId: current.id, status: "ACTIVE" },
    select: { id: true },
  });
  if (activeEnrollment) throw new AppError("Cannot deactivate a batch with active student enrollments", 409);
  return prisma.batch.update({ where: { id: current.id }, data: { isActive: false } });
}
