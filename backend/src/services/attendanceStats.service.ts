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
  const records = await prisma.attendanceRecord.findMany({
    where: {
      studentId,
      attendanceSession: {
        institutionId,
        isSubmitted: true,
      },
    },
    select: {
      status: true,
      attendanceSession: {
        select: {
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
      },
    },
  });

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

  for (const record of records) {
    const offering = record.attendanceSession.courseOffering;
    const entry = bySubject.get(offering.id) ?? {
      courseCode: offering.course.code,
      courseName: offering.course.name,
      present: 0,
      late: 0,
      absent: 0,
    };

    if (record.status === "PRESENT") entry.present += 1;
    else if (record.status === "LATE") entry.late += 1;
    else entry.absent += 1;

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
        // Late is not counted as fully present.
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
