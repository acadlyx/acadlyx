import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";
import { AuthenticatedUser } from "../types/auth";
import { PaginationParams } from "../utils/pagination";
import { recordAuditLog } from "./audit.service";
import { assertRegistrationApprovalAuthority } from "./workflowAuthority.service";
import {
  getManagedDepartmentIds,
  getDirectorDepartmentIds,
  isInstitutionWide,
  isDirectorScoped,
  getEffectiveWorkspaceRole,
} from "./accessScope.service";
import {
  OfferingCapacityInput,
  RegisterInput,
} from "../validators/registration.validators";
import {
  REGISTRATION_SEAT_RESERVING_STATUSES,
  canStudentCancelRegistration,
  canStudentResubmitRegistration,
  canTransitionRegistrationState,
  isRegistrationAllowed,
  isStudentCancellationAllowed,
  isWithdrawalRequestAllowed,
} from "../utils/registrationPolicy";

type Meta = { ipAddress?: string; userAgent?: string };

/** Credit ceiling per semester. Prevents a student silently
 *  over-registering into an unteachable workload. */
export const MAX_CREDITS_PER_SEMESTER = 30;
export const MIN_CREDITS_PER_SEMESTER = 12;

async function notifyUser(institutionId: string, userId: string, title: string, body: string, actionUrl: string) {
  await prisma.notification.create({ data: { institutionId, userId, title, body, actionUrl, priority: "NORMAL" } });
}

const include = {
  student: {
    select: { id: true, firstName: true, lastName: true, email: true },
  },
  courseOffering: {
    select: {
      id: true,
      capacity: true,
      registrationOpen: true,
      isElective: true,
      course: {
        select: { id: true, code: true, name: true, credits: true, departmentId: true },
      },
      semester: { select: {
        id: true,
        name: true,
        academicYear: { select: {
        id: true,
        name: true,
        startDate: true,
        endDate: true,
        registrationOpensAt: true,
        registrationClosesAt: true,
        addDropDeadline: true,
        withdrawalDeadline: true,
        exceptionalWithdrawalAllowed: true,
        exceptionalWithdrawalStartsAt: true,
        exceptionalWithdrawalEndsAt: true,
      } },
      } },
      section: { select: { id: true, name: true, capacity: true } },
      faculty: { select: { id: true, firstName: true, lastName: true } },
    },
  },
  withdrawalRequests: {
    where: { status: "PENDING" },
    select: { id: true, status: true, reason: true, requestedAt: true },
  },
} satisfies Prisma.CourseRegistrationInclude;

/** Seats actually consumed: an offering's own capacity wins, otherwise
 *  the section capacity, otherwise unlimited. */
function seatLimit(offering: {
  capacity: number | null;
  section: { capacity: number | null };
}): number | null {
  return offering.capacity ?? offering.section.capacity ?? null;
}

async function activeEnrollment(institutionId: string, studentId: string) {
  const enrollment = await prisma.studentEnrollment.findFirst({
    where: {
      institutionId,
      userId: studentId,
      status: "ACTIVE",
      academicYear: { isCurrent: true },
    },
    orderBy: { enrolledAt: "desc" },
    include: {
      program: { select: { id: true, name: true, departmentId: true } },
      academicYear: { select: {
        id: true,
        name: true,
        registrationOpensAt: true,
        registrationClosesAt: true,
        addDropDeadline: true,
        withdrawalDeadline: true,
        exceptionalWithdrawalAllowed: true,
        exceptionalWithdrawalStartsAt: true,
        exceptionalWithdrawalEndsAt: true,
      } },
      semester: { select: { id: true, name: true } },
      section: { select: { id: true, name: true } },
    },
  });
  if (!enrollment) {
    throw new AppError("No active enrollment found for this student", 422);
  }
  return enrollment;
}

async function assertApproverScope(
  institutionId: string,
  actor: AuthenticatedUser,
  departmentId: string
) {
  await assertRegistrationApprovalAuthority(institutionId, actor, departmentId);
}


/* -------------------------------------------------------------- catalogue */

