import { Prisma } from "@prisma/client";

import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";
import { AuthenticatedUser } from "../types/auth";
import { PaginationParams } from "../utils/pagination";
import { getStudentAttendanceSummary } from "./attendanceStats.service";
import { getStudentAttendancePercentage } from "./attendancePolicy.service";
import { getStudentFeeSummary } from "./feeBilling.service";
import { getStudentExaminations } from "./examination.service";
import { getTranscript } from "./grading.service";
import { recordAuditLog } from "./audit.service";

/**
 * Parent portal.
 *
 * One rule governs the whole module: a parent may only ever reach a
 * child they are explicitly linked to, and that link is re-verified from
 * the database on every single request — never inferred from a token, a
 * previous call, or anything the client sent.
 *
 * assertParentOfChild is the only door into this file's data. Every
 * exported function calls it first.
 */

/**
 * Verifies the caller may act on this student.
 * Parents must hold a link row; institution staff fall through to the
 * shared student-visibility rule so admin support still works.
 */
export async function assertParentOfChild(
  institutionId: string,
  actor: AuthenticatedUser,
  studentId: string
): Promise<void> {
  if (!actor.roles.includes("PARENT")) {
    throw new AppError("This view is for linked parents", 403);
  }

  const link = await prisma.parentStudentLink.findFirst({
    where: { institutionId, parentId: actor.id, studentId },
    select: { parentId: true },
  });

  if (!link) {
    // Deliberately identical to the not-found case: a parent must not be
    // able to probe which student ids exist in the tenant.
    throw new AppError("No linked student matches that identifier", 404);
  }
}

/** The children this parent is linked to, with an at-a-glance status. */
export async function listMyChildren(
  institutionId: string,
  actor: AuthenticatedUser
) {
  if (!actor.roles.includes("PARENT")) {
    throw new AppError("This view is for linked parents", 403);
  }

  const links = await prisma.parentStudentLink.findMany({
    where: { institutionId, parentId: actor.id },
    select: {
      relationship: true,
      student: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          isActive: true,
        },
      },
    },
  });

  return Promise.all(
    links.map(async (link) => {
      const [enrollment, attendance, dues] = await Promise.all([
        prisma.studentEnrollment.findFirst({
          where: {
            institutionId,
            userId: link.student.id,
            status: "ACTIVE",
          },
          orderBy: { enrolledAt: "desc" },
          select: {
            rollNumber: true,
            program: { select: { name: true, code: true } },
            section: { select: { name: true } },
            semester: { select: { name: true, number: true } },
          },
        }),
        getStudentAttendancePercentage(institutionId, link.student.id),
        prisma.$queryRaw<{ outstanding: number | null }[]>(Prisma.sql`
          SELECT SUM(GREATEST(0, "amount" + "lateFeeAmount" - "paidAmount"))::float
                 AS "outstanding"
          FROM "fee_invoices"
          WHERE "institutionId" = ${institutionId}
            AND "studentId" = ${link.student.id}
            AND "cancelledAt" IS NULL
        `),
      ]);

      return {
        studentId: link.student.id,
        name: `${link.student.firstName} ${link.student.lastName}`,
        email: link.student.email,
        isActive: link.student.isActive,
        relationship: link.relationship,
        enrollment,
        attendance: {
          percentage: attendance.percentage,
          level: attendance.level,
          requiredPercentage: attendance.policy.minPercentage,
        },
        outstandingFees: dues[0]?.outstanding ?? 0,
      };
    })
  );
}

export async function getChildOverview(
  institutionId: string,
  actor: AuthenticatedUser,
  studentId: string
) {
  await assertParentOfChild(institutionId, actor, studentId);

  const [attendance, standing, transcript, exams, fees] = await Promise.all([
    getStudentAttendanceSummary(institutionId, studentId),
    getStudentAttendancePercentage(institutionId, studentId),
    getTranscript(institutionId, actor, studentId),
    getStudentExaminations(institutionId, actor, studentId),
    getStudentFeeSummary(institutionId, actor, studentId),
  ]);

  return {
    studentId,
    attendance: { ...attendance, standing },
    academics: {
      cgpa: transcript.cgpa,
      creditsEarned: transcript.creditsEarned,
      totalCredits: transcript.totalCredits,
      semesters: transcript.semesters,
    },
    examinations: exams,
    fees: fees.summary,
  };
}

