import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";
import { AuthenticatedUser } from "../types/auth";
import { PaginationParams } from "../utils/pagination";
import { getCourseOfferingRoster } from "../utils/academicRoster";
import { recordAuditLog } from "./audit.service";
import { getManagedDepartmentIds, getDirectorDepartmentIds, isInstitutionWide, isDirectorScoped, assertCourseOfferingInScope, getEffectiveWorkspaceRole } from "./accessScope.service";
import { courseOfferingWorkspaceWhere, WorkspaceContextFilterInput } from "../utils/workspaceScopeFilters";
import {
  CreateSessionInput,
  UpdateRecordsInput,
} from "../validators/attendanceSession.validators";

function isAdmin(user: AuthenticatedUser): boolean {
  // Scope-aware institutional workspace roles only; the active role remains
  // the policy boundary even when permissions from secondary roles exist.
  return ["SUPER_ADMIN", "INSTITUTION_ADMIN", "CHAIRMAN", "MANAGEMENT", "REGISTRAR"].includes(getEffectiveWorkspaceRole(user));
}

async function assertCanManageOffering(
  institutionId: string,
  user: AuthenticatedUser,
  courseOfferingId: string,
  facultyId: string | null,
): Promise<void> {
  if (isAdmin(user)) return;
  if (getEffectiveWorkspaceRole(user) === "FACULTY") {
    if (facultyId !== user.id) {
      throw new AppError("You are not the assigned faculty for this course offering", 403);
    }
    return;
  }
  if (["DIRECTOR", "DEAN", "HOD"].includes(getEffectiveWorkspaceRole(user))) {
    await assertCourseOfferingInScope(institutionId, user, courseOfferingId);
    return;
  }
  throw new AppError("This course offering is outside your attendance-management scope", 403);
}

async function loadCourseOfferingForInstitution(
  institutionId: string,
  courseOfferingId: string
) {
  const offering = await prisma.courseOffering.findFirst({
    where: {
      id: courseOfferingId,
      institutionId,
      isActive: true,
    },
    include: {
      course: { select: { id: true, code: true, name: true } },
      section: { select: { id: true, name: true } },
    },
  });

  if (!offering) {
    throw new AppError(
      "Course offering was not found, is inactive, or does not belong to this institution",
      404
    );
  }

  return offering;
}

async function getRoster(institutionId: string, courseOfferingId: string) {
  return getCourseOfferingRoster(institutionId, courseOfferingId);
}

const sessionInclude = {
  courseOffering: {
    include: {
      course: { select: { id: true, code: true, name: true } },
      section: { select: { id: true, name: true } },
    },
  },
  records: {
    include: {
      student: { select: { id: true, firstName: true, lastName: true } },
    },
  },
} satisfies Prisma.AttendanceSessionInclude;

type SessionWithIncludes = Prisma.AttendanceSessionGetPayload<{
  include: typeof sessionInclude;
}>;

async function withRoster(
  institutionId: string,
  session: SessionWithIncludes
) {
  const roster = await getRoster(institutionId, session.courseOfferingId);
  const recordByStudent = new Map(
    session.records.map((record) => [record.studentId, record.status])
  );

  return {
    ...session,
    roster: roster.map((student) => ({
      ...student,
      status: recordByStudent.get(student.studentId) ?? null,
    })),
  };
}

export async function getOrCreateSession(
  institutionId: string,
  user: AuthenticatedUser,
  input: CreateSessionInput
) {
  const offering = await loadCourseOfferingForInstitution(
    institutionId,
    input.courseOfferingId
  );

  await assertCanManageOffering(institutionId, user, offering.id, offering.facultyId);

  const existing = await prisma.attendanceSession.findFirst({
    where: {
      institutionId,
      courseOfferingId: input.courseOfferingId,
      sessionDate: input.sessionDate,
    },
    include: sessionInclude,
  });

  const session =
    existing ??
    (await prisma.attendanceSession.create({
      data: {
        institutionId,
        courseOfferingId: input.courseOfferingId,
        // Keep ownership tied to the actual course assignment.
        // If an admin opens a session for an unassigned offering,
        // the admin becomes the session owner.
        facultyId: offering.facultyId ?? user.id,
        sessionDate: input.sessionDate,
      },
      include: sessionInclude,
    }));

  return withRoster(institutionId, session);
}

export async function getSessionById(
  institutionId: string,
  user: AuthenticatedUser,
  id: string
) {
  const session = await prisma.attendanceSession.findFirst({
    where: { id, institutionId },
    include: sessionInclude,
  });

  if (!session) {
    throw new AppError("Attendance session not found", 404);
  }

  await assertCanManageOffering(institutionId, user, session.courseOfferingId, session.courseOffering.facultyId);

  return withRoster(institutionId, session);
}

/**
 * Attendance is intentionally idempotent. Sending a subset of records
 * updates only those students; sending the full roster performs a
 * complete save. Submission is a workflow state, not a permanent lock,
 * so authorised faculty/admins can correct a mistake later.
 */
