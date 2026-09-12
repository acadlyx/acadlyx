import { prisma } from "../lib/prisma";

/**
 * Dynamic attendance calculation — nothing here is stored; every
 * percentage is computed on read from real AttendanceRecord rows.
 * Shared by the student self-service views (this phase) and
 * whatever HOD/management rollups come later — the aggregation
 * logic lives in exactly one place.
 */

export interface SubjectAttendance {
  courseOfferingId: string;
  courseCode: string;
  courseName: string;
  present: number;
  total: number;
  percentage: number;
}

export interface StudentAttendanceSummary {
  overallPercentage: number;
  totalSessions: number;
  totalPresent: number;
  subjects: SubjectAttendance[];
}

export async function getStudentAttendanceSummary(
  institutionId: string,
  studentId: string
): Promise<StudentAttendanceSummary> {
  const records = await prisma.attendanceRecord.findMany({
    where: {
      studentId,
      attendanceSession: { institutionId },
    },
    select: {
      status: true,
      attendanceSession: {
        select: {
          courseOffering: {
            select: {
              id: true,
              course: { select: { code: true, name: true } },
            },
          },
        },
      },
    },
  });

  const bySubject = new Map<
    string,
    { courseCode: string; courseName: string; present: number; total: number }
  >();

  for (const r of records) {
    const offering = r.attendanceSession.courseOffering;
    const entry = bySubject.get(offering.id) ?? {
      courseCode: offering.course.code,
      courseName: offering.course.name,
      present: 0,
      total: 0,
    };
    entry.total += 1;
    if (r.status === "PRESENT") entry.present += 1;
    bySubject.set(offering.id, entry);
  }

  const subjects: SubjectAttendance[] = Array.from(bySubject.entries()).map(
    ([courseOfferingId, v]) => ({
      courseOfferingId,
      courseCode: v.courseCode,
      courseName: v.courseName,
      present: v.present,
      total: v.total,
      percentage: v.total > 0 ? Math.round((v.present / v.total) * 100) : 0,
    })
  );

  const totalPresent = subjects.reduce((sum, s) => sum + s.present, 0);
  const totalSessions = subjects.reduce((sum, s) => sum + s.total, 0);

  return {
    overallPercentage:
      totalSessions > 0 ? Math.round((totalPresent / totalSessions) * 100) : 0,
    totalSessions,
    totalPresent,
    subjects: subjects.sort((a, b) => a.courseCode.localeCompare(b.courseCode)),
  };
}
