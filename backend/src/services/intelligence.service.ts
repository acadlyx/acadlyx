import { prisma } from "../lib/prisma";

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

const round = (value: number) => Math.round(value * 10) / 10;
const riskFromScore = (score: number): RiskLevel =>
  score < 45 ? "CRITICAL" : score < 60 ? "HIGH" : score < 75 ? "MEDIUM" : "LOW";

/** Rule-based seam: callers receive this contract regardless of a future ML implementation. */
export async function getStudentIntelligence(institutionId: string, studentId: string) {
  const [student, attendance, assignments, marks, skills] = await Promise.all([
    prisma.user.findFirst({ where: { id: studentId, institutionId }, select: { id: true, firstName: true, lastName: true } }),
    prisma.attendanceRecord.findMany({ where: { studentId, attendanceSession: { institutionId } }, select: { status: true, attendanceSession: { select: { courseOffering: { select: { course: { select: { code: true, name: true } } } } } } } }),
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
  const [students, departments, faculty, attendance, pendingAssignments] = await Promise.all([
    prisma.studentEnrollment.count({ where: enrollmentWhere }),
    prisma.department.count({ where: { institutionId, ...(filters.departmentId ? { id: filters.departmentId } : {}) } }),
    prisma.user.count({ where: { institutionId, facultyCourseOfferings: { some: filters.departmentId ? { course: { departmentId: filters.departmentId } } : {} } } }),
    prisma.attendanceRecord.groupBy({ by: ["status"], where: { attendanceSession: { institutionId, ...(filters.departmentId ? { courseOffering: { course: { departmentId: filters.departmentId } } } : {}), ...((filters.from || filters.to) ? { sessionDate: { ...(filters.from ? { gte: filters.from } : {}), ...(filters.to ? { lte: filters.to } : {}) } } : {}) } }, _count: { _all: true } }),
    prisma.assignment.count({ where: { institutionId, status: "PUBLISHED", dueDate: { lt: new Date() }, submissions: { none: {} } } }),
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
  const enrollments = await prisma.studentEnrollment.findMany({ where: { institutionId, ...(departmentIds ? { program: { departmentId: { in: departmentIds } } } : {}) }, select: { userId: true }, take: limit * 3 });
  const rows = await Promise.all(enrollments.map(e => getStudentIntelligence(institutionId, e.userId)));
  return rows.filter((x): x is NonNullable<typeof x> => !!x).filter(x => x.risk === "CRITICAL" || x.risk === "HIGH").sort((a, b) => a.scores.academicHealth - b.scores.academicHealth).slice(0, limit);
}
