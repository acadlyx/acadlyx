import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";
import { AuthenticatedUser } from "../types/auth";
import { PaginationParams } from "../utils/pagination";
import {
  AdmissionEnrollInput,
  CreateAdmissionInput,
  UpdateAdmissionInput,
} from "../validators/admission.validators";
import { recordAuditLog } from "./audit.service";
import { createStudent } from "./studentAdmin.service";

const TRANSITIONS: Record<string, string[]> = {
  SUBMITTED: ["UNDER_REVIEW", "DOCUMENTS_PENDING", "REJECTED", "WITHDRAWN"],
  UNDER_REVIEW: ["DOCUMENTS_PENDING", "SELECTED", "REJECTED", "WITHDRAWN"],
  DOCUMENTS_PENDING: ["UNDER_REVIEW", "SELECTED", "REJECTED", "WITHDRAWN"],
  SELECTED: ["REJECTED", "WITHDRAWN"],
  REJECTED: [],
  ENROLLED: [],
  WITHDRAWN: [],
};

const include = {
  program: { select: { id: true, name: true, code: true } },
  academicYear: { select: { id: true, name: true } },
} satisfies Prisma.AdmissionApplicationInclude;

async function assertPlacement(
  institutionId: string,
  programId: string,
  academicYearId: string
) {
  const [program, year] = await Promise.all([
    prisma.program.findFirst({
      where: { id: programId, institutionId, isActive: true },
      select: { id: true },
    }),
    prisma.academicYear.findFirst({
      where: { id: academicYearId, institutionId },
      select: { id: true },
    }),
  ]);
  if (!program) throw new AppError("Program not found in this institution", 404);
  if (!year) throw new AppError("Academic year not found in this institution", 404);
}

async function nextApplicationNumber(institutionId: string): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `ADM-${year}-`;
  const count = await prisma.admissionApplication.count({
    where: { institutionId, applicationNumber: { startsWith: prefix } },
  });
  return `${prefix}${String(count + 1).padStart(5, "0")}`;
}

async function load(institutionId: string, id: string) {
  const application = await prisma.admissionApplication.findFirst({
    where: { id, institutionId },
    include,
  });
  if (!application) throw new AppError("Admission application not found", 404);
  return application;
}

export async function listApplications(
  institutionId: string,
  pagination: PaginationParams,
  filters: {
    search?: string;
    status?: string;
    programId?: string;
    academicYearId?: string;
  }
) {
  const where: Prisma.AdmissionApplicationWhereInput = {
    institutionId,
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.programId ? { programId: filters.programId } : {}),
    ...(filters.academicYearId ? { academicYearId: filters.academicYearId } : {}),
    ...(filters.search
      ? {
          OR: [
            { firstName: { contains: filters.search, mode: "insensitive" } },
            { lastName: { contains: filters.search, mode: "insensitive" } },
            { email: { contains: filters.search, mode: "insensitive" } },
            { applicationNumber: { contains: filters.search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [items, total, grouped] = await Promise.all([
    prisma.admissionApplication.findMany({
      where,
      include,
      orderBy: { createdAt: "desc" },
      skip: pagination.skip,
      take: pagination.take,
    }),
    prisma.admissionApplication.count({ where }),
    prisma.admissionApplication.groupBy({
      by: ["status"],
      where: { institutionId },
      _count: { _all: true },
    }),
  ]);

  const summary: Record<string, number> = {};
  for (const row of grouped) summary[row.status] = row._count._all;

  return { items, total, summary };
}

export async function getApplication(institutionId: string, id: string) {
  return load(institutionId, id);
}

export async function createApplication(
  institutionId: string,
  actor: AuthenticatedUser,
  input: CreateAdmissionInput,
  meta: { ipAddress?: string; userAgent?: string }
) {
  await assertPlacement(institutionId, input.programId, input.academicYearId);

  const duplicate = await prisma.admissionApplication.findFirst({
    where: {
      institutionId,
      email: input.email,
      programId: input.programId,
      academicYearId: input.academicYearId,
      status: { notIn: ["REJECTED", "WITHDRAWN"] },
    },
    select: { applicationNumber: true },
  });
  if (duplicate) {
    throw new AppError(
      `An active application (${duplicate.applicationNumber}) already exists for this applicant`,
      409
    );
  }

  // Retry on the (institutionId, applicationNumber) unique constraint so two
  // concurrent submissions can never share a number.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const application = await prisma.admissionApplication.create({
        data: {
          institutionId,
          applicationNumber: await nextApplicationNumber(institutionId),
          firstName: input.firstName,
          lastName: input.lastName,
          email: input.email,
          phone: input.phone,
          dateOfBirth: input.dateOfBirth,
          gender: input.gender,
          guardianName: input.guardianName,
          guardianPhone: input.guardianPhone,
          previousInstitution: input.previousInstitution,
          previousPercentage: input.previousPercentage,
          remarks: input.remarks,
          programId: input.programId,
          academicYearId: input.academicYearId,
        },
        include,
      });
      await recordAuditLog({
        institutionId,
        userId: actor.id,
        action: "admission.create",
        entityType: "AdmissionApplication",
        entityId: application.id,
        metadata: { applicationNumber: application.applicationNumber },
        ...meta,
      });
      return application;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002" &&
        attempt < 4
      ) {
        continue;
      }
      throw error;
    }
  }
  throw new AppError("Could not allocate an application number", 503);
}

