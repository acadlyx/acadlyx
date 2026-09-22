import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";
import { AuthenticatedUser } from "../types/auth";
import { PaginationParams } from "../utils/pagination";
import { recordAuditLog } from "./audit.service";
import { assertRegistrationApprovalAuthority } from "./workflowAuthority.service";
import {
  OfferingCapacityInput,
  RegisterInput,
} from "../validators/registration.validators";

type Meta = { ipAddress?: string; userAgent?: string };

/** Credit ceiling per semester. Prevents a student silently
 *  over-registering into an unteachable workload. */
export const MAX_CREDITS_PER_SEMESTER = 30;
export const MIN_CREDITS_PER_SEMESTER = 12;

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

  const where: Prisma.CourseOfferingWhereInput = {
    institutionId,
    isActive: true,
    ...(semesterId ? { semesterId } : {}),
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
        course: { select: { id: true, credits: true, code: true } },
        section: { select: { id: true, capacity: true } },
      },
    });
    if (!offering) throw new AppError("Course offering not found", 404);
    if (!offering.registrationOpen) {
      throw new AppError("Registration is closed for this offering", 409);
    }

    /* A student may only register inside the semester they are enrolled
       in — cross-semester registration corrupts attendance and results. */
    if (enrollment.semesterId && offering.semesterId !== enrollment.semesterId) {
      throw new AppError(
        "This offering belongs to a different semester than your enrollment",
        422
      );
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
  decision: "APPROVED" | "REJECTED",
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
      where: { institutionId },
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
