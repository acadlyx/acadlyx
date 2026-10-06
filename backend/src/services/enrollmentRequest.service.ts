import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";
import { AuthenticatedUser } from "../types/auth";
import { recordAuditLog } from "./audit.service";
import { getManagedDepartmentIds } from "./accessScope.service";
import { validateAcademicPlacement } from "./studentAdmin.service";

const REQUEST_STATUSES = ["PENDING", "APPROVED", "REJECTED", "NEEDS_CORRECTION", "CANCELLED"] as const;

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
      where: { institutionId, studentId: actor.id, status: { in: ["PENDING", "NEEDS_CORRECTION"] } },
      include: requestInclude,
      orderBy: { createdAt: "desc" },
    }),
  ]);

  if (current) return { state: "APPROVED", enrollment: current, request: null, eligibleContexts: [] };

  const eligibleContexts = await listEligibleContexts(institutionId, actor.id);
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
    where: { institutionId, programId, academicYearId: yearId, isActive: true },
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

  const eligible = await listEligibleContexts(institutionId, actor.id);
  const match = eligible.find((x) =>
    x.program.id === input.programId &&
    x.academicYear.id === input.academicYearId &&
    x.semester.id === input.semesterId &&
    (!input.sectionId || x.sections.some((s) => s.id === input.sectionId))
  );
  if (!match) throw new AppError("The selected academic context is not eligible for this student", 403);

  await validateRequestContext(institutionId, input);

  const request = await prisma.studentEnrollmentRequest.upsert({
    where: { studentId_academicYearId: { studentId: actor.id, academicYearId: input.academicYearId } },
    create: {
      institutionId, studentId: actor.id, requestedById: actor.id,
      programId: input.programId, academicYearId: input.academicYearId, semesterId: input.semesterId,
      sectionId: input.sectionId ?? null, status: "PENDING",
    },
    update: {
      programId: input.programId, semesterId: input.semesterId, sectionId: input.sectionId ?? null,
      requestedById: actor.id, status: "PENDING", decidedById: null, decidedAt: null,
      rejectionReason: null, correctionNote: null,
    },
    include: requestInclude,
  });

  const managed = await prisma.employeeProfile.findMany({
    where: {
      institutionId, departmentId: match.program.departmentId, status: "ACTIVE",
      user: { userRoles: { some: { role: { name: "HOD", institutionId } } } },
    },
    select: { userId: true },
  });
  await Promise.all(managed.map((hod) =>
    notify(institutionId, hod.userId, "New enrollment request", `${actor.roles.includes("STUDENT") ? "A student" : "A user"} submitted an academic enrollment request.`, "/hod/enrollment-requests")
  ));

  await recordAuditLog({
    institutionId, userId: actor.id, action: "enrollment.request.submit",
    entityType: "StudentEnrollmentRequest", entityId: request.id,
    metadata: { programId: input.programId, academicYearId: input.academicYearId, semesterId: input.semesterId, sectionId: input.sectionId ?? null },
  });
  return request;
}

export async function listEnrollmentRequests(
  institutionId: string,
  actor: AuthenticatedUser,
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
    prisma.studentEnrollmentRequest.findMany({ where, include: requestInclude, orderBy: { createdAt: "desc" }, take: 100 }),
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
  if (existing.status !== "PENDING") throw new AppError("Only pending enrollment requests can be decided", 422);
  if (actor.roles.includes("STUDENT") || !actor.permissions.includes("enrollment.approve")) throw new AppError("You are not authorized to decide enrollment requests", 403);

  await validateRequestContext(institutionId, existing);
  const managed = actor.roles.includes("HOD") ? await getManagedDepartmentIds(institutionId, actor.id) : null;
  if (managed && !managed.includes(existing.program.departmentId)) throw new AppError("This enrollment request is outside your department scope", 403);

  if (decision === "APPROVED") {
    const result = await prisma.$transaction(async (tx) => {
      const fresh = await tx.studentEnrollmentRequest.findFirst({ where: { id, institutionId }, include: requestInclude });
      if (!fresh || fresh.status !== "PENDING") throw new AppError("Enrollment request is no longer pending", 409);
      const existingEnrollment = await tx.studentEnrollment.findUnique({ where: { userId_academicYearId: { userId: fresh.studentId, academicYearId: fresh.academicYearId } } });
      if (existingEnrollment?.status === "ACTIVE") throw new AppError("Student already has an active enrollment for this academic year", 409);
      const activeCurrent = await tx.studentEnrollment.findFirst({ where: { institutionId, userId: fresh.studentId, status: "ACTIVE", academicYear: { isCurrent: true } } });
      if (activeCurrent) throw new AppError("Student already has an active current-year enrollment", 409);
      const enrollment = await tx.studentEnrollment.upsert({
        where: { userId_academicYearId: { userId: fresh.studentId, academicYearId: fresh.academicYearId } },
        create: {
          institutionId, userId: fresh.studentId, programId: fresh.programId, academicYearId: fresh.academicYearId,
          semesterId: fresh.semesterId, sectionId: fresh.sectionId, status: "ACTIVE",
        },
        update: {
          programId: fresh.programId, semesterId: fresh.semesterId, sectionId: fresh.sectionId, status: "ACTIVE",
        },
      });
      const updated = await tx.studentEnrollmentRequest.update({
        where: { id },
        data: { status: "APPROVED", decidedById: actor.id, decidedAt: new Date(), rejectionReason: null, correctionNote: null },
        include: requestInclude,
      });
      return { updated, enrollment };
    });
    await notify(institutionId, existing.studentId, "Enrollment approved", "Your academic enrollment has been approved.", "/student/enrollment");
    await recordAuditLog({ institutionId, userId: actor.id, action: "enrollment.request.approve", entityType: "StudentEnrollmentRequest", entityId: id, metadata: { previousState: "PENDING", newState: "APPROVED", studentId: existing.studentId } });
    return result;
  }

  const status = decision === "REJECTED" ? "REJECTED" : "NEEDS_CORRECTION";
  const updated = await prisma.studentEnrollmentRequest.update({
    where: { id },
    data: {
      status, decidedById: actor.id, decidedAt: new Date(),
      rejectionReason: decision === "REJECTED" ? (reason || "Enrollment request rejected") : null,
      correctionNote: decision === "NEEDS_CORRECTION" ? (reason || "Please correct the enrollment request") : null,
    },
    include: requestInclude,
  });
  await notify(institutionId, existing.studentId, decision === "REJECTED" ? "Enrollment rejected" : "Enrollment needs correction",
    decision === "REJECTED" ? (reason || "Your enrollment request was rejected.") : (reason || "Please correct your enrollment request."),
    "/student/enrollment");
  await recordAuditLog({ institutionId, userId: actor.id, action: `enrollment.request.${decision.toLowerCase()}`, entityType: "StudentEnrollmentRequest", entityId: id, metadata: { previousState: "PENDING", newState: status, studentId: existing.studentId, reason: reason ?? null } });
  return updated;
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
  const results: { id: string; status: "APPROVED" | "SKIPPED" | "FAILED"; reason?: string }[] = [];
  for (const id of unique) {
    try {
      const updated = await decideOne(institutionId, actor, id, decision, reason);
      results.push({ id, status: "APPROVED" });
      void updated;
    } catch (error) {
      results.push({ id, status: "SKIPPED", reason: error instanceof Error ? error.message : "Unable to process request" });
    }
  }
  return {
    requested: unique.length,
    processed: results.filter((r) => r.status === "APPROVED").length,
    skipped: results.filter((r) => r.status === "SKIPPED").length,
    results,
  };
}