export async function listAvailableOfferings(
  institutionId: string,
  _actor: AuthenticatedUser,
  studentId: string,
  pagination: PaginationParams,
  filters: { semesterId?: string; electivesOnly?: boolean; search?: string }
) {
  const enrollment = await activeEnrollment(institutionId, studentId);
  const semesterId = filters.semesterId ?? enrollment.semesterId ?? undefined;
  if (filters.semesterId && filters.semesterId !== enrollment.semesterId) {
    throw new AppError("You may only register courses for your active enrolled semester", 403);
  }

  const where: Prisma.CourseOfferingWhereInput = {
    institutionId,
    isActive: true,
    ...(semesterId ? { semesterId } : {}),
    ...(enrollment.sectionId ? { sectionId: enrollment.sectionId } : {}),
    course: {
      departmentId: enrollment.program.departmentId,
      ...(filters.search
        ? {
            OR: [
              { name: { contains: filters.search, mode: "insensitive" } },
              { code: { contains: filters.search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    ...(filters.electivesOnly ? { isElective: true } : {}),
  };

  const [offerings, total, existing] = await Promise.all([
    prisma.courseOffering.findMany({
      where,
      select: {
        id: true,
        capacity: true,
        registrationOpen: true,
        isElective: true,
        course: { select: { id: true, code: true, name: true, credits: true } },
        semester: { select: {
          id: true,
          name: true,
          academicYear: { select: {
        id: true,
        name: true,
        registrationOpensAt: true,
        registrationClosesAt: true,
        addDropDeadline: true,
        withdrawalDeadline: true,
        exceptionalWithdrawalAllowed: true,
        exceptionalWithdrawalStartsAt: true,
        exceptionalWithdrawalEndsAt: true,
      } },
        } },
        section: { select: { id: true, name: true, capacity: true } },
        faculty: { select: { id: true, firstName: true, lastName: true } },
        _count: {
          select: {
            registrations: {
              where: { status: { in: [...REGISTRATION_SEAT_RESERVING_STATUSES] } },
            },
          },
        },
      },
      orderBy: { course: { code: "asc" } },
      skip: pagination.skip,
      take: pagination.take,
    }),
    prisma.courseOffering.count({ where }),
    prisma.courseRegistration.findMany({
      where: {
        institutionId,
        studentId,
        ...(enrollment.semesterId ? { courseOffering: { semesterId: enrollment.semesterId } } : {}),
      },
      orderBy: { updatedAt: "desc" },
      select: { status: true, courseOffering: { select: { courseId: true } } },
    }),
  ]);

  // Keep historical decisions visible: dropped/rejected courses must not
  // silently reappear as unattempted offerings in the same semester.
  const held = new Map<string, string>();
  for (const row of existing) {
    if (!held.has(row.courseOffering.courseId)) held.set(row.courseOffering.courseId, row.status);
  }

  return {
    total,
    enrollment,
    items: offerings.map((offering) => {
      const limit = seatLimit(offering);
      const taken = offering._count.registrations;
      return {
        id: offering.id,
        course: offering.course,
        semester: offering.semester,
        section: offering.section,
        faculty: offering.faculty,
        isElective: offering.isElective,
        registrationOpen: isRegistrationAllowed(new Date(), enrollment.academicYear, offering.registrationOpen),
        capacity: limit,
        seatsTaken: taken,
        seatsLeft: limit === null ? null : Math.max(0, limit - taken),
        myStatus: held.get(offering.course.id) ?? null,
      };
    }),
  };
}

export async function getMyRegistrationSummary(
  institutionId: string,
  studentId: string
) {
  const rows = await prisma.courseRegistration.findMany({
    where: { institutionId, studentId },
    include,
    orderBy: { createdAt: "desc" },
  });

  const active = rows.filter((row) =>
    REGISTRATION_SEAT_RESERVING_STATUSES.includes(row.status as "REQUESTED" | "APPROVED")
  );
  const credits = active.reduce(
    (sum, row) => sum + row.courseOffering.course.credits,
    0
  );

  return {
    items: rows,
    registeredCredits: credits,
    minCredits: MIN_CREDITS_PER_SEMESTER,
    maxCredits: MAX_CREDITS_PER_SEMESTER,
    meetsMinimum: credits >= MIN_CREDITS_PER_SEMESTER,
  };
}

/* ------------------------------------------------------------ registration */

export async function register(
  institutionId: string,
  actor: AuthenticatedUser,
  input: RegisterInput,
  meta: Meta
) {
  const studentId = input.studentId ?? actor.id;

  /* Registering someone else is a registrar action, never a student one. */
  const activeRole = getEffectiveWorkspaceRole(actor);
  if (studentId !== actor.id && !actor.permissions.includes("registration.approve")) {
    throw new AppError("You may only register yourself", 403);
  }
  if (studentId === actor.id && activeRole !== "STUDENT") {
    throw new AppError("Only the active Student workspace may submit self-registration", 403);
  }

  const student = await prisma.user.findFirst({
    where: {
      id: studentId,
      institutionId,
      isActive: true,
      userRoles: { some: { role: { name: "STUDENT" } } },
    },
    select: { id: true },
  });
  if (!student) throw new AppError("Student not found in this institution", 404);

  const { registration, previousState } = await prisma.$transaction(async (tx) => {
    // Serialize seat reservations for this offering. All paths that reserve,
    // approve, assign or change capacity use this same row lock.
    await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT "id"
      FROM "course_offerings"
      WHERE "id" = ${input.courseOfferingId}
        AND "institutionId" = ${institutionId}
      FOR UPDATE
    `);
    // Serialize each student's semester credit checks across different offerings.
    await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT "id" FROM "users"
      WHERE "id" = ${studentId}
        AND "institutionId" = ${institutionId}
      FOR UPDATE
    `);

    const enrollment = await tx.studentEnrollment.findFirst({
      where: {
        institutionId,
        userId: studentId,
        status: "ACTIVE",
        academicYear: { isCurrent: true },
      },
      orderBy: { enrolledAt: "desc" },
      select: {
        id: true,
        academicYearId: true,
        semesterId: true,
        sectionId: true,
        program: { select: { departmentId: true } },
      },
    });
    if (!enrollment) throw new AppError("No active current-year enrollment found for this student", 422);

    const offering = await tx.courseOffering.findFirst({
      where: { id: input.courseOfferingId, institutionId, isActive: true },
      select: {
        id: true,
        capacity: true,
        registrationOpen: true,
        semesterId: true,
        course: { select: { id: true, credits: true, code: true, departmentId: true } },
        section: { select: { id: true, capacity: true } },
      },
    });
    if (!offering) throw new AppError("Course offering not found", 404);
    if (studentId !== actor.id) {
      await assertApproverScope(institutionId, actor, offering.course.departmentId);
    }
    const registrationPolicy = await tx.academicYear.findFirst({
      where: { id: enrollment.academicYearId, institutionId, isCurrent: true },
      select: {
        registrationOpensAt: true,
        registrationClosesAt: true,
        addDropDeadline: true,
        withdrawalDeadline: true,
        exceptionalWithdrawalAllowed: true,
        exceptionalWithdrawalStartsAt: true,
        exceptionalWithdrawalEndsAt: true,
      },
    });
    if (!registrationPolicy) {
      throw new AppError("The student's academic year is no longer current", 409);
    }
    const actionTime = new Date();
    if (!isRegistrationAllowed(actionTime, registrationPolicy, offering.registrationOpen)) {
      throw new AppError("Registration is outside the institution's configured registration window or the offering is manually closed", 409);
    }

    if (!enrollment.semesterId || offering.semesterId !== enrollment.semesterId) {
      throw new AppError("This offering belongs to a different semester than your enrollment", 422);
    }
    if (offering.section?.id !== enrollment.sectionId) {
      throw new AppError("This offering belongs to a different section than your enrollment", 422);
    }
    if (offering.course.departmentId !== enrollment.program.departmentId) {
      throw new AppError("This course is outside your enrolled department", 403);
    }

    const existing = await tx.courseRegistration.findUnique({
      where: {
        studentId_courseOfferingId: {
          studentId,
          courseOfferingId: offering.id,
        },
      },
    });

    if (existing && (!canStudentResubmitRegistration(existing.status) || !canTransitionRegistrationState(existing.status, "REQUESTED"))) {
      if (["REQUESTED", "APPROVED"].includes(existing.status)) {
        throw new AppError("Already registered for this course offering", 409);
      }
      throw new AppError(
        "This course has a previous registration decision. Contact the authorised academic office for a permitted reopening; the historical record cannot be reused.",
        409
      );
    }

    // A course can be attempted only once per semester, even if its previous
    // offering-specific record was rejected or dropped.
    const sameCourse = await tx.courseRegistration.findFirst({
      where: {
        institutionId,
        studentId,
        ...(existing ? { id: { not: existing.id } } : {}),
        courseOffering: {
          courseId: offering.course.id,
          semesterId: offering.semesterId,
        },
      },
      select: { id: true },
    });
    if (sameCourse) {
      throw new AppError(`A previous registration already exists for ${offering.course.code} this semester`, 409);
    }

    const active = await tx.courseRegistration.findMany({
      where: {
        institutionId,
        studentId,
        status: { in: [...REGISTRATION_SEAT_RESERVING_STATUSES] },
        courseOffering: { semesterId: offering.semesterId },
      },
      select: { courseOffering: { select: { course: { select: { credits: true } } } } },
    });
    const currentCredits = active.reduce(
      (sum, row) => sum + row.courseOffering.course.credits,
      0
    );
    if (currentCredits + offering.course.credits > MAX_CREDITS_PER_SEMESTER) {
      throw new AppError(
        `Credit limit exceeded: ${currentCredits} registered, limit is ${MAX_CREDITS_PER_SEMESTER}`,
        422
      );
    }

    const limit = seatLimit(offering);
    if (limit !== null) {
      const reserved = await tx.courseRegistration.count({
        where: {
          courseOfferingId: offering.id,
          status: { in: [...REGISTRATION_SEAT_RESERVING_STATUSES] },
        },
      });
      if (reserved >= limit) throw new AppError("This course offering is full", 409);
    }

    const saved = existing
      ? await tx.courseRegistration.update({
          where: { id: existing.id },
          // Preserve the previous reviewer, decision timestamp and correction
          // remarks. The audit log below records this new attempt separately.
          data: { status: "REQUESTED" },
          include,
        })
      : await tx.courseRegistration.create({
          data: {
            institutionId,
            studentId,
            courseOfferingId: offering.id,
            status: "REQUESTED",
          },
          include,
        });

    await tx.courseRegistrationHistory.create({
      data: {
        institutionId,
        registrationId: saved.id,
        actorId: actor.id,
        action: existing ? "STUDENT_RESUBMITTED_CORRECTION" : "STUDENT_SUBMITTED",
        previousStatus: existing?.status ?? null,
        newStatus: "REQUESTED",
        reason: existing?.remarks ?? null,
        metadata: { courseOfferingId: offering.id },
      },
    });

    return { registration: saved, previousState: existing?.status ?? null };
  });

  const departmentId = registration.courseOffering.course.departmentId;
  const hods = await prisma.employeeProfile.findMany({ where: { institutionId, departmentId, status: "ACTIVE", user: { userRoles: { some: { role: { name: "HOD", institutionId } } } } }, select: { userId: true } });
  await Promise.all(hods.map((hod) => notifyUser(institutionId, hod.userId, "New course registration request", "A student submitted a course registration request for your department.", "/hod/course-registration-requests")));

  await recordAuditLog({
    institutionId,
    userId: actor.id,
    action: previousState ? "registration.correction_resubmit" : "registration.request",
    entityType: "CourseRegistration",
    entityId: registration.id,
    metadata: {
      studentId,
      courseOfferingId: input.courseOfferingId,
      previousState,
      newState: "REQUESTED",
    },
    ...meta,
  });

  return registration;
}

export async function drop(
  institutionId: string,
  actor: AuthenticatedUser,
  id: string,
  reason: string | undefined,
  meta: Meta
) {
  const existing = await prisma.courseRegistration.findFirst({
    where: { id, institutionId },
    include,
  });
  if (!existing) throw new AppError("Registration not found", 404);

  const selfService =
    existing.studentId === actor.id &&
    getEffectiveWorkspaceRole(actor) === "STUDENT";

  if (selfService) {
    if (!canStudentCancelRegistration(existing.status)) {
      throw new AppError(
        "Students may only cancel a pending request. Approved courses require a formal withdrawal request.",
        409
      );
    }
    if (!isStudentCancellationAllowed(
      new Date(),
      existing.courseOffering.semester.academicYear,
      existing.courseOffering.registrationOpen
    )) {
      throw new AppError("The institution's add/drop deadline has passed or has not been configured", 409);
    }
  } else {
    if (!actor.permissions.includes("registration.withdrawal.override")) {
      throw new AppError("Administrative withdrawal override permission is required", 403);
    }
    await assertApproverScope(institutionId, actor, existing.courseOffering.course.departmentId);
    if (!reason || reason.trim().length < 5) {
      throw new AppError("An administrative override reason of at least 5 characters is required", 400);
    }
    if (!["REQUESTED", "APPROVED"].includes(existing.status)) {
      throw new AppError("Only requested or approved registrations can be overridden", 409);
    }
  }

  if (!canTransitionRegistrationState(existing.status, "DROPPED")) {
    throw new AppError("This registration cannot transition to DROPPED", 409);
  }

  const dropped = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT "id" FROM "course_offerings"
      WHERE "id" = ${existing.courseOfferingId}
        AND "institutionId" = ${institutionId}
      FOR UPDATE
    `);
    const fresh = await tx.courseRegistration.findFirst({
      where: { id, institutionId },
      include,
    });
    if (!fresh || fresh.status !== existing.status || (selfService && fresh.studentId !== actor.id)) {
      throw new AppError("The registration changed before the withdrawal could be committed", 409);
    }
    if (selfService && !isStudentCancellationAllowed(
      new Date(),
      fresh.courseOffering.semester.academicYear,
      fresh.courseOffering.registrationOpen
    )) {
      throw new AppError("The institution's add/drop deadline passed before the cancellation was committed", 409);
    }

    const changed = await tx.courseRegistration.updateMany({
      where: {
        id,
        institutionId,
        status: existing.status,
        ...(selfService ? { studentId: actor.id } : {}),
      },
      data: {
        status: "DROPPED",
        decidedById: actor.id,
        decidedAt: new Date(),
        remarks: reason ?? null,
      },
    });
    if (changed.count !== 1) {
      throw new AppError("Registration state changed concurrently; refresh and retry", 409);
    }

    const saved = await tx.courseRegistration.findUniqueOrThrow({ where: { id }, include });
    await tx.courseRegistrationHistory.create({
      data: {
        institutionId,
        registrationId: id,
        actorId: actor.id,
        action: selfService ? "STUDENT_CANCELLED_PENDING" : "ADMINISTRATIVE_WITHDRAWAL_OVERRIDE",
        previousStatus: existing.status,
        newStatus: "DROPPED",
        reason: reason ?? null,
      },
    });
    return saved;
  });

  await recordAuditLog({
    institutionId,
    userId: actor.id,
    action: selfService ? "registration.cancel_pending" : "registration.withdrawal_override",
    entityType: "CourseRegistration",
    entityId: id,
    metadata: {
      studentId: existing.studentId,
      previousStatus: existing.status,
      newStatus: "DROPPED",
      reason: reason ?? null,
    },
    ...meta,
  });
  return dropped;
}

export async function decide(
  institutionId: string,
  actor: AuthenticatedUser,
  id: string,
  decision: "APPROVED" | "REJECTED" | "NEEDS_CORRECTION",
  remarks: string | undefined,
  meta: Meta
) {
  const existing = await prisma.courseRegistration.findFirst({
    where: { id, institutionId },
    include,
  });
  if (!existing) throw new AppError("Registration not found", 404);
  if (!canTransitionRegistrationState(existing.status, decision)) {
    throw new AppError("This registration state does not permit the requested decision", 409);
  }
  await assertApproverScope(
    institutionId,
    actor,
    existing.courseOffering.course.departmentId
  );

  const updated = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT "id" FROM "course_offerings"
      WHERE "id" = ${existing.courseOfferingId}
        AND "institutionId" = ${institutionId}
      FOR UPDATE
    `);
    await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT "id" FROM "users"
      WHERE "id" = ${existing.studentId}
        AND "institutionId" = ${institutionId}
      FOR UPDATE
    `);
    const currentEnrollment = await tx.studentEnrollment.findFirst({
      where: {
        institutionId,
        userId: existing.studentId,
        status: "ACTIVE",
        academicYear: { isCurrent: true },
      },
      orderBy: { enrolledAt: "desc" },
      select: {
        semesterId: true,
        sectionId: true,
        program: { select: { departmentId: true } },
      },
    });
    if (
      !currentEnrollment ||
      currentEnrollment.semesterId !== existing.courseOffering.semester.id ||
      currentEnrollment.sectionId !== existing.courseOffering.section.id ||
      currentEnrollment.program.departmentId !== existing.courseOffering.course.departmentId
    ) {
      throw new AppError("The student's current academic enrollment no longer matches this course offering", 422);
    }

    if (decision === "APPROVED") {
      const offering = await tx.courseOffering.findFirst({
        where: { id: existing.courseOfferingId, institutionId },
        select: { capacity: true, section: { select: { capacity: true } } },
      });
      if (!offering) throw new AppError("Course offering not found", 404);
      const limit = seatLimit(offering);
      if (limit !== null) {
        // REQUESTED already reserves this seat. Approval changes the state,
        // not the number of seats reserved.
        const reserved = await tx.courseRegistration.count({
          where: {
            courseOfferingId: existing.courseOfferingId,
            status: { in: [...REGISTRATION_SEAT_RESERVING_STATUSES] },
          },
        });
        if (reserved > limit) throw new AppError("Course offering has exceeded its configured capacity", 409);
      }
    }

    const changed = await tx.courseRegistration.updateMany({
      where: { id, institutionId, status: "REQUESTED" },
      data: {
        status: decision,
        decidedById: actor.id,
        decidedAt: new Date(),
        remarks: remarks ?? null,
      },
    });
    if (changed.count !== 1) {
      throw new AppError("This registration has already been decided by another action", 409);
    }

    const saved = await tx.courseRegistration.findFirst({ where: { id, institutionId }, include });
    if (!saved) throw new AppError("Registration not found", 404);
    await tx.courseRegistrationHistory.create({
      data: {
        institutionId,
        registrationId: id,
        actorId: actor.id,
        action: `STAFF_${decision}`,
        previousStatus: "REQUESTED",
        newStatus: decision,
        reason: remarks ?? null,
      },
    });
    return saved;
  });

  await notifyUser(
    institutionId,
    existing.studentId,
    decision === "APPROVED"
      ? "Course registration approved"
      : decision === "REJECTED"
        ? "Course registration rejected"
        : "Course registration needs correction",
    decision === "APPROVED"
      ? "Your course registration was approved."
      : (remarks ?? "Please review and update your course registration."),
    "/student/course-registration"
  );

  await recordAuditLog({
    institutionId,
    userId: actor.id,
    action: `registration.${decision.toLowerCase()}`,
    entityType: "CourseRegistration",
    entityId: id,
    metadata: {
      studentId: existing.studentId,
      previousState: "REQUESTED",
      newState: decision,
      remarks: remarks ?? null,
    },
    ...meta,
  });

  return updated;
}

export async function bulkRegister(
  institutionId: string,
  actor: AuthenticatedUser,
  courseOfferingIds: string[],
  meta: Meta
) {
  if (getEffectiveWorkspaceRole(actor) !== "STUDENT") throw new AppError("Only the active Student workspace may submit course registrations", 403);
  const unique = [...new Set(courseOfferingIds)];
  const results: { courseOfferingId: string; status: "SUBMITTED" | "SKIPPED"; reason?: string; registration?: unknown }[] = [];
  for (const courseOfferingId of unique) {
    try {
      const registration = await register(institutionId, actor, { courseOfferingId }, meta);
      results.push({ courseOfferingId, status: "SUBMITTED", registration });
    } catch (error) {
      results.push({ courseOfferingId, status: "SKIPPED", reason: error instanceof Error ? error.message : "Unable to submit registration" });
    }
  }
  const submitted = results.filter((r) => r.status === "SUBMITTED").map((r) => r.registration);
  return { requested: unique.length, submitted: submitted.length, skipped: results.filter((r) => r.status === "SKIPPED").length, results };
}

export async function bulkDecideRegistrations(
  institutionId: string,
  actor: AuthenticatedUser,
  ids: string[],
  decision: "APPROVED" | "REJECTED" | "NEEDS_CORRECTION",
  remarks: string | undefined,
  meta: Meta
) {
  const activeRole = getEffectiveWorkspaceRole(actor);
  if (
    !actor.permissions.includes("registration.approve") ||
    !["SUPER_ADMIN","CHAIRMAN","MANAGEMENT","REGISTRAR","DIRECTOR","DEAN","HOD"].includes(activeRole)
  ) {
    throw new AppError("The active workspace cannot decide course registrations", 403);
  }
  const unique = [...new Set(ids)];
  const results: {
    id: string;
    status: "APPROVED" | "REJECTED" | "NEEDS_CORRECTION" | "SKIPPED";
    reason?: string;
  }[] = [];
  for (const id of unique) {
    try {
      await decide(institutionId, actor, id, decision, remarks, meta);
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

export async function listRegistrations(
  institutionId: string,
  actor: AuthenticatedUser,
  pagination: PaginationParams,
  filters: {
    status?: string;
    courseOfferingId?: string;
    studentId?: string;
    semesterId?: string;
    programId?: string;
    academicYearId?: string;
    sectionId?: string;
    courseId?: string;
    facultyId?: string;
    courseType?: "core" | "elective";
    search?: string;
  }
) {
  const where: Prisma.CourseRegistrationWhereInput = {
    institutionId,
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.courseOfferingId
      ? { courseOfferingId: filters.courseOfferingId }
      : {}),
    ...(filters.studentId ? { studentId: filters.studentId } : {}),
    ...(filters.semesterId || filters.programId || filters.academicYearId || filters.sectionId || filters.courseId || filters.facultyId || filters.courseType
      ? { courseOffering: { ...(filters.semesterId ? { semesterId: filters.semesterId } : {}), ...(filters.sectionId ? { sectionId: filters.sectionId } : {}), ...(filters.courseId ? { courseId: filters.courseId } : {}), ...(filters.facultyId ? { facultyId: filters.facultyId } : {}),
            ...(filters.courseType ? { isElective: filters.courseType === "elective" } : {}), ...(filters.programId || filters.academicYearId ? { semester: { ...(filters.programId ? { programId: filters.programId } : {}), ...(filters.academicYearId ? { academicYearId: filters.academicYearId } : {}) } } : {}) } }
      : {}),
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

  // Enforce the effective workspace scope for all registration list paths.
  // Department/campus leaders see only assigned departments; Faculty see the
  // offerings they teach; Students and Parents see only their own/linked rows.
  if (!isInstitutionWide(actor)) {
    const activeRole = getEffectiveWorkspaceRole(actor);
    if (activeRole === "DIRECTOR" && isDirectorScoped(actor)) {
      const departmentIds = await getDirectorDepartmentIds(institutionId, actor.id);
      const courseOfferingFilter: Prisma.CourseOfferingWhereInput = {
        ...(typeof where.courseOffering === "object" && where.courseOffering !== null ? where.courseOffering : {}),
        course: { departmentId: { in: departmentIds.length ? departmentIds : ["__NO_AUTHORIZED_SCOPE__"] } },
      };
      where.courseOffering = courseOfferingFilter;
    } else if (activeRole === "DEAN" || activeRole === "HOD") {
      const departmentIds = await getManagedDepartmentIds(institutionId, actor.id);
      const courseOfferingFilter: Prisma.CourseOfferingWhereInput = {
        ...(typeof where.courseOffering === "object" && where.courseOffering !== null ? where.courseOffering : {}),
        course: { departmentId: { in: departmentIds.length ? departmentIds : ["__NO_AUTHORIZED_SCOPE__"] } },
      };
      where.courseOffering = courseOfferingFilter;
    } else if (activeRole === "FACULTY") {
      const courseOfferingFilter: Prisma.CourseOfferingWhereInput = {
        ...(typeof where.courseOffering === "object" && where.courseOffering !== null && "facultyId" in where.courseOffering
          ? where.courseOffering
          : {}),
        facultyId: actor.id,
      };
      where.courseOffering = courseOfferingFilter;
    } else if (activeRole === "STUDENT") {
      where.studentId = actor.id;
    } else if (activeRole === "PARENT") {
      const links = await prisma.parentStudentLink.findMany({
        where: { institutionId, parentId: actor.id },
        select: { studentId: true },
      });
      where.studentId = { in: links.length ? links.map((link) => link.studentId) : ["__NO_LINKED_STUDENT__"] };
    } else {
      throw new AppError("Course registrations are not available for this role", 403);
    }
  }

  const [items, total, grouped] = await Promise.all([
    prisma.courseRegistration.findMany({
      where,
      include,
      orderBy: { createdAt: "desc" },
      skip: pagination.skip,
      take: pagination.take,
    }),
    prisma.courseRegistration.count({ where }),
    prisma.courseRegistration.groupBy({
      by: ["status"],
      where: {
        ...where,
      },
      _count: { _all: true },
    }),
  ]);

  return {
    items,
    total,
    summary: Object.fromEntries(
      grouped.map((row) => [row.status, row._count._all])
    ) as Record<string, number>,
  };
}


/**
 * HOD bulk course assignment.
 *
 * This is the operational path for compulsory/department-managed course
 * assignment. Unlike student self-service registration, assignments made
 * by an authorised HOD are immediately APPROVED, so the student can enter
 * the academic roster without a second manual approval step.
 *
 * Every student/offering pair is checked against the student's active
 * semester + section and the HOD's managed department scope.
 */
export async function bulkAssignCourses(
  institutionId: string,
  actor: AuthenticatedUser,
  input: {
    studentIds: string[];
    courseOfferingIds: string[];
  },
  meta: Meta
) {
  if (getEffectiveWorkspaceRole(actor) !== "HOD") {
    throw new AppError("Only the active HOD workspace may use bulk course assignment", 403);
  }

  const studentIds = Array.from(new Set(input.studentIds));
  const courseOfferingIds = Array.from(new Set(input.courseOfferingIds));

  const [students, offerings] = await Promise.all([
    prisma.user.findMany({
      where: {
        id: { in: studentIds },
        institutionId,
        isActive: true,
        userRoles: {
          some: {
            role: { name: "STUDENT", institutionId },
          },
        },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        studentEnrollments: {
          where: {
            institutionId,
            status: "ACTIVE",
            academicYear: { isCurrent: true },
          },
          orderBy: { enrolledAt: "desc" },
          take: 1,
          select: {
            id: true,
            programId: true,
            academicYearId: true,
            semesterId: true,
            sectionId: true,
            program: { select: { departmentId: true } },
          },
        },
      },
    }),
    prisma.courseOffering.findMany({
      where: {
        id: { in: courseOfferingIds },
        institutionId,
        isActive: true,
      },
      select: {
        id: true,
        semesterId: true,
        sectionId: true,
        capacity: true,
        registrationOpen: true,
        course: {
          select: {
            id: true,
            code: true,
            credits: true,
            departmentId: true,
          },
        },
        semester: { select: { academicYear: { select: {
          registrationOpensAt: true,
          registrationClosesAt: true,
          addDropDeadline: true,
          withdrawalDeadline: true,
          exceptionalWithdrawalAllowed: true,
          exceptionalWithdrawalStartsAt: true,
          exceptionalWithdrawalEndsAt: true,
        } } } },
        section: { select: { capacity: true } },
      },
    }),
  ]);

  if (students.length !== studentIds.length) {
    throw new AppError("One or more selected students are not available in this institution", 404);
  }
  if (offerings.length !== courseOfferingIds.length) {
    throw new AppError("One or more selected course offerings are not available", 404);
  }

  for (const offering of offerings) {
    await assertApproverScope(institutionId, actor, offering.course.departmentId);
  }

  const studentById = new Map(students.map((student) => [student.id, student]));

  const results = await prisma.$transaction(async (tx) => {
    // Lock offerings in deterministic order to prevent overbooking and
    // deadlocks across concurrent bulk assignments.
    await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT "id" FROM "course_offerings"
      WHERE "institutionId" = ${institutionId}
        AND "id" IN (${Prisma.join(courseOfferingIds)})
      ORDER BY "id"
      FOR UPDATE
    `);
    // Match the student-row lock used by self-service registration so
    // bulk assignment cannot race an individual semester credit check.
    await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT "id" FROM "users"
      WHERE "institutionId" = ${institutionId}
        AND "id" IN (${Prisma.join(studentIds)})
      ORDER BY "id"
      FOR UPDATE
    `);
    const currentEnrollments = await tx.studentEnrollment.findMany({
      where: {
        institutionId,
        userId: { in: studentIds },
        status: "ACTIVE",
        academicYear: { isCurrent: true },
      },
      orderBy: [{ userId: "asc" }, { enrolledAt: "desc" }],
      select: {
        userId: true,
        semesterId: true,
        sectionId: true,
        program: { select: { departmentId: true } },
      },
    });
    const enrollmentByStudent = new Map<string, (typeof currentEnrollments)[number]>();
    for (const enrollment of currentEnrollments) {
      if (!enrollmentByStudent.has(enrollment.userId)) enrollmentByStudent.set(enrollment.userId, enrollment);
    }
    const freshOfferings = await tx.courseOffering.findMany({
      where: { institutionId, id: { in: courseOfferingIds }, isActive: true },
      select: {
        id: true,
        semesterId: true,
        sectionId: true,
        capacity: true,
        registrationOpen: true,
        course: { select: { id: true, code: true, credits: true, departmentId: true } },
        semester: { select: { academicYear: { select: {
          registrationOpensAt: true,
          registrationClosesAt: true,
          addDropDeadline: true,
          withdrawalDeadline: true,
          exceptionalWithdrawalAllowed: true,
          exceptionalWithdrawalStartsAt: true,
          exceptionalWithdrawalEndsAt: true,
        } } } },
        section: { select: { capacity: true } },
      },
    });
    if (freshOfferings.length !== courseOfferingIds.length) {
      throw new AppError("One or more course offerings changed or became inactive during assignment", 409);
    }
    const offeringById = new Map(freshOfferings.map((offering) => [offering.id, offering]));
    const assignmentTime = new Date();
    const assigned: Prisma.CourseRegistrationGetPayload<{ include: typeof include }>[] = [];

    for (const studentId of studentIds) {
      for (const courseOfferingId of courseOfferingIds) {
        const offering = offeringById.get(courseOfferingId)!;
        if (!isRegistrationAllowed(assignmentTime, offering.semester.academicYear, offering.registrationOpen)) {
          throw new AppError(`Registration is not open for ${offering.course.code} under the institution's academic-year policy.`, 409);
        }
        const enrollment = enrollmentByStudent.get(studentId);
        if (!enrollment || !enrollment.semesterId || !enrollment.sectionId) {
          const student = studentById.get(studentId)!;
          throw new AppError(`${student.firstName} ${student.lastName} has no active current-year semester/section enrollment`, 422);
        }
        if (enrollment.semesterId !== offering.semesterId || enrollment.sectionId !== offering.sectionId) {
          const student = studentById.get(studentId)!;
          throw new AppError(`${student.firstName} ${student.lastName} is not enrolled in the semester/section for ${offering.course.code}`, 422);
        }
        if (enrollment.program.departmentId !== offering.course.departmentId) {
          const student = studentById.get(studentId)!;
          throw new AppError(`${student.firstName} ${student.lastName} is outside the department scope of ${offering.course.code}`, 403);
        }

        const existing = await tx.courseRegistration.findUnique({
          where: {
            studentId_courseOfferingId: {
              studentId,
              courseOfferingId,
            },
          },
          include,
        });

        if (existing?.status === "APPROVED") {
          assigned.push(existing);
          continue;
        }
        if (existing && existing.status !== "REQUESTED") {
          throw new AppError(
            `Cannot bulk-assign ${offering.course.code}: the student's historical registration is ${existing.status}. Use an authorised reopening workflow instead.`,
            409
          );
        }

        const duplicateCourse = await tx.courseRegistration.findFirst({
          where: {
            institutionId,
            studentId,
            id: existing ? { not: existing.id } : undefined,
            courseOffering: {
              courseId: offering.course.id,
              semesterId: offering.semesterId,
            },
          },
          select: { id: true },
        });

        if (duplicateCourse) {
          throw new AppError(
            `Student is already registered for ${offering.course.code} in this semester`,
            409
          );
        }

        const activeCredits = await tx.courseRegistration.findMany({
          where: {
            institutionId,
            studentId,
            status: { in: [...REGISTRATION_SEAT_RESERVING_STATUSES] },
            id: existing ? { not: existing.id } : undefined,
            courseOffering: { semesterId: offering.semesterId },
          },
          select: {
            courseOffering: {
              select: { course: { select: { credits: true } } },
            },
          },
        });

        const currentCredits = activeCredits.reduce(
          (sum, row) => sum + row.courseOffering.course.credits,
          0
        );

        if (currentCredits + offering.course.credits > MAX_CREDITS_PER_SEMESTER) {
          throw new AppError(
            `Credit limit exceeded for selected student: ${currentCredits} registered, limit is ${MAX_CREDITS_PER_SEMESTER}`,
            422
          );
        }

        const limit = seatLimit(offering);
        if (limit !== null) {
          const reservedCount = await tx.courseRegistration.count({
            where: {
              courseOfferingId,
              status: { in: [...REGISTRATION_SEAT_RESERVING_STATUSES] },
              ...(existing ? { id: { not: existing.id } } : {}),
            },
          });

          if (reservedCount >= limit) {
            throw new AppError(
              `Course offering ${offering.course.code} is already full`,
              409
            );
          }
        }

        const saved = existing
          ? await (async () => {
              const changed = await tx.courseRegistration.updateMany({
                where: { id: existing.id, institutionId, status: "REQUESTED" },
                data: {
                  status: "APPROVED",
                  decidedById: actor.id,
                  decidedAt: new Date(),
                  remarks: "Assigned and approved by HOD",
                },
              });
              if (changed.count !== 1) throw new AppError("Registration changed during bulk assignment", 409);
              const refreshed = await tx.courseRegistration.findFirst({ where: { id: existing.id, institutionId }, include });
              if (!refreshed) throw new AppError("Registration not found after assignment", 404);
              return refreshed;
            })()
          : await tx.courseRegistration.create({
              data: {
                institutionId,
                studentId,
                courseOfferingId,
                status: "APPROVED",
                decidedById: actor.id,
                decidedAt: new Date(),
                remarks: "Assigned and approved by HOD",
              },
              include,
            });

        assigned.push(saved);
      }
    }

    return assigned;
  });

  await recordAuditLog({
    institutionId,
    userId: actor.id,
    action: "registration.bulk_assign",
    entityType: "CourseRegistration",
    metadata: {
      studentIds,
      courseOfferingIds,
      assignedCount: results.length,
    },
    ...meta,
  });

  return {
    assignedCount: results.length,
    studentsCount: studentIds.length,
    coursesCount: courseOfferingIds.length,
    items: results,
  };
}