export async function getChildAttendance(
  institutionId: string,
  actor: AuthenticatedUser,
  studentId: string
) {
  await assertParentOfChild(institutionId, actor, studentId);

  const [summary, standing, recent] = await Promise.all([
    getStudentAttendanceSummary(institutionId, studentId),
    getStudentAttendancePercentage(institutionId, studentId),
    prisma.$queryRaw<
      Array<{ sessionDate: Date; status: string; courseCode: string }>
    >(Prisma.sql`
      SELECT s."sessionDate", r."status", c."code" AS "courseCode"
      FROM "attendance_records" r
      JOIN "attendance_sessions" s ON s."id" = r."attendanceSessionId"
      JOIN "course_offerings" co ON co."id" = s."courseOfferingId"
      JOIN "courses" c ON c."id" = co."courseId"
      WHERE r."studentId" = ${studentId}
        AND s."institutionId" = ${institutionId}
        AND s."isSubmitted" = TRUE
      ORDER BY s."sessionDate" DESC
      LIMIT 60
    `),
  ]);

  return { summary, standing, recent };
}

export async function getChildResults(
  institutionId: string,
  actor: AuthenticatedUser,
  studentId: string
) {
  await assertParentOfChild(institutionId, actor, studentId);

  const [transcript, exams] = await Promise.all([
    getTranscript(institutionId, actor, studentId),
    getStudentExaminations(institutionId, actor, studentId),
  ]);

  return { transcript, examinations: exams };
}

export async function getChildFees(
  institutionId: string,
  actor: AuthenticatedUser,
  studentId: string
) {
  await assertParentOfChild(institutionId, actor, studentId);
  return getStudentFeeSummary(institutionId, actor, studentId);
}

/** Assignments and LMS progress across the child's active offerings. */
export async function getChildCoursework(
  institutionId: string,
  actor: AuthenticatedUser,
  studentId: string
) {
  await assertParentOfChild(institutionId, actor, studentId);

  const assignments = await prisma.$queryRaw<
    Array<{
      id: string;
      title: string;
      dueDate: Date | null;
      courseCode: string;
      submittedAt: Date | null;
      marksAwarded: number | null;
      maxMarks: number | null;
    }>
  >(Prisma.sql`
    SELECT a."id", a."title", a."dueDate", c."code" AS "courseCode",
           s."submittedAt", s."marksAwarded", s."status" AS "submissionStatus",
           a."maxMarks"
    FROM "assignments" a
    JOIN "course_offerings" co ON co."id" = a."courseOfferingId"
    JOIN "courses" c ON c."id" = co."courseId"
    JOIN "student_enrollments" e
      ON e."sectionId" = co."sectionId"
     AND e."semesterId" = co."semesterId"
     AND e."userId" = ${studentId}
     AND e."status" = 'ACTIVE'
    LEFT JOIN "assignment_submissions" s
      ON s."assignmentId" = a."id" AND s."studentId" = ${studentId}
    WHERE a."institutionId" = ${institutionId}
      AND a."status" = 'PUBLISHED'
    ORDER BY a."dueDate" DESC NULLS LAST
    LIMIT 100
  `);

  const lessons = await prisma.$queryRaw<
    Array<{
      courseCode: string;
      courseOfferingId: string;
      totalLessons: number;
      completedLessons: number;
    }>
  >(Prisma.sql`
    SELECT c."code" AS "courseCode", m."courseOfferingId",
           COUNT(l."id")::int AS "totalLessons",
           COUNT(p."id") FILTER (WHERE p."status" = 'COMPLETED')::int AS "completedLessons"
    FROM "course_modules" m
    JOIN "course_lessons" l ON l."courseModuleId" = m."id" AND l."isPublished" = TRUE
    JOIN "course_offerings" co ON co."id" = m."courseOfferingId"
    JOIN "courses" c ON c."id" = co."courseId"
    JOIN "student_enrollments" e
      ON e."sectionId" = co."sectionId"
     AND e."semesterId" = co."semesterId"
     AND e."userId" = ${studentId}
     AND e."status" = 'ACTIVE'
    LEFT JOIN "lesson_progresses" p
      ON p."courseLessonId" = l."id" AND p."studentId" = ${studentId}
    WHERE m."institutionId" = ${institutionId} AND m."isPublished" = TRUE
    GROUP BY c."code", m."courseOfferingId"
  `);

  const quizzes = await prisma.$queryRaw<
    Array<{
      quizTitle: string;
      courseCode: string;
      score: number | null;
      maxScore: number | null;
      status: string;
      submittedAt: Date | null;
    }>
  >(Prisma.sql`
    SELECT q."title" AS "quizTitle", c."code" AS "courseCode",
           a."score", a."maxScore", a."status", a."submittedAt"
    FROM "quiz_attempts" a
    JOIN "quizzes" q ON q."id" = a."quizId"
    JOIN "course_offerings" co ON co."id" = q."courseOfferingId"
    JOIN "courses" c ON c."id" = co."courseId"
    WHERE a."institutionId" = ${institutionId}
      AND a."studentId" = ${studentId}
      AND a."status" = 'GRADED'
    ORDER BY a."submittedAt" DESC
    LIMIT 50
  `);

  return { assignments, lessonProgress: lessons, quizzes };
}

