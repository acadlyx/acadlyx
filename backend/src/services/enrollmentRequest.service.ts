import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";
import { AuthenticatedUser } from "../types/auth";
import { recordAuditLog } from "./audit.service";
import { getManagedDepartmentIds } from "./accessScope.service";
import { PaginationParams } from "../utils/pagination";
import { validateAcademicPlacement } from "./studentAdmin.service";


const requestInclude = {
  student: {
    select: {
      id: true, firstName: true, lastName: true, email: true,
      profile: { select: { admissionNumber: true, status: true } },
    },
  },
  program: {
    select: {
      id: true, name: true, code: true, departmentId: true,
      department: { select: { id: true, name: true, code: true, campusId: true } },
    },
  },
  academicYear: { select: { id: true, name: true, isCurrent: true } },
  semester: { select: { id: true, name: true, number: true, programId: true, academicYearId: true } },
  section: { select: { id: true, name: true, capacity: true } },
  decidedBy: { select: { id: true, firstName: true, lastName: true } },
} as const;

async function assertStudent(institutionId: string, studentId: string) {
  const student = await prisma.user.findFirst({
    where: {
      id: studentId, institutionId, isActive: true,
      userRoles: { some: { role: { name: "STUDENT", institutionId } } },
    },
    select: { id: true, firstName: true, lastName: true, profile: { select: { status: true } } },
  });
  if (!student) throw new AppError("Student not found in this institution", 404);
  if (!student.profile) throw new AppError("Complete the student master profile before requesting enrollment", 409);
  if (!["ACTIVE"].includes(student.profile.status)) {
    throw new AppError("This student profile is not eligible for academic enrollment", 422);
  }
  return student;
}

async function getCurrentEnrollment(institutionId: string, studentId: string) {
  return prisma.studentEnrollment.findFirst({
    where: {
      institutionId, userId: studentId, status: "ACTIVE",
      academicYear: { isCurrent: true },
    },
    include: {
      program: { select: { id: true, name: true, code: true, departmentId: true, department: { select: { id: true, name: true, code: true } } } },
      academicYear: { select: { id: true, name: true, isCurrent: true } },
      semester: { select: { id: true, name: true, number: true } },
      section: { select: { id: true, name: true } },
    },
  });
}

export async function getMyEnrollmentWorkflow(institutionId: string, actor: AuthenticatedUser) {
  const student = await assertStudent(institutionId, actor.id);
  const [current, pending] = await Promise.all([
    getCurrentEnrollment(institutionId, actor.id),
    prisma.studentEnrollmentRequest.findFirst({
      where: {
        institutionId,
        studentId: actor.id,
        academicYear: { isCurrent: true },
      },
      include: requestInclude,
      orderBy: { createdAt: "desc" },
    }),
  ]);

  if (current) return { state: "APPROVED", enrollment: current, request: null, eligibleContexts: [] };

  const eligibleContexts = !pending || pending.status === "NEEDS_CORRECTION"
    ? await listEligibleContexts(institutionId, actor.id)
    : [];
  return {
    state: pending?.status ?? "NOT_STARTED",
    enrollment: null,
    request: pending,
    eligibleContexts,
    student,
  };
}

export async function listEligibleContexts(institutionId: string, studentId: string) {
  await assertStudent(institutionId, studentId);
  const current = await getCurrentEnrollment(institutionId, studentId);
  if (current) return [];

  const currentYear = await prisma.academicYear.findFirst({
    where: { institutionId, isCurrent: true },
    select: { id: true, name: true },
  });
  if (!currentYear) return [];

  const existingRequest = await prisma.studentEnrollmentRequest.findUnique({
    where: { studentId_academicYearId: { studentId, academicYearId: currentYear.id } },
    select: { status: true },
  });
  if (existingRequest && existingRequest.status !== "NEEDS_CORRECTION") return [];

  const admission = await prisma.admissionApplication.findFirst({
    where: {
      institutionId,
      enrolledUserId: studentId,
      status: { in: ["SELECTED", "ENROLLED"] },
    },
    orderBy: { updatedAt: "desc" },
    select: {
      programId: true,
      academicYearId: true,
      program: { select: { id: true, name: true, code: true, departmentId: true, department: { select: { id: true, name: true, code: true } } } },
    },
  });

  let programId = admission?.programId ?? null;
  let yearId = currentYear.id;

  if (admission?.academicYearId === currentYear.id) {
    yearId = admission.academicYearId;
  } else if (!programId) {
    const previous = await prisma.studentEnrollment.findFirst({
      where: { institutionId, userId: studentId, status: { in: ["ACTIVE", "COMPLETED"] } },
      orderBy: { enrolledAt: "desc" },
      select: { programId: true, semester: { select: { number: true } } },
    });
    programId = previous?.programId ?? null;
    if (previous?.semester?.number) {
      const next = await prisma.semester.findFirst({
        where: { institutionId, programId: previous.programId, academicYearId: currentYear.id, number: previous.semester.number + 1, isActive: true },
        select: { id: true },
      });
      if (!next) return [];
    }
  }

  if (!programId) return [];

  const semesters = await prisma.semester.findMany({
    where: { institutionId, programId, academicYearId: yearId, isActive: true, program: { isActive: true, department: { isActive: true } } },
    orderBy: { number: "asc" },
    select: {
      id: true, name: true, number: true,
      program: { select: { id: true, name: true, code: true, departmentId: true, department: { select: { id: true, name: true, code: true } } } },
      academicYear: { select: { id: true, name: true } },
      sections: { where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true, capacity: true } },
    },
  });

  return semesters.map((semester) => ({
    program: semester.program,
    academicYear: semester.academicYear,
    semester: { id: semester.id, name: semester.name, number: semester.number },
    sections: semester.sections,
  }));
}