export async function updateOfferingCapacity(
  institutionId: string,
  actor: AuthenticatedUser,
  courseOfferingId: string,
  input: OfferingCapacityInput,
  meta: Meta
) {
  const offering = await prisma.courseOffering.findFirst({
    where: { id: courseOfferingId, institutionId },
    select: { id: true, course: { select: { departmentId: true } } },
  });
  if (!offering) throw new AppError("Course offering not found", 404);
  await assertApproverScope(institutionId, actor, offering.course.departmentId);

  const updated = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT "id" FROM "course_offerings"
      WHERE "id" = ${courseOfferingId}
        AND "institutionId" = ${institutionId}
      FOR UPDATE
    `);

    const fresh = await tx.courseOffering.findFirst({
      where: { id: courseOfferingId, institutionId },
      select: {
        id: true,
        capacity: true,
        section: { select: { capacity: true } },
      },
    });
    if (!fresh) throw new AppError("Course offering not found", 404);

    const effectiveLimit = input.capacity !== undefined
      ? (input.capacity ?? fresh.section.capacity)
      : (fresh.capacity ?? fresh.section.capacity);

    if (effectiveLimit !== null) {
      const reserved = await tx.courseRegistration.count({
        where: {
          courseOfferingId,
          institutionId,
          status: { in: [...REGISTRATION_SEAT_RESERVING_STATUSES] },
        },
      });
      if (effectiveLimit < reserved) {
        throw new AppError(
          `${reserved} pending/approved registrations already reserve seats; capacity cannot be reduced below this number.`,
          422
        );
      }
    }

    return tx.courseOffering.update({
      where: { id: courseOfferingId },
      data: {
        ...(input.capacity !== undefined ? { capacity: input.capacity } : {}),
        ...(input.registrationOpen !== undefined ? { registrationOpen: input.registrationOpen } : {}),
        ...(input.isElective !== undefined ? { isElective: input.isElective } : {}),
      },
      select: {
        id: true,
        capacity: true,
        registrationOpen: true,
        isElective: true,
      },
    });
  });

  await recordAuditLog({
    institutionId,
    userId: actor.id,
    action: "registration.offering.update",
    entityType: "CourseOffering",
    entityId: courseOfferingId,
    metadata: input as Prisma.InputJsonValue,
    ...meta,
  });

  return updated;
}


export async function requestWithdrawal(
  institutionId: string,
  actor: AuthenticatedUser,
  registrationId: string,
  reason: string,
  meta: Meta
) {
  if (getEffectiveWorkspaceRole(actor) !== "STUDENT") {
    throw new AppError("Only the active Student workspace may request course withdrawal", 403);
  }
  if (!actor.permissions.includes("registration.withdrawal.request")) {
    throw new AppError("Course withdrawal request permission is required", 403);
  }
  if (!reason || reason.trim().length < 5) {
    throw new AppError("A withdrawal reason of at least 5 characters is required", 400);
  }
  const existing = await prisma.courseRegistration.findFirst({
    where: { id: registrationId, institutionId, studentId: actor.id },
    include,
  });
  if (!existing) throw new AppError("Registration not found", 404);
  if (existing.status !== "APPROVED") {
    throw new AppError("Only an approved course registration can enter the withdrawal workflow", 409);
  }
  if (!isWithdrawalRequestAllowed(new Date(), existing.courseOffering.semester.academicYear)) {
    throw new AppError("The institution's normal or exceptional withdrawal window is not open", 409);
  }

  const request = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT "id" FROM "course_registrations"
      WHERE "id" = ${registrationId} AND "institutionId" = ${institutionId}
      FOR UPDATE
    `);
    const fresh = await tx.courseRegistration.findFirst({
      where: { id: registrationId, institutionId, studentId: actor.id },
      include,
    });
    if (!fresh || fresh.status !== "APPROVED") {
      throw new AppError("The approved registration changed before the withdrawal request was recorded", 409);
    }
    if (!isWithdrawalRequestAllowed(new Date(), fresh.courseOffering.semester.academicYear)) {
      throw new AppError("The institution's withdrawal window closed before the request was committed", 409);
    }
    const pending = await tx.courseWithdrawalRequest.findFirst({
      where: { institutionId, registrationId, status: "PENDING" },
      select: { id: true },
    });
    if (pending) throw new AppError("A withdrawal request is already pending for this course", 409);
    const latest = await tx.courseWithdrawalRequest.findFirst({
      where: { institutionId, registrationId },
      orderBy: { attemptNumber: "desc" },
      select: { attemptNumber: true },
    });
    const saved = await tx.courseWithdrawalRequest.create({
      data: {
        institutionId,
        registrationId,
        studentId: actor.id,
        attemptNumber: (latest?.attemptNumber ?? 0) + 1,
        reason: reason.trim(),
        status: "PENDING",
      },
      include: {
        student: { select: { id: true, firstName: true, lastName: true, email: true } },
        registration: { include },
      },
    });
    await tx.courseRegistrationHistory.create({
      data: {
        institutionId,
        registrationId,
        actorId: actor.id,
        action: "STUDENT_REQUESTED_WITHDRAWAL",
        previousStatus: "APPROVED",
        newStatus: "APPROVED",
        reason: reason.trim(),
        metadata: { withdrawalRequestId: saved.id },
      },
    });
    return saved;
  });

  await recordAuditLog({
    institutionId,
    userId: actor.id,
    action: "registration.withdrawal.request",
    entityType: "CourseWithdrawalRequest",
    entityId: request.id,
    metadata: {
      registrationId,
      previousRegistrationState: "APPROVED",
      requestState: "PENDING",
      reason: reason.trim(),
      attemptNumber: request.attemptNumber,
    },
    ...meta,
  });
  const reviewers = await prisma.employeeProfile.findMany({
    where: {
      institutionId,
      departmentId: existing.courseOffering.course.departmentId,
      status: "ACTIVE",
      user: { userRoles: { some: { role: { name: { in: ["HOD", "DEAN"] }, institutionId } } } },
    },
    select: { userId: true },
  });
  await Promise.all(
    Array.from(new Set(reviewers.map((reviewer) => reviewer.userId))).map((userId) =>
      notifyUser(
        institutionId,
        userId,
        "Course withdrawal awaiting review",
        `${existing.student.firstName} ${existing.student.lastName} submitted a formal withdrawal request for ${existing.courseOffering.course.code}.`,
        "/hod/course-registration-requests"
      )
    )
  );
  await notifyUser(
    institutionId,
    actor.id,
    "Withdrawal request submitted",
    "Your course remains active until an authorised academic reviewer decides the withdrawal request.",
    "/student/course-registration"
  );
  return request;
}

