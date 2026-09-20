import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";

import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";
import { AuthenticatedUser } from "../types/auth";
import { PaginationParams } from "../utils/pagination";
import { round2 } from "../utils/http";
import {
  andWhere,
  assertTenantReference,
  countRows,
  requireTenantRow,
} from "../utils/sqlScope";
import {
  assertCanViewStudent,
  getManagedDepartmentIds,
  isInstitutionWide,
} from "./accessScope.service";
import { recordAuditLog } from "./audit.service";

/**
 * Attendance governance.
 *
 * Marking attendance stays where it already lives (attendanceSession
 * service). This module owns the rules around it:
 *
 *   - configurable shortage policy, resolved most-specific-first
 *   - shortage calculation and alerting
 *   - correction requests with an approval trail
 *   - approved leave counted as excused
 *   - session locking/finalisation
 *
 * The important invariant: once a session is locked, the only path to a
 * different attendance record is an APPROVED correction request. Direct
 * marking is refused by attendanceSession.service.
 */

const CORRECTABLE_STATUSES = ["PRESENT", "ABSENT", "LATE", "EXCUSED"] as const;
const APPROVER_ROLES = [
  "SUPER_ADMIN",
  "INSTITUTION_ADMIN",
  "DIRECTOR",
  "MANAGEMENT",
  "HOD",
  "FACULTY",
];

export interface AttendancePolicy {
  id: string | null;
  name: string;
  scope: string;
  minPercentage: number;
  warnPercentage: number;
  condonationPercentage: number | null;
  countExcusedAsPresent: boolean;
  blockHallTicket: boolean;
}

/**
 * The institution's fallback when nothing has been configured yet.
 * Conservative on purpose: 75% is the common statutory floor in Indian
 * higher education, and it only warns rather than blocking by default
 * until an administrator saves a real policy.
 */
const DEFAULT_POLICY: AttendancePolicy = {
  id: null,
  name: "Institution default",
  scope: "INSTITUTION",
  minPercentage: 75,
  warnPercentage: 80,
  condonationPercentage: null,
  countExcusedAsPresent: true,
  blockHallTicket: false,
};

interface PolicyRow extends AttendancePolicy {
  id: string;
  departmentId: string | null;
  programId: string | null;
  isActive: boolean;
}

function assertCanManagePolicies(actor: AuthenticatedUser): void {
  const allowed = ["SUPER_ADMIN", "INSTITUTION_ADMIN", "DIRECTOR", "MANAGEMENT"];
  if (actor.roles.some((role) => allowed.includes(role))) return;
  throw new AppError(
    "Only institution leadership may change attendance policy",
    403
  );
}

// ==========================================================
// POLICY RESOLUTION
// ==========================================================

export async function listAttendancePolicies(institutionId: string) {
  return prisma.$queryRaw<PolicyRow[]>(Prisma.sql`
    SELECT p.*, d."name" AS "departmentName", pr."name" AS "programName"
    FROM "attendance_policies" p
    LEFT JOIN "departments" d ON d."id" = p."departmentId"
    LEFT JOIN "programs" pr ON pr."id" = p."programId"
    WHERE p."institutionId" = ${institutionId}
    ORDER BY p."scope" ASC, p."name" ASC
  `);
}

