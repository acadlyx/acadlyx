import { prisma } from "../lib/prisma";

/**
 * REAL data access for the faculty portal. Everything here comes
 * straight from the database, scoped to the institution embedded in
 * the caller's access token AND to the calling faculty member's own
 * assignments — this file never returns another faculty member's
 * data, regardless of what the caller's RBAC permissions allow.
 */

const offeringInclude = {
  course: { select: { id: true, code: true, name: true, credits: true } },
  section: { select: { id: true, name: true } },
  semester: {
    select: {
      id: true,
      number: true,
      name: true,
      program: { select: { id: true, name: true, code: true } },
      academicYear: { select: { id: true, name: true, isCurrent: true } },
    },
  },
} as const;

export async function getMyCourseOfferings(
  institutionId: string,
  facultyId: string
) {
  return prisma.courseOffering.findMany({
    where: { institutionId, facultyId, isActive: true },
    include: offeringInclude,
    orderBy: [{ semester: { number: "desc" } }, { course: { code: "asc" } }],
  });
}

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Per-assigned-section attendance snapshot for a given date
 * (defaults to today): roster size, how many are marked present so
 * far, and whether the session has been submitted. If no session
 * exists yet for that date, the section is reported as "not started"
 * rather than 0/roster (0/roster would misleadingly look like every
 * student was marked absent).
 */
export async function getAttendanceOverview(
  institutionId: string,
  facultyId: string,
  date: Date = new Date()
) {
  const offerings = await getMyCourseOfferings(institutionId, facultyId);
  const day = startOfDay(date);

  const overview = await Promise.all(
    offerings.map(async (offering) => {
      const [rosterSize, session] = await Promise.all([
        prisma.studentEnrollment.count({
          where: {
            institutionId,
            sectionId: offering.section.id,
            status: "ACTIVE",
          },
        }),
        prisma.attendanceSession.findFirst({
          where: { courseOfferingId: offering.id, sessionDate: day },
          include: { _count: { select: { records: true } } },
        }),
      ]);

      const presentCount = session
        ? await prisma.attendanceRecord.count({
            where: { attendanceSessionId: session.id, status: "PRESENT" },
          })
        : 0;

      return {
        courseOfferingId: offering.id,
        courseCode: offering.course.code,
        sectionName: offering.section.name,
        rosterSize,
        presentCount,
        sessionId: session?.id ?? null,
        isStarted: session !== null,
        isSubmitted: session?.isSubmitted ?? false,
      };
    })
  );

  return overview;
}

/**
 * Every student across this faculty's sections whose recorded
 * attendance (present / total recorded sessions) is below the given
 * threshold. Purely a live aggregation of real AttendanceRecord rows
 * — a transparent rule (a percentage threshold), not a prediction.
 */
export async function getAtRiskStudents(
  institutionId: string,
  facultyId: string,
  thresholdPercent = 75
) {
  const offerings = await prisma.courseOffering.findMany({
    where: { institutionId, facultyId, isActive: true },
    select: { id: true },
  });
  const offeringIds = offerings.map((o) => o.id);
  if (offeringIds.length === 0) return { count: 0, students: [] };

  const records = await prisma.attendanceRecord.findMany({
    where: {
      attendanceSession: { courseOfferingId: { in: offeringIds } },
    },
    select: {
      status: true,
      studentId: true,
      student: { select: { firstName: true, lastName: true } },
    },
  });

  const byStudent = new Map<
    string,
    { name: string; present: number; total: number }
  >();

  for (const r of records) {
    const entry = byStudent.get(r.studentId) ?? {
      name: `${r.student.firstName} ${r.student.lastName}`,
      present: 0,
      total: 0,
    };
    entry.total += 1;
    if (r.status === "PRESENT") entry.present += 1;
    byStudent.set(r.studentId, entry);
  }

  const atRisk = Array.from(byStudent.entries())
    .map(([studentId, v]) => ({
      studentId,
      name: v.name,
      percentage: v.total > 0 ? Math.round((v.present / v.total) * 100) : 0,
    }))
    .filter((s) => s.percentage < thresholdPercent)
    .sort((a, b) => a.percentage - b.percentage);

  return { count: atRisk.length, students: atRisk.slice(0, 5) };
}

export async function getPendingAttendanceCount(
  institutionId: string,
  facultyId: string,
  date: Date = new Date()
): Promise<number> {
  const overview = await getAttendanceOverview(institutionId, facultyId, date);
  return overview.filter((o) => !o.isSubmitted).length;
}

/** Real count: submissions awaiting review (SUBMITTED or LATE, not yet REVIEWED) across this faculty's assignments. */
export async function getPendingAssignmentReviewCount(
  institutionId: string,
  facultyId: string
): Promise<number> {
  return prisma.assignmentSubmission.count({
    where: {
      institutionId,
      status: { in: ["SUBMITTED", "LATE"] },
      assignment: { courseOffering: { facultyId } },
    },
  });
}

/**
 * Real "N students haven't submitted <assignment>" gaps: for each of
 * this faculty's PUBLISHED assignments, roster size minus submission
 * count. Only assignments with at least one missing submission are
 * returned, most-missing first.
 */
export async function getAssignmentSubmissionGaps(
  institutionId: string,
  facultyId: string,
  limit = 5
) {
  const assignments = await prisma.assignment.findMany({
    where: {
      institutionId,
      status: "PUBLISHED",
      courseOffering: { facultyId },
    },
    include: {
      courseOffering: {
        select: { sectionId: true, course: { select: { code: true } } },
      },
      _count: { select: { submissions: true } },
    },
  });

  const gaps = await Promise.all(
    assignments.map(async (a) => {
      const rosterSize = await prisma.studentEnrollment.count({
        where: {
          institutionId,
          sectionId: a.courseOffering.sectionId,
          status: "ACTIVE",
        },
      });
      return {
        courseCode: a.courseOffering.course.code,
        assignmentTitle: a.title,
        missingCount: Math.max(0, rosterSize - a._count.submissions),
      };
    })
  );

  return gaps
    .filter((g) => g.missingCount > 0)
    .sort((a, b) => b.missingCount - a.missingCount)
    .slice(0, limit);
}
