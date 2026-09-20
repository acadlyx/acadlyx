import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";
import { AuthenticatedUser } from "../types/auth";
import { PaginationParams } from "../utils/pagination";
import { recordAuditLog } from "./audit.service";
import { assertCanViewStudent } from "./accessScope.service";
import {
  BulkPromotionInput,
  CreateMovementInput,
} from "../validators/movement.validators";

type Meta = { ipAddress?: string; userAgent?: string };

const studentSelect = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
} satisfies Prisma.UserSelect;

/** Movement rows reference enrollments by id only, so list responses
 *  resolve the surrounding academic context in one extra pass. */
async function decorate(
  institutionId: string,
  rows: Array<{
    fromEnrollmentId: string;
    targetProgramId: string | null;
    targetAcademicYearId: string | null;
    targetSemesterId: string | null;
    targetSectionId: string | null;
    [key: string]: unknown;
  }>
) {
  const enrollmentIds = rows.map((row) => row.fromEnrollmentId);
  const programIds = rows.map((r) => r.targetProgramId).filter(Boolean) as string[];
  const yearIds = rows.map((r) => r.targetAcademicYearId).filter(Boolean) as string[];
  const sectionIds = rows.map((r) => r.targetSectionId).filter(Boolean) as string[];

  const [enrollments, programs, years, sections] = await Promise.all([
    prisma.studentEnrollment.findMany({
      where: { institutionId, id: { in: enrollmentIds } },
      select: {
        id: true,
        status: true,
        rollNumber: true,
        program: { select: { id: true, name: true } },
        academicYear: { select: { id: true, name: true } },
        semester: { select: { id: true, name: true } },
        section: { select: { id: true, name: true } },
      },
    }),
    programIds.length
      ? prisma.program.findMany({
          where: { institutionId, id: { in: programIds } },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
    yearIds.length
      ? prisma.academicYear.findMany({
          where: { institutionId, id: { in: yearIds } },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
    sectionIds.length
      ? prisma.section.findMany({
          where: { institutionId, id: { in: sectionIds } },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
  ]);

  const byId = <T extends { id: string }>(list: T[]) =>
    new Map(list.map((item) => [item.id, item]));
  const enrollmentMap = byId(enrollments);
  const programMap = byId(programs);
  const yearMap = byId(years);
  const sectionMap = byId(sections);

  return rows.map((row) => ({
    ...row,
    fromEnrollment: enrollmentMap.get(row.fromEnrollmentId) ?? null,
    targetProgram: row.targetProgramId
      ? programMap.get(row.targetProgramId) ?? null
      : null,
    targetAcademicYear: row.targetAcademicYearId
      ? yearMap.get(row.targetAcademicYearId) ?? null
      : null,
    targetSection: row.targetSectionId
      ? sectionMap.get(row.targetSectionId) ?? null
      : null,
  }));
}

async function currentEnrollment(institutionId: string, studentId: string) {
  const enrollment = await prisma.studentEnrollment.findFirst({
    where: { institutionId, userId: studentId, status: "ACTIVE" },
    orderBy: { enrolledAt: "desc" },
  });
  if (!enrollment) {
    throw new AppError("Student has no active enrollment to move", 422);
  }
  return enrollment;
}

async function assertTargetsInInstitution(
  institutionId: string,
  input: {
    targetProgramId?: string;
    targetAcademicYearId?: string;
    targetSemesterId?: string;
    targetSectionId?: string;
  }
) {
  const checks: Array<Promise<unknown>> = [];
  if (input.targetProgramId) {
    checks.push(
      prisma.program
        .findFirst({
          where: { id: input.targetProgramId, institutionId },
          select: { id: true },
        })
        .then((row) => {
          if (!row) throw new AppError("Target program not found", 404);
        })
    );
  }
  if (input.targetAcademicYearId) {
    checks.push(
      prisma.academicYear
        .findFirst({
          where: { id: input.targetAcademicYearId, institutionId },
          select: { id: true },
        })
        .then((row) => {
          if (!row) throw new AppError("Target academic year not found", 404);
        })
    );
  }
  if (input.targetSemesterId) {
    checks.push(
      prisma.semester
        .findFirst({
          where: { id: input.targetSemesterId, institutionId },
          select: { id: true },
        })
        .then((row) => {
          if (!row) throw new AppError("Target semester not found", 404);
        })
    );
  }
  if (input.targetSectionId) {
    checks.push(
      prisma.section
        .findFirst({
          where: { id: input.targetSectionId, institutionId },
          select: { id: true, capacity: true, semesterId: true },
        })
        .then(async (section) => {
          if (!section) throw new AppError("Target section not found", 404);
          if (section.capacity !== null) {
            const seated = await prisma.studentEnrollment.count({
              where: {
                institutionId,
                sectionId: section.id,
                status: "ACTIVE",
              },
            });
            if (seated >= section.capacity) {
              throw new AppError("Target section is full", 409);
            }
          }
        })
    );
  }
  await Promise.all(checks);
}

export async function createRequest(
  institutionId: string,
  actor: AuthenticatedUser,
  input: CreateMovementInput,
  meta: Meta
) {
  await assertCanViewStudent(institutionId, actor, input.studentId);
  const enrollment = await currentEnrollment(institutionId, input.studentId);
  await assertTargetsInInstitution(institutionId, input);

  const duplicate = await prisma.studentMovementRequest.findFirst({
    where: {
      institutionId,
      studentId: input.studentId,
      status: "PENDING",
    },
    select: { id: true },
  });
  if (duplicate) {
    throw new AppError(
      "This student already has a pending movement request",
      409
    );
  }

  if (
    input.requestType === "SECTION_TRANSFER" &&
    input.targetSectionId === enrollment.sectionId
  ) {
    throw new AppError("The student is already in that section", 422);
  }
  if (
    input.requestType === "PROMOTION" &&
    input.targetAcademicYearId === enrollment.academicYearId
  ) {
    throw new AppError("The student is already in that academic year", 422);
  }

  const request = await prisma.studentMovementRequest.create({
    data: {
      institutionId,
      studentId: input.studentId,
      requestType: input.requestType,
      fromEnrollmentId: enrollment.id,
      targetProgramId: input.targetProgramId ?? null,
      targetAcademicYearId: input.targetAcademicYearId ?? null,
      targetSemesterId: input.targetSemesterId ?? null,
      targetSectionId: input.targetSectionId ?? null,
      reason: input.reason ?? null,
      requestedById: actor.id,
      status: "PENDING",
    },
  });

  await recordAuditLog({
    institutionId,
    userId: actor.id,
    action: "movement.request",
    entityType: "StudentMovementRequest",
    entityId: request.id,
    metadata: {
      studentId: input.studentId,
      requestType: input.requestType,
    },
    ...meta,
  });

  return request;
}

/**
 * Applies an approved movement.
 *
 * PROMOTION and PROGRAM_TRANSFER close the old enrollment and open a new
 * one so academic history is preserved; SECTION_TRANSFER edits the
 * existing row because the year and program are unchanged.
 */
async function applyMovement(
  tx: Prisma.TransactionClient,
  institutionId: string,
  request: {
    id: string;
    studentId: string;
    requestType: string;
    fromEnrollmentId: string;
    targetProgramId: string | null;
    targetAcademicYearId: string | null;
    targetSemesterId: string | null;
    targetSectionId: string | null;
  }
): Promise<string> {
  const from = await tx.studentEnrollment.findFirst({
    where: { id: request.fromEnrollmentId, institutionId },
  });
  if (!from) throw new AppError("Source enrollment no longer exists", 409);

  if (request.requestType === "SECTION_TRANSFER") {
    const updated = await tx.studentEnrollment.update({
      where: { id: from.id },
      data: {
        sectionId: request.targetSectionId,
        semesterId: request.targetSemesterId ?? from.semesterId,
      },
    });
    return updated.id;
  }

  const academicYearId = request.targetAcademicYearId ?? from.academicYearId;
  const programId = request.targetProgramId ?? from.programId;

  const clash = await tx.studentEnrollment.findFirst({
    where: { userId: request.studentId, academicYearId },
    select: { id: true },
  });
  if (clash && clash.id !== from.id) {
    throw new AppError(
      "The student already has an enrollment in the target academic year",
      409
    );
  }

  await tx.studentEnrollment.update({
    where: { id: from.id },
    data: {
      status: request.requestType === "PROMOTION" ? "COMPLETED" : "TRANSFERRED",
    },
  });

  const created = await tx.studentEnrollment.create({
    data: {
      institutionId,
      userId: request.studentId,
      programId,
      academicYearId,
      semesterId: request.targetSemesterId ?? null,
      sectionId: request.targetSectionId ?? null,
      rollNumber: from.rollNumber,
      status: "ACTIVE",
    },
  });
  return created.id;
}

export async function decide(
  institutionId: string,
  actor: AuthenticatedUser,
  id: string,
  decision: "APPROVED" | "REJECTED",
  note: string | undefined,
  meta: Meta
) {
  const existing = await prisma.studentMovementRequest.findFirst({
    where: { id, institutionId },
  });
  if (!existing) throw new AppError("Movement request not found", 404);
  if (existing.status !== "PENDING") {
    throw new AppError("This request has already been decided", 422);
  }
  if (existing.requestedById === actor.id && decision === "APPROVED") {
    /* Separation of duties: the raiser of a request cannot also approve
       it unless they hold institution-wide authority. */
    const institutionWide =
      actor.roles.includes("INSTITUTION_ADMIN") ||
      actor.roles.includes("DIRECTOR") ||
      actor.roles.includes("SUPER_ADMIN");
    if (!institutionWide) {
      throw new AppError("You cannot approve a request you raised", 403);
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    let appliedEnrollmentId: string | null = null;
    if (decision === "APPROVED") {
      appliedEnrollmentId = await applyMovement(tx, institutionId, existing);
    }
    return tx.studentMovementRequest.update({
      where: { id },
      data: {
        status: decision,
        decidedById: actor.id,
        decidedAt: new Date(),
        decisionNote: note ?? null,
        appliedEnrollmentId,
      },
    });
  });

  await recordAuditLog({
    institutionId,
    userId: actor.id,
    action: `movement.${decision.toLowerCase()}`,
    entityType: "StudentMovementRequest",
    entityId: id,
    metadata: {
      studentId: existing.studentId,
      requestType: existing.requestType,
      appliedEnrollmentId: updated.appliedEnrollmentId,
    },
    ...meta,
  });

  return updated;
}

export async function listRequests(
  institutionId: string,
  pagination: PaginationParams,
  filters: {
    status?: string;
    requestType?: string;
    studentId?: string;
    search?: string;
  }
) {
  const where: Prisma.StudentMovementRequestWhereInput = {
    institutionId,
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.requestType ? { requestType: filters.requestType } : {}),
    ...(filters.studentId ? { studentId: filters.studentId } : {}),
    ...(filters.search
      ? {
          student: {
            OR: [
              { firstName: { contains: filters.search, mode: "insensitive" } },
              { lastName: { contains: filters.search, mode: "insensitive" } },
              { email: { contains: filters.search, mode: "insensitive" } },
            ],
          },
        }
      : {}),
  };

  const [rows, total, grouped] = await Promise.all([
    prisma.studentMovementRequest.findMany({
      where,
      include: { student: { select: studentSelect } },
      orderBy: { createdAt: "desc" },
      skip: pagination.skip,
      take: pagination.take,
    }),
    prisma.studentMovementRequest.count({ where }),
    prisma.studentMovementRequest.groupBy({
      by: ["status"],
      where: { institutionId },
      _count: { _all: true },
    }),
  ]);

  return {
    items: await decorate(institutionId, rows),
    total,
    summary: Object.fromEntries(
      grouped.map((row) => [row.status, row._count._all])
    ) as Record<string, number>,
  };
}

export async function getStudentHistory(
  institutionId: string,
  actor: AuthenticatedUser,
  studentId: string
) {
  await assertCanViewStudent(institutionId, actor, studentId);

  const [enrollments, requests] = await Promise.all([
    prisma.studentEnrollment.findMany({
      where: { institutionId, userId: studentId },
      orderBy: { enrolledAt: "desc" },
      include: {
        program: { select: { id: true, name: true } },
        academicYear: { select: { id: true, name: true } },
        semester: { select: { id: true, name: true } },
        section: { select: { id: true, name: true } },
      },
    }),
    prisma.studentMovementRequest.findMany({
      where: { institutionId, studentId },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return {
    enrollments,
    requests: await decorate(institutionId, requests),
  };
}

/**
 * Bulk promotion raises one request per student. Failures are reported
 * per student rather than aborting the whole batch, so a single
 * ineligible student never blocks a cohort roll-over.
 */
export async function bulkPromote(
  institutionId: string,
  actor: AuthenticatedUser,
  input: BulkPromotionInput,
  meta: Meta
) {
  const results: Array<{ studentId: string; ok: boolean; message?: string; id?: string }> =
    [];

  for (const studentId of input.studentIds) {
    try {
      const request = await createRequest(
        institutionId,
        actor,
        {
          studentId,
          requestType: "PROMOTION",
          targetAcademicYearId: input.targetAcademicYearId,
          targetSemesterId: input.targetSemesterId,
          targetSectionId: input.targetSectionId,
          reason: input.reason,
        } as CreateMovementInput,
        meta
      );
      results.push({ studentId, ok: true, id: request.id });
    } catch (err) {
      results.push({
        studentId,
        ok: false,
        message: err instanceof Error ? err.message : "Failed",
      });
    }
  }

  await recordAuditLog({
    institutionId,
    userId: actor.id,
    action: "movement.bulk-promote",
    entityType: "StudentMovementRequest",
    metadata: {
      requested: input.studentIds.length,
      created: results.filter((row) => row.ok).length,
    },
    ...meta,
  });

  return {
    created: results.filter((row) => row.ok).length,
    failed: results.filter((row) => !row.ok).length,
    results,
  };
}

/** Students eligible for promotion: active enrollments in a given year. */
export async function listPromotionCandidates(
  institutionId: string,
  filters: { academicYearId?: string; programId?: string; sectionId?: string }
) {
  return prisma.studentEnrollment.findMany({
    where: {
      institutionId,
      status: "ACTIVE",
      ...(filters.academicYearId
        ? { academicYearId: filters.academicYearId }
        : {}),
      ...(filters.programId ? { programId: filters.programId } : {}),
      ...(filters.sectionId ? { sectionId: filters.sectionId } : {}),
    },
    include: {
      user: { select: studentSelect },
      program: { select: { id: true, name: true } },
      academicYear: { select: { id: true, name: true } },
      section: { select: { id: true, name: true } },
    },
    orderBy: { rollNumber: "asc" },
    take: 500,
  });
}
