import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";
import { AuthenticatedUser } from "../types/auth";
import { PaginationParams } from "../utils/pagination";
import { getCourseOfferingRoster, getCourseOfferingRosterIds } from "../utils/academicRoster";
import {
  CreateSessionInput,
  UpdateRecordsInput,
} from "../validators/attendanceSession.validators";

const ADMIN_ROLES = ["SUPER_ADMIN", "INSTITUTION_ADMIN"];

/**
 * A permission like `attendance.mark` says a role CAN mark
 * attendance somewhere — it doesn't say where. Ownership is
 * enforced here, separately: a FACULTY user may only manage
 * sessions for course offerings they are actually assigned to;
 * institution/platform admins may manage any session in their
 * institution (e.g. covering for an absent faculty member).
 */
function assertCanManageOffering(
  user: AuthenticatedUser,
  facultyId: string | null
): void {
  const isAdmin = user.roles.some((r) => ADMIN_ROLES.includes(r));
  if (isAdmin) return;
  if (facultyId && facultyId === user.id) return;
  throw new AppError(
    "You are not the assigned faculty for this course offering",
    403
  );
}

async function loadCourseOfferingForInstitution(
  institutionId: string,
  courseOfferingId: string
) {
  const offering = await prisma.courseOffering.findFirst({
    where: { id: courseOfferingId, institutionId },
    include: {
      course: { select: { id: true, code: true, name: true } },
      section: { select: { id: true, name: true } },
    },
  });
  if (!offering) {
    throw new AppError(
      "courseOfferingId does not belong to this institution",
      400
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

/** Combines a session's saved records with the full section roster,
 *  so students with no record yet still appear (status: null). */
async function withRoster(institutionId: string, session: SessionWithIncludes) {
  const roster = await getRoster(institutionId, session.courseOfferingId);
  const recordByStudent = new Map<string, string>(
    session.records.map((r) => [r.studentId, r.status])
  );

  return {
    ...session,
    roster: roster.map((r) => ({
      ...r,
      status: recordByStudent.get(r.studentId) ?? null,
    })),
  };
}

/**
 * Get-or-create: opening the same courseOffering+date twice returns
 * the same session instead of erroring, so a faculty member
 * navigating back into "today's" attendance never hits a conflict.
 */
export async function getOrCreateSession(
  institutionId: string,
  user: AuthenticatedUser,
  input: CreateSessionInput
) {
  const offering = await loadCourseOfferingForInstitution(
    institutionId,
    input.courseOfferingId
  );
  assertCanManageOffering(user, offering.facultyId);

  const existing = await prisma.attendanceSession.findFirst({
    where: {
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
        facultyId: user.id,
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
  assertCanManageOffering(user, session.courseOffering.facultyId);
  return withRoster(institutionId, session);
}

/**
 * Bulk upsert (covers both "Present All" bulk actions and single-
 * student corrections — the caller just sends however many records
 * changed). Every studentId is validated against the section's real
 * roster so a faculty member can't mark attendance for a student who
 * isn't enrolled in that section.
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
      courseOffering: { select: { facultyId: true, sectionId: true } },
    },
  });
  if (!session) {
    throw new AppError("Attendance session not found", 404);
  }
  assertCanManageOffering(user, session.courseOffering.facultyId);

  const roster = await getRoster(institutionId, session.courseOffering.sectionId);
  const rosterIds = new Set(roster.map((r) => r.studentId));

  const invalid = input.records.filter((r) => !rosterIds.has(r.studentId));
  if (invalid.length > 0) {
    throw new AppError(
      `${invalid.length} student(s) in this submission are not enrolled in this section`,
      400
    );
  }

  await prisma.$transaction(
    input.records.map((r) =>
      prisma.attendanceRecord.upsert({
        where: {
          attendanceSessionId_studentId: {
            attendanceSessionId: sessionId,
            studentId: r.studentId,
          },
        },
        update: { status: r.status, markedAt: new Date() },
        create: {
          attendanceSessionId: sessionId,
          studentId: r.studentId,
          status: r.status,
        },
      })
    )
  );

  if (input.submit) {
    await prisma.attendanceSession.update({
      where: { id: sessionId },
      data: { isSubmitted: true, submittedAt: new Date() },
    });
  }

  return getSessionById(institutionId, user, sessionId);
}

export interface ListFilters extends PaginationParams {
  courseOfferingId?: string;
  facultyId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  isSubmitted?: boolean;
}

export async function listSessions(institutionId: string, filters: ListFilters) {
  const where = {
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

  const [items, total] = await Promise.all([
    prisma.attendanceSession.findMany({
      where,
      skip: filters.skip,
      take: filters.take,
      orderBy: { sessionDate: "desc" },
      include: sessionInclude,
    }),
    prisma.attendanceSession.count({ where }),
  ]);

  return { items, total };
}