export async function upsertAttendancePolicy(
  institutionId: string,
  actor: AuthenticatedUser,
  input: {
    name: string;
    scope: string;
    departmentId?: string;
    programId?: string;
    minPercentage: number;
    warnPercentage: number;
    condonationPercentage?: number;
    countExcusedAsPresent?: boolean;
    blockHallTicket?: boolean;
    isActive?: boolean;
  },
  meta: { ipAddress?: string; userAgent?: string }
) {
  assertCanManagePolicies(actor);

  if (!["INSTITUTION", "DEPARTMENT", "PROGRAM"].includes(input.scope)) {
    throw new AppError(
      "scope must be INSTITUTION, DEPARTMENT or PROGRAM",
      400
    );
  }
  if (input.scope === "DEPARTMENT" && !input.departmentId) {
    throw new AppError("departmentId is required for a department policy", 400);
  }
  if (input.scope === "PROGRAM" && !input.programId) {
    throw new AppError("programId is required for a program policy", 400);
  }
  if (input.warnPercentage < input.minPercentage) {
    throw new AppError(
      "warnPercentage must be at or above minPercentage",
      400
    );
  }
  if (input.departmentId) {
    await assertTenantReference(
      prisma,
      "departments",
      institutionId,
      input.departmentId,
      "Department"
    );
  }
  if (input.programId) {
    await assertTenantReference(
      prisma,
      "programs",
      institutionId,
      input.programId,
      "Program"
    );
  }

  const id = randomUUID();
  await prisma.$executeRaw`
    INSERT INTO "attendance_policies"
      ("id", "institutionId", "name", "scope", "departmentId", "programId",
       "minPercentage", "warnPercentage", "condonationPercentage",
       "countExcusedAsPresent", "blockHallTicket", "isActive", "createdById")
    VALUES
      (${id}, ${institutionId}, ${input.name.trim()}, ${input.scope},
       ${input.departmentId ?? null}, ${input.programId ?? null},
       ${input.minPercentage}, ${input.warnPercentage},
       ${input.condonationPercentage ?? null},
       ${input.countExcusedAsPresent ?? true}, ${input.blockHallTicket ?? true},
       ${input.isActive ?? true}, ${actor.id})
    ON CONFLICT ("institutionId", "scope",
                 COALESCE("departmentId", ''), COALESCE("programId", ''))
    DO UPDATE SET
      "name" = EXCLUDED."name",
      "minPercentage" = EXCLUDED."minPercentage",
      "warnPercentage" = EXCLUDED."warnPercentage",
      "condonationPercentage" = EXCLUDED."condonationPercentage",
      "countExcusedAsPresent" = EXCLUDED."countExcusedAsPresent",
      "blockHallTicket" = EXCLUDED."blockHallTicket",
      "isActive" = EXCLUDED."isActive"
  `;

  await recordAuditLog({
    institutionId,
    userId: actor.id,
    action: "attendance.policy_saved",
    entityType: "AttendancePolicy",
    entityId: id,
    metadata: {
      scope: input.scope,
      minPercentage: input.minPercentage,
      warnPercentage: input.warnPercentage,
    },
    ...meta,
  });

  return listAttendancePolicies(institutionId);
}

/**
 * Resolves the policy that governs one student: program policy beats
 * department policy beats institution policy beats the built-in default.
 */
export async function resolveAttendancePolicy(
  institutionId: string,
  studentId: string
): Promise<AttendancePolicy> {
  const rows = await prisma.$queryRaw<PolicyRow[]>(Prisma.sql`
    SELECT p.*
    FROM "attendance_policies" p
    WHERE p."institutionId" = ${institutionId}
      AND p."isActive" = TRUE
      AND (
        p."scope" = 'INSTITUTION'
        OR (p."scope" = 'PROGRAM' AND p."programId" IN (
          SELECT e."programId" FROM "student_enrollments" e
          WHERE e."userId" = ${studentId} AND e."institutionId" = ${institutionId}
        ))
        OR (p."scope" = 'DEPARTMENT' AND p."departmentId" IN (
          SELECT pr."departmentId" FROM "student_enrollments" e
          JOIN "programs" pr ON pr."id" = e."programId"
          WHERE e."userId" = ${studentId} AND e."institutionId" = ${institutionId}
        ))
      )
    ORDER BY CASE p."scope"
      WHEN 'PROGRAM' THEN 1 WHEN 'DEPARTMENT' THEN 2 ELSE 3 END
    LIMIT 1
  `);

  return rows[0] ?? DEFAULT_POLICY;
}

// ==========================================================
// SHORTAGE CALCULATION
// ==========================================================

export interface AttendanceStanding {
  studentId: string;
  percentage: number | null;
  present: number;
  excused: number;
  total: number;
  policy: AttendancePolicy;
  level: "OK" | "WARNING" | "SHORTAGE";
}

/**
 * Attendance percentage under the governing policy.
 * EXCUSED records (produced by approved leave or an approved correction)
 * count as present when the policy says so; LATE never counts as a full
 * attendance, matching the existing attendanceStats behaviour.
 */
