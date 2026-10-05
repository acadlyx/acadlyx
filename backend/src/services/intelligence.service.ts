import { prisma } from "../lib/prisma";
import { Prisma } from "@prisma/client";

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

const round = (value: number) => Math.round(value * 10) / 10;
const riskFromScore = (score: number): RiskLevel =>
  score < 45 ? "CRITICAL" : score < 60 ? "HIGH" : score < 75 ? "MEDIUM" : "LOW";

/** Rule-based seam: callers receive this contract regardless of a future ML implementation. */
export async function getStudentIntelligence(institutionId: string, studentId: string) {
  const [student, attendance, assignments, marks, skills] = await Promise.all([
    prisma.user.findFirst({ where: { id: studentId, institutionId }, select: { id: true, firstName: true, lastName: true } }),
    prisma.attendanceRecord.findMany({ where: { studentId, attendanceSession: { institutionId, isSubmitted: true } }, select: { status: true, attendanceSession: { select: { courseOffering: { select: { course: { select: { code: true, name: true } } } } } } } }),
    prisma.assignment.findMany({ where: { institutionId, status: "PUBLISHED", courseOffering: { section: { studentEnrollments: { some: { userId: studentId } } } } }, select: { id: true, title: true, dueDate: true, courseOffering: { select: { course: { select: { code: true } } } }, submissions: { where: { studentId }, select: { id: true } } } }),
    prisma.internalMark.aggregate({ where: { institutionId, studentId }, _avg: { marksObtained: true, maxMarks: true } }),
    prisma.studentSkill.count({ where: { institutionId, studentId, proficiency: { gte: 60 } } }),
  ]);
  if (!student) return null;

  const byCourse = new Map<string, { present: number; total: number; name: string }>();
  for (const row of attendance) {
    const c = row.attendanceSession.courseOffering.course;
    const item = byCourse.get(c.code) || { present: 0, total: 0, name: c.name };
    item.total += 1; if (row.status === "PRESENT") item.present += 1; byCourse.set(c.code, item);
  }
  const present = [...byCourse.values()].reduce((n, x) => n + x.present, 0);
  const sessions = [...byCourse.values()].reduce((n, x) => n + x.total, 0);
  const attendanceScore = sessions ? round((present / sessions) * 100) : 0;
  const due = assignments.filter(a => a.dueDate < new Date());
  const overdue = due.filter(a => a.submissions.length === 0);
  const assignmentScore = assignments.length ? round(((assignments.length - overdue.length) / assignments.length) * 100) : 100;
  const marksScore = marks._avg.maxMarks && marks._avg.marksObtained ? round((marks._avg.marksObtained / marks._avg.maxMarks) * 100) : 0;
  const engagementScore = Math.min(100, 50 + skills * 10); // verified skill evidence is the current real proxy
  const healthScore = round(attendanceScore * .35 + assignmentScore * .25 + marksScore * .25 + engagementScore * .15);
  const subjectWarnings = [...byCourse.entries()].filter(([, v]) => v.total && v.present / v.total < .75);
  const recommendations = [
    ...subjectWarnings.map(([code, x]) => `${x.present / x.total < .6 ? "Improve" : "Monitor"} ${code} attendance`),
    ...overdue.map(a => `Submit pending ${a.courseOffering.course.code} assignment: ${a.title}`),
    ...(marksScore && marksScore < 60 ? ["Meet your faculty mentor to improve internal marks"] : []),
    ...(skills < 2 ? ["Add verified skills to improve career readiness"] : []),
  ].slice(0, 6);
  return { student, scores: { attendance: attendanceScore, assignments: assignmentScore, internalMarks: marksScore, engagement: engagementScore, academicHealth: healthScore }, risk: riskFromScore(healthScore), reasons: { lowAttendanceSubjects: subjectWarnings.map(([code]) => code), overdueAssignments: overdue.length, marksBelowTarget: marksScore > 0 && marksScore < 60 }, recommendations };
}