export async function updateApplication(
  institutionId: string,
  actor: AuthenticatedUser,
  id: string,
  input: UpdateAdmissionInput,
  meta: { ipAddress?: string; userAgent?: string }
) {
  const existing = await load(institutionId, id);
  if (["ENROLLED", "REJECTED", "WITHDRAWN"].includes(existing.status)) {
    throw new AppError(`A ${existing.status.toLowerCase()} application can no longer be edited`, 409);
  }

  await assertPlacement(
    institutionId,
    input.programId ?? existing.programId,
    input.academicYearId ?? existing.academicYearId
  );

  const application = await prisma.admissionApplication.update({
    where: { id },
    data: {
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email,
      phone: input.phone,
      dateOfBirth: input.dateOfBirth,
      gender: input.gender,
      guardianName: input.guardianName,
      guardianPhone: input.guardianPhone,
      previousInstitution: input.previousInstitution,
      previousPercentage: input.previousPercentage,
      remarks: input.remarks,
      programId: input.programId,
      academicYearId: input.academicYearId,
    },
    include,
  });

  await recordAuditLog({
    institutionId,
    userId: actor.id,
    action: "admission.update",
    entityType: "AdmissionApplication",
    entityId: id,
    ...meta,
  });
  return application;
}

export async function changeStatus(
  institutionId: string,
  actor: AuthenticatedUser,
  id: string,
  status: string,
  remarks: string | undefined,
  meta: { ipAddress?: string; userAgent?: string }
) {
  const existing = await load(institutionId, id);
  if (!(TRANSITIONS[existing.status] ?? []).includes(status)) {
    throw new AppError(
      `An application cannot move from ${existing.status} to ${status}`,
      409
    );
  }

  const application = await prisma.admissionApplication.update({
    where: { id },
    data: {
      status,
      remarks: remarks ?? existing.remarks,
      reviewedById: actor.id,
      reviewedAt: new Date(),
    },
    include,
  });

  await recordAuditLog({
    institutionId,
    userId: actor.id,
    action: "admission.status",
    entityType: "AdmissionApplication",
    entityId: id,
    metadata: { from: existing.status, to: status },
    ...meta,
  });
  return application;
}

/** Converts a SELECTED applicant into a real student account + enrollment. */
export async function enrollApplicant(
  institutionId: string,
  actor: AuthenticatedUser,
  id: string,
  input: AdmissionEnrollInput,
  meta: { ipAddress?: string; userAgent?: string }
) {
  const application = await load(institutionId, id);
  if (application.status !== "SELECTED") {
    throw new AppError("Only SELECTED applicants can be enrolled", 409);
  }

  const student = await createStudent(
    institutionId,
    {
      email: application.email,
      firstName: application.firstName,
      lastName: application.lastName,
      phone: application.phone ?? undefined,
      password: input.password,
      admissionNumber: input.admissionNumber,
      dateOfBirth: application.dateOfBirth
        ? application.dateOfBirth.toISOString().slice(0, 10)
        : undefined,
      gender: application.gender ?? undefined,
      guardianName: application.guardianName ?? undefined,
      guardianPhone: application.guardianPhone ?? undefined,
      admissionDate: new Date().toISOString().slice(0, 10),
      status: "ACTIVE",
      programId: application.programId,
      academicYearId: application.academicYearId,
      semesterId: input.semesterId,
      sectionId: input.sectionId,
      rollNumber: input.rollNumber,
    },
    actor
  );

  const userId: string =
    (student as { id?: string; user?: { id: string } }).id ??
    (student as { user?: { id: string } }).user?.id ??
    "";
  if (!userId) throw new AppError("Student account could not be resolved", 500);

  const updated = await prisma.admissionApplication.update({
    where: { id },
    data: {
      status: "ENROLLED",
      enrolledUserId: userId,
      reviewedById: actor.id,
      reviewedAt: new Date(),
    },
    include,
  });

  await recordAuditLog({
    institutionId,
    userId: actor.id,
    action: "admission.enroll",
    entityType: "AdmissionApplication",
    entityId: id,
    metadata: { studentUserId: userId },
    ...meta,
  });
  return updated;
}