export async function getStudentAttendancePercentage(
  institutionId: string,
  studentId: string,
  courseOfferingId?: string
): Promise<AttendanceStanding> {
  const policy = await resolveAttendancePolicy(institutionId, studentId);

  const conditions: Prisma.Sql[] = [
    Prisma.sql`r."studentId" = ${studentId}`,
    Prisma.sql`s."institutionId" = ${institutionId}`,
    Prisma.sql`s."isSubmitted" = TRUE`,
  ];
  if (courseOfferingId) {
    conditions.push(Prisma.sql`s."courseOfferingId" = ${courseOfferingId}`);
  }

  const rows = await prisma.$queryRaw<
    Array<{ present: number; excused: number; total: number }>
  >(Prisma.sql`
    SELECT
      COUNT(*) FILTER (WHERE r."status" = 'PRESENT')::int AS "present",
      COUNT(*) FILTER (WHERE r."status" = 'EXCUSED')::int AS "excused",
      COUNT(*)::int AS "total"
    FROM "attendance_records" r
    JOIN "attendance_sessions" s ON s."id" = r."attendanceSessionId"
    ${andWhere(conditions)}
  `);

  const present = rows[0]?.present ?? 0;
  const excused = rows[0]?.excused ?? 0;
  const total = rows[0]?.total ?? 0;
  const counted = policy.countExcusedAsPresent ? present + excused : present;
  const percentage = total > 0 ? round2((counted / total) * 100) : null;

  let level: AttendanceStanding["level"] = "OK";
  if (percentage !== null) {
    if (percentage < policy.minPercentage) level = "SHORTAGE";
    else if (percentage < policy.warnPercentage) level = "WARNING";
  }

  return { studentId, percentage, present, excused, total, policy, level };
}

/**
 * Recomputes standings for everyone attached to a course offering (or a
 * whole department), writes an alert row for each student below the
 * warning threshold and notifies the student and any linked parent.
 * Idempotent per run: a student already alerted at the same level within
 * the last day is not alerted again.
 */