async function notify(institutionId: string, userId: string, title: string, body: string, actionUrl: string) {
  await prisma.notification.create({
    data: { institutionId, userId, title, body, actionUrl, priority: "NORMAL" },
  });
}

async function validateRequestContext(institutionId: string, request: {
  programId: string; academicYearId: string; semesterId: string; sectionId?: string | null;
}) {
  return validateAcademicPlacement(institutionId, {
    programId: request.programId,
    academicYearId: request.academicYearId,
    semesterId: request.semesterId,
    sectionId: request.sectionId ?? undefined,
  });
}

export async function submitEnrollmentRequest(
  institutionId: string,
  actor: AuthenticatedUser,
  input: { programId: string; academicYearId: string; semesterId: string; sectionId?: string }
) {
  if (!actor.roles.includes("STUDENT")) throw new AppError("Only students may submit self-enrollment requests", 403);
  await assertStudent(institutionId, actor.id);

  const current = await getCurrentEnrollment(institutionId, actor.id);
  if (current) throw new AppError("You already have an active enrollment for the current academic year", 409);

  const existing = await prisma.studentEnrollmentRequest.findUnique({
    where: { studentId_academicYearId: { studentId: actor.id, academicYearId: input.academicYearId } },
  });
  if (existing && existing.status !== "NEEDS_CORRECTION") {
    throw new AppError(
      existing.status === "PENDING"
        ? "Your enrollment request is already pending; it cannot be silently edited."
        : `Your enrollment request is already ${existing.status}. Historical decisions cannot be overwritten; contact the academic office.`,
      409
    );
  }

  const eligible = await listEligibleContexts(institutionId, actor.id);
  const match = eligible.find((x) =>
    x.program.id === input.programId &&
    x.academicYear.id === input.academicYearId &&
    x.semester.id === input.semesterId &&
    (!input.sectionId || x.sections.some((s) => s.id === input.sectionId))
  );
  if (!match) throw new AppError("The selected academic context is not eligible for this student", 403);

  await validateRequestContext(institutionId, input);

  const { request, previousState } = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "users" WHERE "id" = ${actor.id} AND "institutionId" = ${institutionId} FOR UPDATE`;
    const latest = await tx.studentEnrollmentRequest.findUnique({
      where: { studentId_academicYearId: { studentId: actor.id, academicYearId: input.academicYearId } },
    });
    if (latest && latest.status !== "NEEDS_CORRECTION") {
      throw new AppError("This enrollment request already has a decision and cannot be overwritten", 409);
    }

    let saved: Prisma.StudentEnrollmentRequestGetPayload<{ include: typeof requestInclude }> | null = null;
    if (latest) {
      const changed = await tx.studentEnrollmentRequest.updateMany({
        where: {
          id: latest.id,
          institutionId,
          studentId: actor.id,
          status: "NEEDS_CORRECTION",
        },
        data: {
          programId: input.programId,
          semesterId: input.semesterId,
          sectionId: input.sectionId ?? null,
          requestedById: actor.id,
          status: "PENDING",
        },
      });
      if (changed.count !== 1) {
        throw new AppError("Enrollment request changed while it was being corrected. Refresh and try again.", 409);
      }
      saved = await tx.studentEnrollmentRequest.findFirst({
        where: { id: latest.id, institutionId },
        include: requestInclude,
      });
    } else {
      try {
        saved = await tx.studentEnrollmentRequest.create({
          data: {
            institutionId,
            studentId: actor.id,
            requestedById: actor.id,
            programId: input.programId,
            academicYearId: input.academicYearId,
            semesterId: input.semesterId,
            sectionId: input.sectionId ?? null,
            status: "PENDING",
          },
          include: requestInclude,
        });
      } catch (error) {
        if ((error as { code?: string })?.code === "P2002") {
          throw new AppError("An enrollment request for this academic year already exists. Refresh to review its status.", 409);
        }
        throw error;
      }
    }
    if (!saved) throw new AppError("Enrollment request could not be loaded after submission", 500);

    await tx.studentEnrollmentRequestHistory.create({
      data: {
        institutionId,
        requestId: saved.id,
        actorId: actor.id,
        action: latest ? "STUDENT_RESUBMITTED_CORRECTION" : "STUDENT_SUBMITTED",
        previousStatus: latest?.status ?? null,
        newStatus: "PENDING",
        reason: latest?.correctionNote ?? null,
        metadata: {
          programId: input.programId,
          academicYearId: input.academicYearId,
          semesterId: input.semesterId,
          sectionId: input.sectionId ?? null,
        },
      },
    });
    return { request: saved, previousState: latest?.status ?? null };
  });

  const managed = await prisma.employeeProfile.findMany({
    where: {
      institutionId,
      departmentId: match.program.departmentId,
      status: "ACTIVE",
      user: { userRoles: { some: { role: { name: "HOD", institutionId } } } },
    },
    select: { userId: true },
  });
  await Promise.all(managed.map((hod) =>
    notify(
      institutionId,
      hod.userId,
      previousState ? "Enrollment request resubmitted" : "New enrollment request",
      previousState
        ? "A student resubmitted an academic enrollment request after correction."
        : "A student submitted an academic enrollment request.",
      "/hod/enrollment-requests"
    )
  ));

  await recordAuditLog({
    institutionId,
    userId: actor.id,
    action: previousState ? "enrollment.request.resubmit" : "enrollment.request.submit",
    entityType: "StudentEnrollmentRequest",
    entityId: request.id,
    metadata: {
      programId: input.programId,
      academicYearId: input.academicYearId,
      semesterId: input.semesterId,
      sectionId: input.sectionId ?? null,
      previousState,
      newState: "PENDING",
    },
  });
  return request;
}

export async function listEnrollmentRequests(
  institutionId: string,
  actor: AuthenticatedUser,
  pagination: PaginationParams,
  filters: { status?: string; programId?: string; academicYearId?: string; semesterId?: string; sectionId?: string; search?: string }
) {
  if (!actor.permissions.includes("enrollment.read")) throw new AppError("You do not have permission to view enrollment requests", 403);
  const managed = actor.roles.includes("HOD") ? await getManagedDepartmentIds(institutionId, actor.id) : null;
  const where: any = {
    institutionId,
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.programId ? { programId: filters.programId } : {}),
    ...(filters.academicYearId ? { academicYearId: filters.academicYearId } : {}),
    ...(filters.semesterId ? { semesterId: filters.semesterId } : {}),
    ...(filters.sectionId ? { sectionId: filters.sectionId } : {}),
    ...(filters.search ? { student: { OR: [
      { firstName: { contains: filters.search, mode: "insensitive" } },
      { lastName: { contains: filters.search, mode: "insensitive" } },
      { email: { contains: filters.search, mode: "insensitive" } },
      { profile: { admissionNumber: { contains: filters.search, mode: "insensitive" } } },
    ] } } : {}),
  };
  if (managed) where.program = { departmentId: { in: managed.length ? managed : ["__none__"] } };

  const [items, total] = await Promise.all([
    prisma.studentEnrollmentRequest.findMany({ where, include: requestInclude, orderBy: { createdAt: "desc" }, skip: pagination.skip, take: pagination.take }),
    prisma.studentEnrollmentRequest.count({ where }),
  ]);
  return { items, total };
}

async function decideOne(
  institutionId: string,
  actor: AuthenticatedUser,
  id: string,
  decision: "APPROVED" | "REJECTED" | "NEEDS_CORRECTION",
  reason?: string,
) {
  const existing = await prisma.studentEnrollmentRequest.findFirst({ where: { id, institutionId }, include: requestInclude });
  if (!existing) throw new AppError("Enrollment request not found", 404);
  if (existing.status !== "PENDING") throw new AppError("Only pending enrollment requests can be decided", 409);
  if (actor.roles.includes("STUDENT") || !actor.permissions.includes("enrollment.approve")) throw new AppError("You are not authorized to decide enrollment requests", 403);

  await validateRequestContext(institutionId, existing);
  const managed = actor.roles.includes("HOD") ? await getManagedDepartmentIds(institutionId, actor.id) : null;
  if (managed && !managed.includes(existing.program.departmentId)) throw new AppError("This enrollment request is outside your department scope", 403);

  const result = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "users" WHERE "id" = ${existing.studentId} AND "institutionId" = ${institutionId} FOR UPDATE`;
    const changed = await tx.studentEnrollmentRequest.updateMany({
      where: { id, institutionId, status: "PENDING" },
      data: {
        status: decision,
        decidedById: actor.id,
        decidedAt: new Date(),
        ...(decision === "REJECTED"
          ? { rejectionReason: reason || "Enrollment request rejected" }
          : {}),
        ...(decision === "NEEDS_CORRECTION"
          ? { correctionNote: reason || "Please correct the enrollment request" }
          : {}),
      },
    });
    if (changed.count !== 1) {
      throw new AppError("This enrollment request has already been decided by another action", 409);
    }

    let enrollmentId: string | null = null;
    if (decision === "APPROVED") {
      const existingEnrollment = await tx.studentEnrollment.findUnique({
        where: {
          userId_academicYearId: {
            userId: existing.studentId,
            academicYearId: existing.academicYearId,
          },
        },
      });
      if (existingEnrollment) {
        throw new AppError(
          "A historical enrollment already exists for this academic year. Use the authorised student movement/reinstatement workflow instead of overwriting it.",
          409
        );
      }
      const activeCurrent = await tx.studentEnrollment.findFirst({
        where: {
          institutionId,
          userId: existing.studentId,
          status: "ACTIVE",
          academicYear: { isCurrent: true },
        },
      });
      if (activeCurrent) throw new AppError("Student already has an active current-year enrollment", 409);

      const enrollment = await tx.studentEnrollment.create({
        data: {
          institutionId,
          userId: existing.studentId,
          programId: existing.programId,
          academicYearId: existing.academicYearId,
          semesterId: existing.semesterId,
          sectionId: existing.sectionId,
          status: "ACTIVE",
        },
      });
      enrollmentId = enrollment.id;
    }

    const updated = await tx.studentEnrollmentRequest.findFirst({
      where: { id, institutionId },
      include: requestInclude,
    });
    if (!updated) throw new AppError("Enrollment request not found after decision", 404);
    await tx.studentEnrollmentRequestHistory.create({
      data: {
        institutionId,
        requestId: id,
        actorId: actor.id,
        action: `STAFF_${decision}`,
        previousStatus: "PENDING",
        newStatus: decision,
        reason: reason ?? null,
        metadata: decision === "APPROVED" ? { enrollmentCreated: Boolean(enrollmentId) } : undefined,
      },
    });
    return { updated, enrollmentId };
  });

  await notify(
    institutionId,
    existing.studentId,
    decision === "APPROVED"
      ? "Enrollment approved"
      : decision === "REJECTED"
        ? "Enrollment rejected"
        : "Enrollment needs correction",
    decision === "APPROVED"
      ? "Your academic enrollment has been approved."
      : decision === "REJECTED"
        ? (reason || "Your enrollment request was rejected.")
        : (reason || "Please correct your enrollment request."),
    "/student/enrollment"
  );
  await recordAuditLog({
    institutionId,
    userId: actor.id,
    action: `enrollment.request.${decision.toLowerCase()}`,
    entityType: "StudentEnrollmentRequest",
    entityId: id,
    metadata: {
      previousState: "PENDING",
      newState: decision,
      studentId: existing.studentId,
      reason: reason ?? null,
      enrollmentId: result.enrollmentId,
    },
  });
  return result.updated;
}

