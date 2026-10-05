import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";

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

/**
 * Resolve the faculty identity strictly inside the authenticated tenant.
 * Faculty portal methods must never operate on an arbitrary user id.
 */
async function assertFacultyInInstitution(
  institutionId: string,
  facultyId: string
): Promise<void> {
  const faculty = await prisma.user.findFirst({
    where: {
      id: facultyId,
      institutionId,
      isActive: true,
      userRoles: {
        some: {
          role: { name: "FACULTY" },
        },
      },
    },
    select: { id: true },
  });

  if (!faculty) {
    throw new AppError(
      "Faculty user is not active in this institution",
      403
    );
  }
}

export async function getMyCourseOfferings(
  institutionId: string,
  facultyId: string
) {
  await assertFacultyInInstitution(institutionId, facultyId);

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
  date: Date = new Date(),
  offeringsOverride?: Awaited<ReturnType<typeof getMyCourseOfferings>>,
) {
  const offerings =
    offeringsOverride ?? (await getMyCourseOfferings(institutionId, facultyId));
  const day = startOfDay(date);
  if (offerings.length === 0) return [];

  const offeringIds = offerings.map((offering) => offering.id);
  const sectionIds = [...new Set(offerings.map((offering) => offering.section.id))];

  const [rosterRows, sessions] = await Promise.all([
    prisma.studentEnrollment.groupBy({
      by: ["sectionId"],
      where: {
        institutionId,
        sectionId: { in: sectionIds },
        status: "ACTIVE",
      },
      _count: { _all: true },
    }),
    prisma.attendanceSession.findMany({
      where: {
        institutionId,
        courseOfferingId: { in: offeringIds },
        sessionDate: day,
      },
      select: {
        id: true,
        courseOfferingId: true,
        isSubmitted: true,
        _count: { select: { records: true } },
      },
    }),
  ]);

  const sessionIds = sessions.map((session) => session.id);
  const presentRows = sessionIds.length
    ? await prisma.attendanceRecord.groupBy({
        by: ["attendanceSessionId"],
        where: {
          attendanceSessionId: { in: sessionIds },
          status: "PRESENT",
        },
        _count: { _all: true },
      })
    : [];

  const rosterBySection = new Map(
    rosterRows.map((row) => [row.sectionId, row._count._all]),
  );
  const sessionByOffering = new Map(
    sessions.map((session) => [session.courseOfferingId, session]),
  );
  const presentBySession = new Map(
    presentRows.map((row) => [row.attendanceSessionId, row._count._all]),
  );

  return offerings.map((offering) => {
    const session = sessionByOffering.get(offering.id);
    return {
      courseOfferingId: offering.id,
      courseCode: offering.course.code,
      sectionName: offering.section.name,
      rosterSize: rosterBySection.get(offering.section.id) ?? 0,
      presentCount: session ? presentBySession.get(session.id) ?? 0 : 0,
      sessionId: session?.id ?? null,
      isStarted: session !== undefined,
      isSubmitted: session?.isSubmitted ?? false,
    };
  });
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
  await assertFacultyInInstitution(institutionId, facultyId);

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
  await assertFacultyInInstitution(institutionId, facultyId);

  const overview = await getAttendanceOverview(institutionId, facultyId, date);
  return overview.filter((o) => !o.isSubmitted).length;
}

/** Real count: submissions awaiting review (SUBMITTED or LATE, not yet REVIEWED) across this faculty's assignments. */
export async function getPendingAssignmentReviewCount(
  institutionId: string,
  facultyId: string
): Promise<number> {
  await assertFacultyInInstitution(institutionId, facultyId);

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
  limit = 5,
  offeringsOverride?: Awaited<ReturnType<typeof getMyCourseOfferings>>,
) {
  const offerings =
    offeringsOverride ?? (await getMyCourseOfferings(institutionId, facultyId));
  const offeringIds = offerings.map((offering) => offering.id);
  if (offeringIds.length === 0) return [];

  const assignments = await prisma.assignment.findMany({
    where: {
      institutionId,
      status: "PUBLISHED",
      courseOfferingId: { in: offeringIds },
    },
    select: {
      title: true,
      courseOfferingId: true,
      _count: { select: { submissions: true } },
    },
  });

  const sectionIds = [
    ...new Set(
      offerings
        .filter((offering) => assignments.some((assignment) => assignment.courseOfferingId === offering.id))
        .map((offering) => offering.section.id),
    ),
  ];
  const rosterRows = sectionIds.length
    ? await prisma.studentEnrollment.groupBy({
        by: ["sectionId"],
        where: {
          institutionId,
          sectionId: { in: sectionIds },
          status: "ACTIVE",
        },
        _count: { _all: true },
      })
    : [];
  const rosterBySection = new Map(
    rosterRows.map((row) => [row.sectionId, row._count._all]),
  );
  const offeringById = new Map(offerings.map((offering) => [offering.id, offering]));

  return assignments
    .map((assignment) => {
      const offering = offeringById.get(assignment.courseOfferingId);
      if (!offering) return null;
      return {
        courseCode: offering.course.code,
        assignmentTitle: assignment.title,
        missingCount: Math.max(
          0,
          (rosterBySection.get(offering.section.id) ?? 0) -
            assignment._count.submissions,
        ),
      };
    })
    .filter((gap): gap is NonNullable<typeof gap> => gap !== null && gap.missingCount > 0)
    .sort((a, b) => b.missingCount - a.missingCount)
    .slice(0, Math.max(1, Math.min(limit, 20)));
}