export async function getInstitutionInsights(institutionId: string, filters: { departmentId?: string; programId?: string; semesterId?: string; from?: Date; to?: Date } = {}) {
  const enrollmentWhere = { institutionId, ...(filters.programId ? { programId: filters.programId } : {}), ...(filters.departmentId ? { program: { departmentId: filters.departmentId } } : {}), ...(filters.semesterId ? { section: { semesterId: filters.semesterId } } : {}) };
  const courseOfferingFilter: Prisma.CourseOfferingWhereInput = {
    ...(filters.departmentId
      ? { course: { departmentId: filters.departmentId } }
      : {}),
    ...(filters.programId
      ? { semester: { programId: filters.programId } }
      : {}),
    ...(filters.semesterId
      ? { semesterId: filters.semesterId }
      : {}),
  };

  const assignmentWhere: Prisma.AssignmentWhereInput = {
    institutionId,
    status: "PUBLISHED",
    dueDate: { lt: new Date() },
    submissions: { none: {} },
    ...(Object.keys(courseOfferingFilter).length > 0
      ? { courseOffering: courseOfferingFilter }
      : {}),
  };

  const facultyOfferingFilter: Prisma.CourseOfferingWhereInput = {
    ...(filters.departmentId
      ? { course: { departmentId: filters.departmentId } }
      : {}),
    ...(filters.programId
      ? { semester: { programId: filters.programId } }
      : {}),
    ...(filters.semesterId
      ? { semesterId: filters.semesterId }
      : {}),
  };

  const attendanceCourseOfferingFilter: Prisma.CourseOfferingWhereInput =
    facultyOfferingFilter;

  const [students, departments, faculty, attendance, pendingAssignments] = await Promise.all([
    prisma.studentEnrollment.count({ where: enrollmentWhere }),
    prisma.department.count({ where: { institutionId, ...(filters.departmentId ? { id: filters.departmentId } : {}) } }),
    prisma.user.count({ where: { institutionId, facultyCourseOfferings: { some: facultyOfferingFilter } } }),
    prisma.attendanceRecord.groupBy({
      by: ["status"],
      where: {
        attendanceSession: {
          institutionId,
          ...(Object.keys(attendanceCourseOfferingFilter).length > 0
            ? { courseOffering: attendanceCourseOfferingFilter }
            : {}),
          ...((filters.from || filters.to)
            ? {
                sessionDate: {
                  ...(filters.from ? { gte: filters.from } : {}),
                  ...(filters.to ? { lte: filters.to } : {}),
                },
              }
            : {}),
        },
      },
      _count: { _all: true },
    }),
    prisma.assignment.count({ where: assignmentWhere }),
  ]);
  const totalAttendance = attendance.reduce((n, x) => n + x._count._all, 0);
  const present = attendance.find(x => x.status === "PRESENT")?._count._all || 0;
  const attendanceRate = totalAttendance ? round(present / totalAttendance * 100) : 0;
  return { kpis: { students, faculty, departments, attendance: attendanceRate, pendingAssignments }, filters, recommendedActions: [
    ...(attendanceRate < 75 ? ["Prioritize attendance recovery plans for below-target cohorts"] : []),
    ...(pendingAssignments ? ["Review overdue assignment completion with faculty mentors"] : []),
  ] };
}