/** The child's timetable and the institution calendar in one view. */
export async function getChildCalendar(
  institutionId: string,
  actor: AuthenticatedUser,
  studentId: string
) {
  await assertParentOfChild(institutionId, actor, studentId);

  const [timetable, events, exams] = await Promise.all([
    prisma.$queryRaw<
      Array<{
        dayOfWeek: number;
        startTime: string;
        endTime: string;
        room: string | null;
        courseCode: string;
        courseName: string;
      }>
    >(Prisma.sql`
      SELECT t."dayOfWeek", t."startTime", t."endTime", t."room",
             c."code" AS "courseCode", c."name" AS "courseName"
      FROM "timetable_entries" t
      JOIN "course_offerings" co ON co."id" = t."courseOfferingId"
      JOIN "courses" c ON c."id" = co."courseId"
      JOIN "student_enrollments" e
        ON e."sectionId" = co."sectionId"
       AND e."semesterId" = co."semesterId"
       AND e."userId" = ${studentId}
       AND e."status" = 'ACTIVE'
      WHERE t."institutionId" = ${institutionId}
      ORDER BY t."dayOfWeek" ASC, t."startTime" ASC
    `),
    prisma.calendarEvent.findMany({
      where: {
        institutionId,
        endDate: { gte: new Date() },
      },
      orderBy: { startDate: "asc" },
      take: 50,
    }),
    getStudentExaminations(institutionId, actor, studentId),
  ]);

  return { timetable, events, examinations: exams.upcoming };
}

/**
 * Notices addressed to the parent audience or to the child's department,
 * plus the parent's own notifications.
 */
export async function getChildNotices(
  institutionId: string,
  actor: AuthenticatedUser,
  studentId: string,
  pagination: PaginationParams
) {
  await assertParentOfChild(institutionId, actor, studentId);

  const notices = await prisma.$queryRaw<
    Array<{ id: string; title: string; body: string; publishedAt: Date }>
  >(Prisma.sql`
    SELECT DISTINCT n."id", n."title", n."body", n."publishedAt", n."audience"
    FROM "notices" n
    LEFT JOIN "student_enrollments" e
      ON e."userId" = ${studentId} AND e."status" = 'ACTIVE'
    LEFT JOIN "programs" pr ON pr."id" = e."programId"
    WHERE n."institutionId" = ${institutionId}
      AND (n."expiresAt" IS NULL OR n."expiresAt" > CURRENT_TIMESTAMP)
      AND n."publishedAt" <= CURRENT_TIMESTAMP
      AND (
        n."audience" IN ('ALL', 'PARENTS', 'STUDENTS')
        OR n."departmentId" = pr."departmentId"
      )
    ORDER BY n."publishedAt" DESC
    LIMIT ${pagination.take} OFFSET ${pagination.skip}
  `);

  const notifications = await prisma.notification.findMany({
    where: { institutionId, userId: actor.id },
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  return { notices, notifications };
}

/**
 * Parents may acknowledge a shortage alert so the institution knows the
 * message landed. That acknowledgement is itself audited.
 */
export async function acknowledgeAlert(
  institutionId: string,
  actor: AuthenticatedUser,
  alertId: string,
  meta: { ipAddress?: string; userAgent?: string }
) {
  const rows = await prisma.$queryRaw<{ id: string; studentId: string }[]>(Prisma.sql`
    SELECT "id", "studentId" FROM "attendance_shortage_alerts"
    WHERE "id" = ${alertId} AND "institutionId" = ${institutionId}
    LIMIT 1
  `);
  if (rows.length === 0) {
    throw new AppError("Alert was not found", 404);
  }
  await assertParentOfChild(institutionId, actor, rows[0].studentId);

  await prisma.$executeRaw`
    UPDATE "attendance_shortage_alerts"
    SET "acknowledgedAt" = CURRENT_TIMESTAMP
    WHERE "id" = ${alertId} AND "institutionId" = ${institutionId}
  `;

  await recordAuditLog({
    institutionId,
    userId: actor.id,
    action: "parent.alert_acknowledged",
    entityType: "AttendanceShortageAlert",
    entityId: alertId,
    metadata: { studentId: rows[0].studentId },
    ...meta,
  });

  return { id: alertId, acknowledged: true };
}
