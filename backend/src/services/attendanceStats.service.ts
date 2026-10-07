import { prisma } from "../lib/prisma";

export interface SubjectAttendance {
  courseOfferingId: string;
  courseCode: string;
  courseName: string;
  present: number;
  late: number;
  absent: number;
  total: number;
  percentage: number;
}

export interface StudentAttendanceSummary {
  overallPercentage: number;
  totalSessions: number;
  totalPresent: number;
  totalLate: number;
  totalAbsent: number;
  subjects: SubjectAttendance[];
}

export async function getStudentAttendanceSummary(
  institutionId: string,
  studentId: string
): Promise<StudentAttendanceSummary> {
  const grouped = await prisma.attendanceRecord.groupBy({
    by: ["attendanceSessionId", "status"],
    where: {
      studentId,
      attendanceSession: {
        institutionId,
        isSubmitted: true,
      },
    },
    _count: { _all: true },
  });

  if (grouped.length === 0) {
    return {
      overallPercentage: 0,
      totalSessions: 0,
      totalPresent: 0,
      totalLate: 0,
      totalAbsent: 0,
      subjects: [],
    };
  }

  const sessionIds = [...new Set(grouped.map((row) => row.attendanceSessionId))];
  const sessions = await prisma.attendanceSession.findMany({
    where: {
      institutionId,
      id: { in: sessionIds },
    },
    select: {
      id: true,
      courseOffering: {
        select: {
          id: true,
          course: {
            select: {
              code: true,
              name: true,
            },
          },
        },
      },
    },
  });

  const sessionById = new Map(sessions.map((session) => [session.id, session]));
  const bySubject = new Map<
    string,
    {
      courseCode: string;
      courseName: string;
      present: number;
      late: number;
      absent: number;
    }
  >();

  for (const row of grouped) {
    const session = sessionById.get(row.attendanceSessionId);
    if (!session) continue;

    const offering = session.courseOffering;
    const entry = bySubject.get(offering.id) ?? {
      courseCode: offering.course.code,
      courseName: offering.course.name,
      present: 0,
      late: 0,
      absent: 0,
    };

    const count = row._count._all;
    if (row.status === "PRESENT") entry.present += count;
    else if (row.status === "LATE") entry.late += count;
    else entry.absent += count;

    bySubject.set(offering.id, entry);
  }

  const subjects: SubjectAttendance[] = Array.from(bySubject.entries()).map(
    ([courseOfferingId, value]) => {
      const total = value.present + value.late + value.absent;

      return {
        courseOfferingId,
        courseCode: value.courseCode,
        courseName: value.courseName,
        present: value.present,
        late: value.late,
        absent: value.absent,
        total,
        percentage: total > 0 ? Math.round((value.present / total) * 100) : 0,
      };
    }
  );

  const totalPresent = subjects.reduce((sum, item) => sum + item.present, 0);
  const totalLate = subjects.reduce((sum, item) => sum + item.late, 0);
  const totalAbsent = subjects.reduce((sum, item) => sum + item.absent, 0);
  const totalSessions = totalPresent + totalLate + totalAbsent;

  return {
    overallPercentage:
      totalSessions > 0
        ? Math.round((totalPresent / totalSessions) * 100)
        : 0,
    totalSessions,
    totalPresent,
    totalLate,
    totalAbsent,
    subjects: subjects.sort((a, b) =>
      a.courseCode.localeCompare(b.courseCode)
    ),
  };
}