export async function runShortageScan(
  institutionId: string,
  actor: AuthenticatedUser,
  filters: { courseOfferingId?: string; departmentId?: string },
  meta: { ipAddress?: string; userAgent?: string }
) {
  if (!isInstitutionWide(actor) && !actor.roles.includes("HOD")) {
    throw new AppError(
      "You are not authorized to run an institution attendance scan",
      403
    );
  }
  if (actor.roles.includes("HOD") && !isInstitutionWide(actor)) {
    const managed = await getManagedDepartmentIds(institutionId, actor.id);
    if (!filters.departmentId || !managed.includes(filters.departmentId)) {
      throw new AppError(
        "Scope the scan to a department you head",
        403
      );
    }
  }

  const conditions: Prisma.Sql[] = [
    Prisma.sql`e."institutionId" = ${institutionId}`,
    Prisma.sql`e."status" = 'ACTIVE'`,
  ];
  if (filters.departmentId) {
    conditions.push(Prisma.sql`pr."departmentId" = ${filters.departmentId}`);
  }

  const students = await prisma.$queryRaw<{ userId: string }[]>(Prisma.sql`
    SELECT DISTINCT e."userId"
    FROM "student_enrollments" e
    JOIN "programs" pr ON pr."id" = e."programId"
    ${andWhere(conditions)}
    LIMIT 5000
  `);

  let alerted = 0;

  for (const { userId } of students) {
    const standing = await getStudentAttendancePercentage(
      institutionId,
      userId,
      filters.courseOfferingId
    );
    if (standing.level === "OK" || standing.percentage === null) continue;

    const recent = await countRows(
      prisma,
      "attendance_shortage_alerts",
      Prisma.sql`WHERE "institutionId" = ${institutionId}
        AND "studentId" = ${userId}
        AND "level" = ${standing.level}
        AND "createdAt" > CURRENT_TIMESTAMP - INTERVAL '1 day'`
    );
    if (recent > 0) continue;

    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        INSERT INTO "attendance_shortage_alerts"
          ("id", "institutionId", "studentId", "courseOfferingId", "percentage",
           "threshold", "level", "generatedById")
        VALUES
          (${randomUUID()}, ${institutionId}, ${userId},
           ${filters.courseOfferingId ?? null}, ${standing.percentage},
           ${standing.level === "SHORTAGE"
             ? standing.policy.minPercentage
             : standing.policy.warnPercentage},
           ${standing.level}, ${actor.id})
      `;

      const parents = await tx.parentStudentLink.findMany({
        where: { institutionId, studentId: userId },
        select: { parentId: true },
      });

      const body =
        standing.level === "SHORTAGE"
          ? `Your attendance is ${standing.percentage}%, below the required ${standing.policy.minPercentage}%.`
          : `Your attendance is ${standing.percentage}%, approaching the required ${standing.policy.minPercentage}%.`;

      await tx.notification.createMany({
        data: [
          {
            institutionId,
            userId,
            title: "Attendance shortage alert",
            body,
          },
          ...parents.map((link) => ({
            institutionId,
            userId: link.parentId,
            title: "Attendance shortage alert",
            body: body.replace("Your attendance", "Your child's attendance"),
          })),
        ],
      });
    });

    alerted += 1;
  }

  await recordAuditLog({
    institutionId,
    userId: actor.id,
    action: "attendance.shortage_scan",
    entityType: "Institution",
    entityId: institutionId,
    metadata: { scanned: students.length, alerted, ...filters },
    ...meta,
  });

  return { scanned: students.length, alerted };
}

export async function listShortageAlerts(
  institutionId: string,
  actor: AuthenticatedUser,
  pagination: PaginationParams,
  filters: { level?: string; studentId?: string }
) {
  const conditions: Prisma.Sql[] = [
    Prisma.sql`a."institutionId" = ${institutionId}`,
  ];
  if (filters.level) conditions.push(Prisma.sql`a."level" = ${filters.level}`);
  if (filters.studentId) {
    await assertCanViewStudent(institutionId, actor, filters.studentId);
    conditions.push(Prisma.sql`a."studentId" = ${filters.studentId}`);
  } else if (!isInstitutionWide(actor) && !actor.roles.includes("HOD")) {
    conditions.push(Prisma.sql`a."studentId" = ${actor.id}`);
  }
  const where = andWhere(conditions);

  const [items, totalRows] = await Promise.all([
    prisma.$queryRaw<
      Array<{
        id: string;
        percentage: number;
        threshold: number;
        level: string;
        createdAt: Date;
        studentName: string;
      }>
    >(Prisma.sql`
      SELECT a."id", a."percentage", a."threshold", a."level", a."createdAt",
             a."acknowledgedAt",
             u."firstName" || ' ' || u."lastName" AS "studentName"
      FROM "attendance_shortage_alerts" a
      JOIN "users" u ON u."id" = a."studentId"
      ${where}
      ORDER BY a."createdAt" DESC
      LIMIT ${pagination.take} OFFSET ${pagination.skip}
    `),
    prisma.$queryRaw<{ count: bigint }[]>(Prisma.sql`
      SELECT COUNT(*)::bigint AS "count"
      FROM "attendance_shortage_alerts" a ${where}
    `),
  ]);

  return { items, total: Number(totalRows[0]?.count ?? 0) };
}

// ==========================================================
// CORRECTION REQUESTS
// ==========================================================

export async function createCorrectionRequest(
  institutionId: string,
  actor: AuthenticatedUser,
  input: {
    attendanceSessionId: string;
    studentId?: string;
    requestedStatus: string;
    reason: string;
    evidenceUrl?: string;
    leaveRequestId?: string;
  },
  meta: { ipAddress?: string; userAgent?: string }
) {
  const studentId = input.studentId ?? actor.id;
  if (studentId !== actor.id) {
    await assertCanViewStudent(institutionId, actor, studentId);
    if (!actor.permissions.includes("attendance.mark")) {
      throw new AppError(
        "You are not authorized to raise a correction for another student",
        403
      );
    }
  }

  if (!(CORRECTABLE_STATUSES as readonly string[]).includes(input.requestedStatus)) {
    throw new AppError(
      `requestedStatus must be one of: ${CORRECTABLE_STATUSES.join(", ")}`,
      400
    );
  }

  const session = await prisma.attendanceSession.findFirst({
    where: { id: input.attendanceSessionId, institutionId },
    select: { id: true, courseOfferingId: true, sessionDate: true },
  });
  if (!session) {
    throw new AppError("Attendance session not found in this institution", 404);
  }

  const record = await prisma.attendanceRecord.findFirst({
    where: { attendanceSessionId: session.id, studentId },
    select: { id: true, status: true },
  });

  if (record?.status === input.requestedStatus) {
    throw new AppError(
      "This attendance record already has the requested status",
      409
    );
  }

  // When the student cites approved leave, verify it actually covers the
  // session date rather than taking the reference on trust.
  if (input.leaveRequestId) {
    const leave = await prisma.leaveRequest.findFirst({
      where: {
        id: input.leaveRequestId,
        institutionId,
        applicantId: studentId,
        status: "APPROVED",
      },
      select: { fromDate: true, toDate: true },
    });
    if (!leave) {
      throw new AppError(
        "No approved leave request of yours matches that reference",
        404
      );
    }
    if (
      session.sessionDate < leave.fromDate ||
      session.sessionDate > leave.toDate
    ) {
      throw new AppError(
        "The referenced leave does not cover this session date",
        400
      );
    }
  }

  const id = randomUUID();
  try {
    await prisma.$executeRaw`
      INSERT INTO "attendance_correction_requests"
        ("id", "institutionId", "attendanceSessionId", "attendanceRecordId",
         "studentId", "requestedById", "currentStatus", "requestedStatus",
         "reason", "evidenceUrl", "leaveRequestId", "status")
      VALUES
        (${id}, ${institutionId}, ${session.id}, ${record?.id ?? null},
         ${studentId}, ${actor.id}, ${record?.status ?? null},
         ${input.requestedStatus}, ${input.reason.trim()},
         ${input.evidenceUrl ?? null}, ${input.leaveRequestId ?? null}, 'PENDING')
    `;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new AppError(
        "A correction request for this session is already pending",
        409
      );
    }
    throw error;
  }

  await recordAuditLog({
    institutionId,
    userId: actor.id,
    action: "attendance.correction_requested",
    entityType: "AttendanceCorrectionRequest",
    entityId: id,
    metadata: {
      attendanceSessionId: session.id,
      studentId,
      requestedStatus: input.requestedStatus,
    },
    ...meta,
  });

  return requireTenantRow(
    prisma,
    "attendance_correction_requests",
    institutionId,
    id,
    "Correction request"
  );
}

export async function listCorrectionRequests(
  institutionId: string,
  actor: AuthenticatedUser,
  pagination: PaginationParams,
  filters: { status?: string; courseOfferingId?: string; mine?: boolean }
) {
  const conditions: Prisma.Sql[] = [
    Prisma.sql`c."institutionId" = ${institutionId}`,
  ];
  if (filters.status) conditions.push(Prisma.sql`c."status" = ${filters.status}`);
  if (filters.courseOfferingId) {
    conditions.push(Prisma.sql`s."courseOfferingId" = ${filters.courseOfferingId}`);
  }

  const canReview =
    isInstitutionWide(actor) ||
    actor.roles.some((role) => APPROVER_ROLES.includes(role));

  if (filters.mine || !canReview) {
    conditions.push(Prisma.sql`c."studentId" = ${actor.id}`);
  } else if (actor.roles.includes("FACULTY") && !isInstitutionWide(actor)) {
    // A faculty reviewer only sees corrections for their own offerings.
    conditions.push(Prisma.sql`co."facultyId" = ${actor.id}`);
  } else if (actor.roles.includes("HOD") && !isInstitutionWide(actor)) {
    const managed = await getManagedDepartmentIds(institutionId, actor.id);
    if (managed.length === 0) {
      return { items: [], total: 0 };
    }
    conditions.push(
      Prisma.sql`cr."departmentId" IN (${Prisma.join(managed)})`
    );
  }

  const where = andWhere(conditions);

  const [items, totalRows] = await Promise.all([
    prisma.$queryRaw<
      Array<{
        id: string;
        status: string;
        currentStatus: string | null;
        requestedStatus: string;
        reason: string;
        createdAt: Date;
        sessionDate: Date;
        studentName: string;
        courseCode: string;
      }>
    >(Prisma.sql`
      SELECT c."id", c."status", c."currentStatus", c."requestedStatus",
             c."reason", c."evidenceUrl", c."decisionNote", c."createdAt",
             c."decidedAt", s."sessionDate",
             u."firstName" || ' ' || u."lastName" AS "studentName",
             cr."code" AS "courseCode", cr."name" AS "courseName"
      FROM "attendance_correction_requests" c
      JOIN "attendance_sessions" s ON s."id" = c."attendanceSessionId"
      JOIN "course_offerings" co ON co."id" = s."courseOfferingId"
      JOIN "courses" cr ON cr."id" = co."courseId"
      JOIN "users" u ON u."id" = c."studentId"
      ${where}
      ORDER BY c."createdAt" DESC
      LIMIT ${pagination.take} OFFSET ${pagination.skip}
    `),
    prisma.$queryRaw<{ count: bigint }[]>(Prisma.sql`
      SELECT COUNT(*)::bigint AS "count"
      FROM "attendance_correction_requests" c
      JOIN "attendance_sessions" s ON s."id" = c."attendanceSessionId"
      JOIN "course_offerings" co ON co."id" = s."courseOfferingId"
      JOIN "courses" cr ON cr."id" = co."courseId"
      ${where}
    `),
  ]);

  return { items, total: Number(totalRows[0]?.count ?? 0) };
}

/**
 * Approving a correction is the ONLY way an attendance record changes
 * after a session is locked. The record write and the decision write
 * happen in one transaction so an approved correction can never be
 * recorded without its effect landing.
 */
export async function decideCorrectionRequest(
  institutionId: string,
  actor: AuthenticatedUser,
  requestId: string,
  input: { status: "APPROVED" | "REJECTED"; decisionNote?: string },
  meta: { ipAddress?: string; userAgent?: string }
) {
  const request = await requireTenantRow<{
    id: string;
    attendanceSessionId: string;
    attendanceRecordId: string | null;
    studentId: string;
    requestedStatus: string;
    currentStatus: string | null;
    status: string;
    requestedById: string;
  }>(
    prisma,
    "attendance_correction_requests",
    institutionId,
    requestId,
    "Correction request"
  );

  if (request.status !== "PENDING") {
    throw new AppError("This correction has already been decided", 409);
  }
  if (request.requestedById === actor.id && !isInstitutionWide(actor)) {
    throw new AppError(
      "A correction cannot be approved by the person who raised it",
      403
    );
  }

  const session = await prisma.attendanceSession.findFirst({
    where: { id: request.attendanceSessionId, institutionId },
    select: {
      id: true,
      courseOffering: {
        select: {
          facultyId: true,
          course: { select: { departmentId: true } },
        },
      },
    },
  });
  if (!session) {
    throw new AppError("Attendance session not found in this institution", 404);
  }

  // Authority: institution-wide roles, the department head, or the
  // faculty who owns the offering.
  if (!isInstitutionWide(actor)) {
    let allowed = session.courseOffering.facultyId === actor.id;
    if (!allowed && actor.roles.includes("HOD")) {
      const managed = await getManagedDepartmentIds(institutionId, actor.id);
      allowed = managed.includes(
        session.courseOffering.course.departmentId ?? ""
      );
    }
    if (!allowed) {
      throw new AppError(
        "This correction is outside your authorized scope",
        403
      );
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      UPDATE "attendance_correction_requests"
      SET "status" = ${input.status},
          "decisionNote" = ${input.decisionNote ?? null},
          "decidedById" = ${actor.id},
          "decidedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${requestId} AND "institutionId" = ${institutionId}
    `;

    if (input.status !== "APPROVED") return;

    if (request.attendanceRecordId) {
      await tx.attendanceRecord.update({
        where: { id: request.attendanceRecordId },
        data: { status: request.requestedStatus },
      });
    } else {
      await tx.attendanceRecord.upsert({
        where: {
          attendanceSessionId_studentId: {
            attendanceSessionId: request.attendanceSessionId,
            studentId: request.studentId,
          },
        },
        create: {
          attendanceSessionId: request.attendanceSessionId,
          studentId: request.studentId,
          status: request.requestedStatus,
        },
        update: { status: request.requestedStatus },
      });
    }

    await tx.notification.create({
      data: {
        institutionId,
        userId: request.studentId,
        title: "Attendance correction approved",
        body: `Your attendance was updated to ${request.requestedStatus}.`,
      },
    });
  });

  await recordAuditLog({
    institutionId,
    userId: actor.id,
    action: `attendance.correction_${input.status.toLowerCase()}`,
    entityType: "AttendanceCorrectionRequest",
    entityId: requestId,
    metadata: {
      studentId: request.studentId,
      from: request.currentStatus,
      to: request.requestedStatus,
      note: input.decisionNote,
    },
    ...meta,
  });

  return requireTenantRow(
    prisma,
    "attendance_correction_requests",
    institutionId,
    requestId,
    "Correction request"
  );
}

