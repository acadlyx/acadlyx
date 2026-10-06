import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";
import { AuthenticatedUser } from "../types/auth";
import { PaginationParams } from "../utils/pagination";
import { recordAuditLog } from "./audit.service";
import { assertRegistrationApprovalAuthority } from "./workflowAuthority.service";
import {
  getManagedDepartmentIds,
  isInstitutionWide,
} from "./accessScope.service";
import {
  OfferingCapacityInput,
  RegisterInput,
} from "../validators/registration.validators";

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
      semester: { select: { id: true, name: true } },
      section: { select: { id: true, name: true, capacity: true } },
      faculty: { select: { id: true, firstName: true, lastName: true } },
    },
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
    where: { institutionId, userId: studentId, status: "ACTIVE" },
    orderBy: { enrolledAt: "desc" },
    include: {
      program: { select: { id: true, name: true, departmentId: true } },
      academicYear: { select: { id: true, name: true } },
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
    ...(filters.electivesOnly ? { isElective: true } : {}),
    ...(filters.search
      ? {
          course: {
            OR: [
              { name: { contains: filters.search, mode: "insensitive" } },
              { code: { contains: filters.search, mode: "insensitive" } },
            ],
          },
        }
      : {}),
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
        semester: { select: { id: true, name: true } },
        section: { select: { id: true, name: true, capacity: true } },
        faculty: { select: { id: true, firstName: true, lastName: true } },
        _count: { select: { registrations: { where: { status: "APPROVED" } } } },
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
        status: { in: ["REQUESTED", "APPROVED"] },
      },
      select: { courseOfferingId: true, status: true },
    }),
  ]);

  const held = new Map(existing.map((row) => [row.courseOfferingId, row.status]));

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
        registrationOpen: offering.registrationOpen,
        capacity: limit,
        seatsTaken: taken,
        seatsLeft: limit === null ? null : Math.max(0, limit - taken),
        myStatus: held.get(offering.id) ?? null,
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
    ["REQUESTED", "APPROVED"].includes(row.status)
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
  if (
    studentId !== actor.id &&
    !actor.permissions.includes("registration.approve") &&
    !actor.permissions.includes("registration.read")
  ) {
    throw new AppError("You may only register yourself", 403);
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

  const enrollment = await activeEnrollment(institutionId, studentId);

  const registration = await prisma.$transaction(async (tx) => {
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
    if (!offering.registrationOpen) {
      throw new AppError("Registration is closed for this offering", 409);
    }

    /* A student may only register inside the semester they are enrolled
       in — cross-semester registration corrupts attendance and results. */
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
    if (existing && ["REQUESTED", "APPROVED"].includes(existing.status)) {
      throw new AppError("Already registered for this course offering", 409);
    }

    /* Duplicate course guard: the same course must not be taken twice in
       one semester through two different sections. */
    const sameCourse = await tx.courseRegistration.findFirst({
      where: {
        institutionId,
        studentId,
        status: { in: ["REQUESTED", "APPROVED"] },
        courseOffering: {
          courseId: offering.course.id,
          semesterId: offering.semesterId,
        },
      },
      select: { id: true },
    });
    if (sameCourse) {
      throw new AppError(
        `Already registered for ${offering.course.code} this semester`,
        409
      );
    }

    const active = await tx.courseRegistration.findMany({
      where: {
        institutionId,
        studentId,
        status: { in: ["REQUESTED", "APPROVED"] },
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
      const taken = await tx.courseRegistration.count({
        where: {
          courseOfferingId: offering.id,
          status: { in: ["REQUESTED", "APPROVED"] },
        },
      });
      if (taken >= limit) {
        throw new AppError("This course offering is full", 409);
      }
    }

    if (existing) {
      /* Re-registering after a drop reuses the row the unique index owns. */
      return tx.courseRegistration.update({
        where: { id: existing.id },
        data: {
          status: "REQUESTED",
          decidedById: null,
          decidedAt: null,
          remarks: null,
        },
        include,
      });
    }

    return tx.courseRegistration.create({
      data: {
        institutionId,
        studentId,
        courseOfferingId: offering.id,
        status: "REQUESTED",
      },
      include,
    });
  });

  const departmentId = registration.courseOffering.course.departmentId;
  const hods = await prisma.employeeProfile.findMany({ where: { institutionId, departmentId, status: "ACTIVE", user: { userRoles: { some: { role: { name: "HOD", institutionId } } } } }, select: { userId: true } });
  await Promise.all(hods.map((hod) => notifyUser(institutionId, hod.userId, "New course registration request", "A student submitted a course registration request for your department.", "/hod/course-registration-requests")));

  await recordAuditLog({
    institutionId,
    userId: actor.id,
    action: "registration.request",
    entityType: "CourseRegistration",
    entityId: registration.id,
    metadata: { studentId, courseOfferingId: input.courseOfferingId },
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

  if (
    existing.studentId !== actor.id &&
    !actor.permissions.includes("registration.approve")
  ) {
    throw new AppError("You may only drop your own registrations", 403);
  }
  if (!["REQUESTED", "APPROVED"].includes(existing.status)) {
    throw new AppError("This registration is no longer active", 422);
  }

  const dropped = await prisma.courseRegistration.update({
    where: { id },
    data: {
      status: "DROPPED",
      decidedById: actor.id,
      decidedAt: new Date(),
      remarks: reason ?? null,
    },
    include,
  });

  await recordAuditLog({
    institutionId,
    userId: actor.id,
    action: "registration.drop",
    entityType: "CourseRegistration",
    entityId: id,
    metadata: { studentId: existing.studentId, reason },
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
  if (existing.status !== "REQUESTED") {
    throw new AppError("Only pending registrations can be decided", 422);
  }
  await assertApproverScope(
    institutionId,
    actor,
    existing.courseOffering.course.departmentId
  );

  const enrollment = await activeEnrollment(institutionId, existing.studentId);
  if (
    enrollment.semesterId !== existing.courseOffering.semester.id ||
    enrollment.sectionId !== existing.courseOffering.section.id ||
    enrollment.program.departmentId !== existing.courseOffering.course.departmentId
  ) {
    throw new AppError("The student's current academic enrollment no longer matches this course offering", 422);
  }

  const updated = await prisma.$transaction(async (tx) => {
    if (decision === "APPROVED") {
      const offering = await tx.courseOffering.findUniqueOrThrow({
        where: { id: existing.courseOfferingId },
        select: {
          capacity: true,
          section: { select: { capacity: true } },
        },
      });
      const limit = seatLimit(offering);
      if (limit !== null) {
        const approved = await tx.courseRegistration.count({
          where: {
            courseOfferingId: existing.courseOfferingId,
            status: "APPROVED",
          },
        });
        if (approved >= limit) {
          throw new AppError("Course offering is already full", 409);
        }
      }
    }

    return tx.courseRegistration.update({
      where: { id },
      data: {
        status: decision,
        decidedById: actor.id,
        decidedAt: new Date(),
        remarks: remarks ?? null,
      },
      include,
    });
  });

  await notifyUser(institutionId, existing.studentId, decision === "APPROVED" ? "Course registration approved" : decision === "REJECTED" ? "Course registration rejected" : "Course registration needs correction", decision === "APPROVED" ? "Your course registration was approved." : (remarks ?? "Please review and update your course registration."), "/student/course-registration");

  await recordAuditLog({
    institutionId,
    userId: actor.id,
    action: `registration.${decision.toLowerCase()}`,
    entityType: "CourseRegistration",
    entityId: id,
    metadata: { studentId: existing.studentId, remarks },
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
  if (!actor.roles.includes("STUDENT")) throw new AppError("Only students may submit their own course registration", 403);
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
  if (!actor.permissions.includes("registration.approve") || actor.roles.includes("STUDENT")) {
    throw new AppError("You are not authorized to decide course registrations", 403);
  }
  const unique = [...new Set(ids)];
  const results: { id: string; status: "APPROVED" | "SKIPPED"; reason?: string }[] = [];
  for (const id of unique) {
    try {
      await decide(institutionId, actor, id, decision, remarks, meta);
      results.push({ id, status: "APPROVED" });
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

export async function listRegistrations(
  institutionId: string,
  actor: AuthenticatedUser,
  pagination: PaginationParams,
  filters: {
    status?: string;
    courseOfferingId?: string;
    studentId?: string;
    semesterId?: string;
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
    ...(filters.semesterId
      ? { courseOffering: { semesterId: filters.semesterId } }
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

  /* A HOD only ever sees registrations for courses owned by a
     department they manage. */
  if (!isInstitutionWide(actor) && actor.roles.includes("HOD")) {
    const managed = await getManagedDepartmentIds(institutionId, actor.id);
    const courseOfferingFilter: Prisma.CourseOfferingWhereInput = {
      ...(typeof where.courseOffering === "object" && where.courseOffering !== null
        ? where.courseOffering
        : {}),
      course: {
        departmentId: {
          in: managed.length ? managed : ["__none__"],
        },
      },
    };

    where.courseOffering = courseOfferingFilter;
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
  if (!actor.roles.includes("HOD")) {
    throw new AppError("Only an HOD may use bulk course assignment", 403);
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
          where: { institutionId, status: "ACTIVE" },
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
        course: {
          select: {
            id: true,
            code: true,
            credits: true,
            departmentId: true,
          },
        },
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
  const offeringById = new Map(offerings.map((offering) => [offering.id, offering]));

  for (const studentId of studentIds) {
    const student = studentById.get(studentId)!;
    const enrollment = student.studentEnrollments[0];

    if (!enrollment || !enrollment.semesterId || !enrollment.sectionId) {
      throw new AppError(
        `${student.firstName} ${student.lastName} has no active semester/section enrollment`,
        422
      );
    }

    for (const courseOfferingId of courseOfferingIds) {
      const offering = offeringById.get(courseOfferingId)!;

      if (
        enrollment.semesterId !== offering.semesterId ||
        enrollment.sectionId !== offering.sectionId
      ) {
        throw new AppError(
          `${student.firstName} ${student.lastName} is not enrolled in the semester/section for ${offering.course.code}`,
          422
        );
      }

      if (enrollment.program?.departmentId !== offering.course.departmentId) {
        throw new AppError(
          `${student.firstName} ${student.lastName} is outside the department scope of ${offering.course.code}`,
          403
        );
      }
    }
  }

  const results = await prisma.$transaction(async (tx) => {
    const assigned: Prisma.CourseRegistrationGetPayload<{ include: typeof include }>[] = [];

    for (const studentId of studentIds) {
      for (const courseOfferingId of courseOfferingIds) {
        const offering = offeringById.get(courseOfferingId)!;

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

        const duplicateCourse = await tx.courseRegistration.findFirst({
          where: {
            institutionId,
            studentId,
            status: { in: ["REQUESTED", "APPROVED"] },
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
            status: { in: ["REQUESTED", "APPROVED"] },
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
          const approvedCount = await tx.courseRegistration.count({
            where: {
              courseOfferingId,
              status: "APPROVED",
              ...(existing ? { id: { not: existing.id } } : {}),
            },
          });

          if (approvedCount >= limit) {
            throw new AppError(
              `Course offering ${offering.course.code} is already full`,
              409
            );
          }
        }

        const saved = existing
          ? await tx.courseRegistration.update({
              where: { id: existing.id },
              data: {
                status: "APPROVED",
                decidedById: actor.id,
                decidedAt: new Date(),
                remarks: "Assigned and approved by HOD",
              },
              include,
            })
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

  if (input.capacity !== undefined && input.capacity !== null) {
    const approved = await prisma.courseRegistration.count({
      where: { courseOfferingId, status: "APPROVED" },
    });
    if (input.capacity < approved) {
      throw new AppError(
        `${approved} students are already approved; capacity cannot be lower`,
        422
      );
    }
  }

  const updated = await prisma.courseOffering.update({
    where: { id: courseOfferingId },
    data: {
      ...(input.capacity !== undefined ? { capacity: input.capacity } : {}),
      ...(input.registrationOpen !== undefined
        ? { registrationOpen: input.registrationOpen }
        : {}),
      ...(input.isElective !== undefined ? { isElective: input.isElective } : {}),
    },
    select: {
      id: true,
      capacity: true,
      registrationOpen: true,
      isElective: true,
    },
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