export async function upsertRecords(
  institutionId: string,
  user: AuthenticatedUser,
  sessionId: string,
  input: UpdateRecordsInput
) {
  const session = await prisma.attendanceSession.findFirst({
    where: { id: sessionId, institutionId },
    include: {
      courseOffering: {
        select: {
          id: true,
          facultyId: true,
        },
      },
    },
  });

  if (!session) {
    throw new AppError("Attendance session not found", 404);
  }

  await assertCanManageOffering(institutionId, user, session.courseOfferingId, session.courseOffering.facultyId);

  /*
   * Finalised attendance is evidence. Once a session is locked the only
   * route to a different record is an approved correction request
   * (attendancePolicy.service), which writes the change itself.
   */
  if (session.isLocked) {
    throw new AppError(
      "This attendance session is locked. Raise a correction request to change it.",
      409
    );
  }

  const roster = await getRoster(
    institutionId,
    session.courseOffering.id
  );
  const rosterIds = new Set(roster.map((student) => student.studentId));

  const uniqueStudentIds = new Set<string>();
  for (const record of input.records) {
    if (uniqueStudentIds.has(record.studentId)) {
      throw new AppError(
        "A student cannot appear more than once in the same attendance save",
        400
      );
    }
    uniqueStudentIds.add(record.studentId);
  }

  const invalid = input.records.filter(
    (record) => !rosterIds.has(record.studentId)
  );

  if (invalid.length > 0) {
    throw new AppError(
      `${invalid.length} student(s) are not enrolled in this course offering`,
      400
    );
  }

  const wasSubmitted = session.isSubmitted;

  await prisma.$transaction(
    input.records.map((record) =>
      prisma.attendanceRecord.upsert({
        where: {
          attendanceSessionId_studentId: {
            attendanceSessionId: sessionId,
            studentId: record.studentId,
          },
        },
        update: {
          status: record.status,
          markedAt: new Date(),
        },
        create: {
          attendanceSessionId: sessionId,
          studentId: record.studentId,
          status: record.status,
        },
      })
    )
  );

  if (input.submit) {
    await prisma.attendanceSession.update({
      where: { id: sessionId },
      data: {
        isSubmitted: true,
        submittedAt: new Date(),
      },
    });
  }

  await recordAuditLog({
    institutionId,
    userId: user.id,
    action: wasSubmitted ? "attendance.correct" : input.submit ? "attendance.submit" : "attendance.draft_update",
    entityType: "AttendanceSession",
    entityId: sessionId,
    metadata: { recordCount: input.records.length },
  });

  return getSessionById(institutionId, user, sessionId);
}

export interface ListFilters extends PaginationParams, WorkspaceContextFilterInput {
  courseOfferingId?: string;
  facultyId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  isSubmitted?: boolean;
}

export async function listSessions(
  institutionId: string,
  user: AuthenticatedUser,
  filters: ListFilters
) {
  let where: Prisma.AttendanceSessionWhereInput = {
    institutionId,
    ...(filters.courseOfferingId
      ? { courseOfferingId: filters.courseOfferingId }
      : {}),
    ...(filters.facultyId ? { facultyId: filters.facultyId } : {}),
    ...(filters.isSubmitted !== undefined
      ? { isSubmitted: filters.isSubmitted }
      : {}),
    ...(filters.dateFrom || filters.dateTo
      ? {
          sessionDate: {
            ...(filters.dateFrom ? { gte: filters.dateFrom } : {}),
            ...(filters.dateTo ? { lte: filters.dateTo } : {}),
          },
        }
      : {}),
  };

  if (isInstitutionWide(user) && !isDirectorScoped(user)) {
    // Institution-wide reporting scope. Chairman wins over any secondary Director role.
  } else if (isDirectorScoped(user)) {
    const departmentIds = await getDirectorDepartmentIds(institutionId, user.id);
    where.courseOffering = {
      semester: { program: { departmentId: { in: departmentIds.length ? departmentIds : ["__NO_AUTHORIZED_SCOPE__"] } } },
    };
  } else if (getEffectiveWorkspaceRole(user) === "HOD" || getEffectiveWorkspaceRole(user) === "DEAN") {
    const departmentIds = await getManagedDepartmentIds(institutionId, user.id);
    where.courseOffering = {
      course: { departmentId: { in: departmentIds.length ? departmentIds : ["__NO_AUTHORIZED_SCOPE__"] } },
    };
  } else if (getEffectiveWorkspaceRole(user) === "FACULTY") {
    if (filters.facultyId && filters.facultyId !== user.id) {
      throw new AppError("Faculty may only view their own attendance sessions", 403);
    }
    where.facultyId = user.id;
  } else {
    throw new AppError("Attendance history is not available for this role", 403);
  }

  const contextOfferingWhere = courseOfferingWorkspaceWhere(institutionId, filters);
  if (contextOfferingWhere) {
    // Intersect context with the role-derived offering/faculty boundary.
    where = { AND: [where, { courseOffering: contextOfferingWhere }] };
  }

  const [items, total] = await Promise.all([
    prisma.attendanceSession.findMany({
      where,
      skip: filters.skip,
      take: filters.take,
      orderBy: [{ sessionDate: "desc" }, { createdAt: "desc" }],
      include: sessionInclude,
    }),
    prisma.attendanceSession.count({ where }),
  ]);

  return { items, total };
}