// ==========================================================
// LOCKING / FINALISATION
// ==========================================================

export async function setSessionLock(
  institutionId: string,
  actor: AuthenticatedUser,
  attendanceSessionId: string,
  locked: boolean,
  meta: { ipAddress?: string; userAgent?: string }
) {
  if (!isInstitutionWide(actor) && !actor.roles.includes("HOD")) {
    throw new AppError(
      "Only a head of department or institution leadership may finalise attendance",
      403
    );
  }

  const session = await prisma.attendanceSession.findFirst({
    where: { id: attendanceSessionId, institutionId },
    select: {
      id: true,
      isSubmitted: true,
      isLocked: true,
      courseOffering: {
        select: {
          course: { select: { departmentId: true } },
        },
      },
    },
  });
  if (!session) {
    throw new AppError("Attendance session not found in this institution", 404);
  }

  if (actor.roles.includes("HOD") && !isInstitutionWide(actor)) {
    const managed = await getManagedDepartmentIds(institutionId, actor.id);
    if (
      !managed.includes(session.courseOffering.course.departmentId ?? "")
    ) {
      throw new AppError("This session is outside your department", 403);
    }
  }

  if (locked && !session.isSubmitted) {
    throw new AppError(
      "Attendance must be submitted before it can be locked",
      409
    );
  }

  await prisma.attendanceSession.update({
    where: { id: attendanceSessionId },
    data: {
      isLocked: locked,
      lockedAt: locked ? new Date() : null,
      lockedById: locked ? actor.id : null,
    },
  });

  await recordAuditLog({
    institutionId,
    userId: actor.id,
    action: locked ? "attendance.session_locked" : "attendance.session_unlocked",
    entityType: "AttendanceSession",
    entityId: attendanceSessionId,
    ...meta,
  });

  return { id: attendanceSessionId, isLocked: locked };
}