export async function listWithdrawalRequests(
  institutionId: string,
  actor: AuthenticatedUser
) {
  const where: Prisma.CourseWithdrawalRequestWhereInput = {
    institutionId,
    status: "PENDING",
  };
  if (!isInstitutionWide(actor)) {
    const role = getEffectiveWorkspaceRole(actor);
    let departmentIds: string[] = [];
    if (role === "DIRECTOR" && isDirectorScoped(actor)) {
      departmentIds = await getDirectorDepartmentIds(institutionId, actor.id);
    } else if (role === "DEAN" || role === "HOD") {
      departmentIds = await getManagedDepartmentIds(institutionId, actor.id);
    } else {
      throw new AppError("Course withdrawal requests are not available for this workspace", 403);
    }
    where.registration = {
      courseOffering: {
        course: { departmentId: { in: departmentIds.length ? departmentIds : ["__NO_AUTHORIZED_SCOPE__"] } },
      },
    };
  }
  return prisma.courseWithdrawalRequest.findMany({
    where,
    include: {
      student: { select: { id: true, firstName: true, lastName: true, email: true } },
      registration: { include },
    },
    orderBy: { requestedAt: "asc" },
  });
}

export async function decideWithdrawal(
  institutionId: string,
  actor: AuthenticatedUser,
  requestId: string,
  decision: "APPROVED" | "REJECTED",
  decisionNote: string | undefined,
  meta: Meta
) {
  if (!actor.permissions.includes("registration.withdrawal.approve")) {
    throw new AppError("Course withdrawal approval permission is required", 403);
  }
  const existing = await prisma.courseWithdrawalRequest.findFirst({
    where: { id: requestId, institutionId },
    include: {
      student: { select: { id: true, firstName: true, lastName: true, email: true } },
      registration: { include },
    },
  });
  if (!existing) throw new AppError("Withdrawal request not found", 404);
  if (existing.status !== "PENDING") throw new AppError("Only pending withdrawal requests can be decided", 409);
  await assertApproverScope(institutionId, actor, existing.registration.courseOffering.course.departmentId);

  const decidedAt = new Date();
  const result = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT "id" FROM "course_offerings"
      WHERE "id" = ${existing.registration.courseOfferingId}
        AND "institutionId" = ${institutionId}
      FOR UPDATE
    `);
    await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT "id" FROM "course_registrations"
      WHERE "id" = ${existing.registrationId}
        AND "institutionId" = ${institutionId}
      FOR UPDATE
    `);
    const changed = await tx.courseWithdrawalRequest.updateMany({
      where: { id: requestId, institutionId, status: "PENDING" },
      data: { status: decision, decidedById: actor.id, decidedAt, decisionNote: decisionNote ?? null },
    });
    if (changed.count !== 1) throw new AppError("This withdrawal request has already been decided", 409);

    if (decision === "APPROVED") {
      const registrationChanged = await tx.courseRegistration.updateMany({
        where: { id: existing.registrationId, institutionId, studentId: existing.studentId, status: "APPROVED" },
        data: {
          status: "WITHDRAWN",
          decidedById: actor.id,
          decidedAt,
          remarks: decisionNote ?? "Formal course withdrawal approved",
        },
      });
      if (registrationChanged.count !== 1) {
        throw new AppError("The course registration is no longer approved; withdrawal was not applied", 409);
      }
    }
    await tx.courseRegistrationHistory.create({
      data: {
        institutionId,
        registrationId: existing.registrationId,
        actorId: actor.id,
        action: decision === "APPROVED" ? "STAFF_APPROVED_WITHDRAWAL" : "STAFF_REJECTED_WITHDRAWAL",
        previousStatus: "APPROVED",
        newStatus: decision === "APPROVED" ? "WITHDRAWN" : "APPROVED",
        reason: decisionNote ?? existing.reason,
        metadata: { withdrawalRequestId: requestId },
      },
    });
    const refreshed = await tx.courseWithdrawalRequest.findFirst({
      where: { id: requestId, institutionId },
      include: {
        student: { select: { id: true, firstName: true, lastName: true, email: true } },
        registration: { include },
      },
    });
    if (!refreshed) throw new AppError("Withdrawal request not found after decision", 404);
    return refreshed;
  });

  await recordAuditLog({
    institutionId,
    userId: actor.id,
    action: `registration.withdrawal.${decision.toLowerCase()}`,
    entityType: "CourseWithdrawalRequest",
    entityId: requestId,
    metadata: {
      registrationId: existing.registrationId,
      previousRegistrationState: "APPROVED",
      newRegistrationState: decision === "APPROVED" ? "WITHDRAWN" : "APPROVED",
      previousRequestState: "PENDING",
      newRequestState: decision,
      studentId: existing.studentId,
      decisionNote: decisionNote ?? null,
    },
    ...meta,
  });
  await notifyUser(
    institutionId,
    existing.studentId,
    decision === "APPROVED" ? "Course withdrawal approved" : "Course withdrawal rejected",
    decision === "APPROVED"
      ? `Your withdrawal from ${existing.registration.courseOffering.course.code} has been approved.`
      : `Your withdrawal request was rejected: ${decisionNote ?? "Please contact the academic office."}`,
    "/student/course-registration"
  );
  return result;
}