export async function getAtRiskStudents(institutionId: string, departmentIds?: string[], limit = 20) {
  const safeLimit = Math.min(Math.max(Math.trunc(limit) || 20, 1), 50);
  const enrollments = await prisma.studentEnrollment.findMany({
    where: {
      institutionId,
      ...(departmentIds
        ? { program: { departmentId: { in: departmentIds } } }
        : {}),
    },
    select: { userId: true },
    take: safeLimit * 3,
    distinct: ["userId"],
  });

  if (enrollments.length === 0) return [];

  // Batch the raw signals once instead of running five Prisma queries per
  // candidate. This keeps connection usage bounded and makes the cost scale
  // with the candidate set rather than query count per student.
  const studentIds = enrollments.map((row) => row.userId);
  const now = new Date();

  const [students, attendance, assignments, marks, skills] = await Promise.all([
    prisma.user.findMany({
      where: { institutionId, id: { in: studentIds } },
      select: { id: true, firstName: true, lastName: true },
    }),
    prisma.attendanceRecord.findMany({
      where: {
        studentId: { in: studentIds },
        attendanceSession: { institutionId, isSubmitted: true },
      },
      select: {
        studentId: true,
        status: true,
        attendanceSession: {
          select: {
            courseOffering: {
              select: { course: { select: { code: true, name: true } } },
            },
          },
        },
      },
    }),
    prisma.assignment.findMany({
      where: {
        institutionId,
        status: "PUBLISHED",
        courseOffering: {
          section: { studentEnrollments: { some: { userId: { in: studentIds } } } },
        },
      },
      select: {
        id: true,
        title: true,
        dueDate: true,
        courseOffering: { select: { course: { select: { code: true } } } },
        submissions: {
          where: { studentId: { in: studentIds } },
          select: { studentId: true },
        },
      },
    }),
    prisma.internalMark.groupBy({
      by: ["studentId"],
      where: { institutionId, studentId: { in: studentIds } },
      _avg: { marksObtained: true, maxMarks: true },
    }),
    prisma.studentSkill.groupBy({
      by: ["studentId"],
      where: { institutionId, studentId: { in: studentIds }, proficiency: { gte: 60 } },
      _count: { _all: true },
    }),
  ]);

  const studentById = new Map(students.map((student) => [student.id, student]));
  const attendanceByStudent = new Map<string, Map<string, { present: number; total: number; name: string }>>();
  for (const row of attendance) {
    const course = row.attendanceSession.courseOffering.course;
    const byCourse = attendanceByStudent.get(row.studentId) ?? new Map();
    const item = byCourse.get(course.code) ?? { present: 0, total: 0, name: course.name };
    item.total += 1;
    if (row.status === "PRESENT") item.present += 1;
    byCourse.set(course.code, item);
    attendanceByStudent.set(row.studentId, byCourse);
  }

  const marksByStudent = new Map(marks.map((row) => [row.studentId, row]));
  const skillsByStudent = new Map(skills.map((row) => [row.studentId, row._count._all]));
  const result = students.map((student) => {
    const byCourse = attendanceByStudent.get(student.id) ?? new Map();
    const present = [...byCourse.values()].reduce((n, x) => n + x.present, 0);
    const sessions = [...byCourse.values()].reduce((n, x) => n + x.total, 0);
    const attendanceScore = sessions ? round((present / sessions) * 100) : 0;

    const studentAssignments = assignments.filter((assignment) =>
      assignment.courseOffering.section.studentEnrollments.some(
        (enrollment) => enrollment.userId === student.id,
      ),
    );
    const overdue = studentAssignments.filter(
      (assignment) =>
        assignment.dueDate < now &&
        !assignment.submissions.some(
          (submission) => submission.studentId === student.id,
        ),
    );
    const assignmentScore = studentAssignments.length
      ? round(
          ((studentAssignments.length - overdue.length) /
            studentAssignments.length) *
            100,
        )
      : 100;

    const mark = marksByStudent.get(student.id);
    const marksScore =
      mark?._avg.maxMarks && mark._avg.marksObtained
        ? round((mark._avg.marksObtained / mark._avg.maxMarks) * 100)
        : 0;
    const skillCount = skillsByStudent.get(student.id) ?? 0;
    const engagementScore = Math.min(100, 50 + skillCount * 10);
    const healthScore = round(
      attendanceScore * 0.35 +
        assignmentScore * 0.25 +
        marksScore * 0.25 +
        engagementScore * 0.15,
    );
    const byCourseWarnings = [...byCourse.entries()].filter(
      ([, value]) => value.total && value.present / value.total < 0.75,
    );
    const recommendations = [
      ...[...byCourseWarnings].map(
        ([code, value]) =>
          `${value.present / value.total < 0.6 ? "Improve" : "Monitor"} ${code} attendance`,
      ),
      ...overdue.map(
        (assignment) =>
          `Submit pending ${assignment.courseOffering.course.code} assignment: ${assignment.title}`,
      ),
      ...(marksScore && marksScore < 60
        ? ["Meet your faculty mentor to improve internal marks"]
        : []),
      ...(skillCount < 2 ? ["Add verified skills to improve career readiness"] : []),
    ].slice(0, 6);

    return {
      student,
      scores: {
        attendance: attendanceScore,
        assignments: assignmentScore,
        internalMarks: marksScore,
        engagement: engagementScore,
        academicHealth: healthScore,
      },
      risk: riskFromScore(healthScore),
      reasons: {
        lowAttendanceSubjects: [...byCourseWarnings].map(([code]) => code),
        overdueAssignments: overdue.length,
        marksBelowTarget: marksScore > 0 && marksScore < 60,
      },
      recommendations,
    };
  });

  return result
    .filter((row) => row.risk === "CRITICAL" || row.risk === "HIGH")
    .sort((a, b) => a.scores.academicHealth - b.scores.academicHealth)
    .slice(0, safeLimit);
}