/**
 * Bulk finalisation for a course offering up to a date — what a
 * department actually does at the end of a term.
 */
export async function lockSessionsThrough(
  institutionId: string,
  actor: AuthenticatedUser,
  courseOfferingId: string,
  through: Date,
  meta: { ipAddress?: string; userAgent?: string }
) {
  if (!isInstitutionWide(actor) && !actor.roles.includes("HOD")) {
    throw new AppError(
      "Only a head of department or institution leadership may finalise attendance",
      403
    );
  }

  const offering = await prisma.courseOffering.findFirst({
    where: { id: courseOfferingId, institutionId },
    select: { id: true, course: { select: { departmentId: true } } },
  });
  if (!offering) {
    throw new AppError("Course offering not found in this institution", 404);
  }
  if (actor.roles.includes("HOD") && !isInstitutionWide(actor)) {
    const managed = await getManagedDepartmentIds(institutionId, actor.id);
    if (!managed.includes(offering.course.departmentId ?? "")) {
      throw new AppError("This offering is outside your department", 403);
    }
  }

  const result = await prisma.attendanceSession.updateMany({
    where: {
      institutionId,
      courseOfferingId,
      sessionDate: { lte: through },
      isSubmitted: true,
      isLocked: false,
    },
    data: { isLocked: true, lockedAt: new Date(), lockedById: actor.id },
  });

  await recordAuditLog({
    institutionId,
    userId: actor.id,
    action: "attendance.sessions_locked",
    entityType: "CourseOffering",
    entityId: courseOfferingId,
    metadata: { locked: result.count, through: through.toISOString() },
    ...meta,
  });

  return { locked: result.count };
}