export async function decideEnrollmentRequest(
  institutionId: string, actor: AuthenticatedUser, id: string,
  decision: "APPROVED" | "REJECTED" | "NEEDS_CORRECTION", reason?: string,
) {
  return decideOne(institutionId, actor, id, decision, reason);
}

export async function bulkDecideEnrollmentRequests(
  institutionId: string, actor: AuthenticatedUser,
  ids: string[], decision: "APPROVED" | "REJECTED" | "NEEDS_CORRECTION", reason?: string,
) {
  if (!actor.permissions.includes("enrollment.approve") || actor.roles.includes("STUDENT")) throw new AppError("You are not authorized to approve enrollment requests", 403);
  const unique = [...new Set(ids)];
  const results: { id: string; status: "APPROVED" | "REJECTED" | "NEEDS_CORRECTION" | "SKIPPED"; reason?: string }[] = [];
  for (const id of unique) {
    try {
      await decideOne(institutionId, actor, id, decision, reason);
      results.push({ id, status: decision });
    } catch (error) {
      results.push({ id, status: "SKIPPED", reason: error instanceof Error ? error.message : "Unable to process request" });
    }
  }
  return {
    requested: unique.length,
    processed: results.filter((r) => r.status !== "SKIPPED").length,
    skipped: results.filter((r) => r.status === "SKIPPED").length,
    results,
  };
}