/** Full audit trail for one student's attendance corrections. */
export async function getStudentCorrectionHistory(
  institutionId: string,
  actor: AuthenticatedUser,
  studentId: string
) {
  await assertCanViewStudent(institutionId, actor, studentId);

  return prisma.$queryRaw<
    Array<{
      id: string;
      status: string;
      currentStatus: string | null;
      requestedStatus: string;
      reason: string;
      decisionNote: string | null;
      createdAt: Date;
      decidedAt: Date | null;
      sessionDate: Date;
      courseCode: string;
      decidedByName: string | null;
    }>
  >(Prisma.sql`
    SELECT c."id", c."status", c."currentStatus", c."requestedStatus",
           c."reason", c."decisionNote", c."createdAt", c."decidedAt",
           s."sessionDate", cr."code" AS "courseCode",
           d."firstName" || ' ' || d."lastName" AS "decidedByName"
    FROM "attendance_correction_requests" c
    JOIN "attendance_sessions" s ON s."id" = c."attendanceSessionId"
    JOIN "course_offerings" co ON co."id" = s."courseOfferingId"
    JOIN "courses" cr ON cr."id" = co."courseId"
    LEFT JOIN "users" d ON d."id" = c."decidedById"
    WHERE c."institutionId" = ${institutionId}
      AND c."studentId" = ${studentId}
    ORDER BY c."createdAt" DESC
    LIMIT 200
  `);
}
