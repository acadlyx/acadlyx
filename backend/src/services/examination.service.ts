import { Prisma } from "@prisma/client";
import { createHash, randomUUID } from "crypto";

import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";
import { AuthenticatedUser } from "../types/auth";
import { getCourseOfferingRoster } from "../utils/academicRoster";
import {
  assertOwnsCourseOffering,
  loadCourseOfferingOrThrow,
} from "../utils/courseOfferingAccess";
import { PaginationParams } from "../utils/pagination";
import {
  andWhere,
  assertTenantReference,
  countRows,
  nextSequenceNumber,
  requireTenantRow,
} from "../utils/sqlScope";
import { recordAuditLog } from "./audit.service";
import { enqueueJob } from "./backgroundJob.service";
import { JOB_TYPES } from "../jobs/types";
import { assertExaminationController } from "./workflowAuthority.service";
import { assertCanViewStudent, isInstitutionWide, getManagedDepartmentIds, getDirectorDepartmentIds } from "./accessScope.service";
import { getStudentAttendancePercentage } from "./attendancePolicy.service";
import { createAdmitCardPdf } from "./admitCardPdf.service";
import { getActiveAdmitCardTemplate } from "./admitCardTemplate.service";
import { createMarksheetPdf } from "./marksheetPdf.service";

/**
 * Examinations.
 *
 * The module is a controlled state machine rather than free-form CRUD,
 * because an examination record is evidence:
 *
 *   session   DRAFT -> SCHEDULED -> ONGOING -> COMPLETED -> PUBLISHED
 *   schedule  DRAFT -> PUBLISHED -> LOCKED  -> RESULTS_PUBLISHED
 *   mark      DRAFT -> SUBMITTED -> APPROVED -> PUBLISHED
 *
 * Marks can only move forward, every transition is audited, and once a
 * schedule is LOCKED the only route to a different mark is an approved
 * revaluation. Publication mirrors the marks into the existing
 * Exam/ExamResult models so transcripts, grade sheets and SGPA/CGPA
 * continue to read from one source of truth.
 */

const EXAM_TYPES = ["REGULAR", "MID_SEMESTER", "INTERNAL_ASSESSMENT", "END_SEMESTER", "SEMESTER", "PRACTICAL", "VIVA", "UNIVERSITY", "SUPPLEMENTARY", "BACK_PAPER", "IMPROVEMENT", "REAPPEAR", "MAKE_UP", "SPECIAL", "REVALUATION"] as const;
const SESSION_STATUSES = ["DRAFT", "SCHEDULED", "ONGOING", "COMPLETED", "PUBLISHED", "CANCELLED"] as const;
const SCHEDULE_STATUSES = ["DRAFT", "PUBLISHED", "LOCKED", "CORRECTION_OPEN", "RESULTS_PUBLISHED", "CANCELLED"] as const;
const MARK_STATUSES = ["DRAFT", "SUBMITTED", "APPROVED", "PUBLISHED"] as const;
const EXAM_ATTENDANCE_STATUSES = ["PRESENT", "ABSENT", "DEBARRED", "MALPRACTICE"] as const;
const CONTROLLER_ROLES: readonly string[] = ["EXAMINATION"];

export type ExamType = (typeof EXAM_TYPES)[number];
export type ExamSessionStatus = (typeof SESSION_STATUSES)[number];
export type ExamScheduleStatus = (typeof SCHEDULE_STATUSES)[number];
export type ExamMarkStatus = (typeof MARK_STATUSES)[number];

/** Legal forward transitions. Anything absent here is rejected. */
const SESSION_TRANSITIONS: Record<ExamSessionStatus, ExamSessionStatus[]> = {
  DRAFT: ["SCHEDULED", "CANCELLED"],
  SCHEDULED: ["ONGOING", "CANCELLED"],
  ONGOING: ["COMPLETED", "CANCELLED"],
  COMPLETED: ["PUBLISHED"],
  PUBLISHED: [],
  CANCELLED: [],
};

interface ExamSessionRow {
  id: string;
  institutionId: string;
  academicYearId: string | null;
  semesterId: string | null;
  name: string;
  code: string;
  examType: string;
  status: ExamSessionStatus;
  startDate: Date;
  endDate: Date;
  hallTicketReleaseAt: Date | null;
  resultPublishedAt: Date | null;
  instructions: string | null;
  registrationRequired: boolean;
  registrationStart: Date | null;
  registrationEnd: Date | null;
  examFee: number;
  attendanceRequirement: number | null;
  eligibilityRules: unknown;
  campusIds: unknown;
  departmentIds: unknown;
  programIds: unknown;
  semesterIds: unknown;
  sectionIds: unknown;
  studentIds: unknown;
  registrationStatus: string;
  eligibilityStatus: string;
  admitCardStatus: string;
  resultStatus: string;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
}

interface ExamScheduleRow {
  id: string;
  institutionId: string;
  examSessionId: string;
  courseOfferingId: string;
  examDate: Date;
  startTime: string;
  endTime: string;
  maxMarks: number;
  passMarks: number;
  status: ExamScheduleStatus;
  marksLockedAt: Date | null;
  marksLockedById: string | null;
  resultsPublishedAt: Date | null;
  instructions: string | null;
  legacyExamId: string | null;
  createdById: string;
}

/**
 * Official examination approval, locking and publication are controlled by
 * the Examination Cell, with Director-level oversight. A generic admin role
 * does not become an examination controller merely by having access to the
 * institution.
 */
function assertExamController(actor: AuthenticatedUser): void {
  assertExaminationController(actor);
}

function assertExamApprover(actor: AuthenticatedUser): void {
  if (!actor.roles.some((role) => ["EXAMINATION","DIRECTOR","REGISTRAR","CHAIRMAN"].includes(role))) {
    throw new AppError("Examination approval authority is required for this operation", 403);
  }
}

function assertValue<T extends string>(
  value: string,
  allowed: readonly T[],
  label: string
): T {
  if (!(allowed as readonly string[]).includes(value)) {
    throw new AppError(
      `${label} must be one of: ${allowed.join(", ")}`,
      400
    );
  }
  return value as T;
}

async function loadSession(
  institutionId: string,
  examSessionId: string
): Promise<ExamSessionRow> {
  return requireTenantRow<ExamSessionRow>(
    prisma,
    "exam_sessions",
    institutionId,
    examSessionId,
    "Examination session"
  );
}

async function loadSchedule(
  institutionId: string,
  examScheduleId: string
): Promise<ExamScheduleRow> {
  return requireTenantRow<ExamScheduleRow>(
    prisma,
    "exam_schedules",
    institutionId,
    examScheduleId,
    "Examination schedule"
  );
}

/**
 * Faculty may act on a schedule only for the offering they teach.
 * Controllers and admins may act on any schedule in their tenant.
 */
async function assertCanReadSchedule(
  institutionId: string,
  actor: AuthenticatedUser,
  schedule: ExamScheduleRow
): Promise<void> {
  if (actor.roles.includes("EXAMINATION") || actor.roles.includes("CHAIRMAN") || actor.roles.includes("REGISTRAR")) return;
  const offering = await loadCourseOfferingOrThrow(institutionId, schedule.courseOfferingId);
  if (actor.roles.includes("FACULTY")) {
    if (offering.facultyId !== actor.id) throw new AppError("Examination is outside your assignment scope",403);
    return;
  }
  if (actor.roles.includes("HOD") || actor.roles.includes("DEAN")) {
    const ids = await getManagedDepartmentIds(institutionId, actor.id);
    const course = await prisma.course.findFirst({ where:{id:offering.courseId,institutionId}, select:{departmentId:true} });
    if (!course || !ids.includes(course.departmentId)) throw new AppError("Examination is outside your authorized academic scope",403);
    return;
  }
  if (actor.roles.includes("DIRECTOR")) {
    const ids = await getDirectorDepartmentIds(institutionId, actor.id);
    const course = await prisma.course.findFirst({ where:{id:offering.courseId,institutionId}, select:{departmentId:true} });
    if (!course || !ids.includes(course.departmentId)) throw new AppError("Examination is outside your authorized campus scope",403);
    return;
  }
  throw new AppError("You are not authorized to access this examination schedule",403);
}

async function assertCanActOnSchedule(
  institutionId: string,
  actor: AuthenticatedUser,
  schedule: ExamScheduleRow
): Promise<void> {
  if (actor.roles.includes("EXAMINATION")) return;
  const offering = await loadCourseOfferingOrThrow(institutionId, schedule.courseOfferingId);
  if (!actor.roles.includes("FACULTY") || offering.facultyId !== actor.id) {
    throw new AppError("You are not authorized to modify this examination schedule",403);
  }
}

async function assertCanConductSchedule(
  institutionId: string,
  actor: AuthenticatedUser,
  schedule: ExamScheduleRow
): Promise<void> {
  if (actor.roles.includes("EXAMINATION")) return;
  const rows = await prisma.$queryRaw<Array<{id:string}>>(Prisma.sql`
    SELECT "id" FROM "exam_invigilators"
    WHERE "institutionId"=${institutionId} AND "examScheduleId"=${schedule.id}
      AND "facultyId"=${actor.id} LIMIT 1
  `);
  if (!rows.length) throw new AppError("You are not assigned to this examination duty",403);
}

// ==========================================================
// EXAM SESSIONS
// ==========================================================

export interface CreateExamSessionInput {
  name: string;
  code: string;
  examType: string;
  startDate: Date;
  endDate: Date;
  academicYearId?: string;
  semesterId?: string;
  campusIds?: string[];
  departmentIds?: string[];
  programIds?: string[];
  semesterIds?: string[];
  sectionIds?: string[];
  studentIds?: string[];
  registrationRequired?: boolean;
  registrationStart?: Date;
  registrationEnd?: Date;
  examFee?: number;
  attendanceRequirement?: number;
  eligibilityRules?: Record<string, unknown>;
  hallTicketReleaseAt?: Date;
  instructions?: string;
}

export async function createExamSession(
  institutionId: string,
  actor: AuthenticatedUser,
  input: CreateExamSessionInput,
  meta: { ipAddress?: string; userAgent?: string }
) {
  assertExamController(actor);
  assertValue(input.examType, EXAM_TYPES, "examType");

  if (input.endDate < input.startDate) {
    throw new AppError("endDate must not be before startDate", 400);
  }
  if (input.registrationStart && input.registrationEnd && input.registrationEnd < input.registrationStart) throw new AppError("registrationEnd must not be before registrationStart", 400);
  if ((input.examFee ?? 0) < 0) throw new AppError("examFee cannot be negative", 400);
  if (input.attendanceRequirement !== undefined && (input.attendanceRequirement < 0 || input.attendanceRequirement > 100)) throw new AppError("attendanceRequirement must be between 0 and 100", 400);
  const targets = [input.campusIds ?? [], input.departmentIds ?? [], input.programIds ?? [], input.semesterIds ?? [], input.sectionIds ?? [], input.studentIds ?? []].flat();
  if (new Set(targets).size !== targets.length) throw new AppError("Examination targeting contains duplicate IDs", 400);

  if (input.academicYearId) {
    await assertTenantReference(
      prisma,
      "academic_years",
      institutionId,
      input.academicYearId,
      "Academic year"
    );
  }
  if (input.semesterId) {
    await assertTenantReference(
      prisma,
      "semesters",
      institutionId,
      input.semesterId,
      "Semester"
    );
  }
  for (const [ids, table, label] of [
    [input.campusIds ?? [], "campuses", "Campus"],
    [input.departmentIds ?? [], "departments", "Department"],
    [input.programIds ?? [], "programs", "Program"],
    [input.semesterIds ?? [], "semesters", "Semester"],
    [input.sectionIds ?? [], "sections", "Section"],
  ] as Array<[string[], string, string]>) {
    for (const id of ids) await assertTenantReference(prisma, table, institutionId, id, label);
  }
  for (const id of input.studentIds ?? []) await assertStudentExists(institutionId, id);

  const code = input.code.trim().toUpperCase().replace(/\s+/g, "_");
  const id = randomUUID();

  try {
    await prisma.$executeRaw`
      INSERT INTO "exam_sessions"
        ("id", "institutionId", "academicYearId", "semesterId", "name", "code",
         "examType", "status", "startDate", "endDate", "hallTicketReleaseAt",
         "instructions", "createdById", "campusIds", "departmentIds",
         "programIds", "semesterIds", "sectionIds", "studentIds",
         "registrationRequired", "registrationStart", "registrationEnd",
         "examFee", "attendanceRequirement", "eligibilityRules", "registrationStatus")
      VALUES
        (${id}, ${institutionId}, ${input.academicYearId ?? null},
         ${input.semesterId ?? null}, ${input.name.trim()}, ${code},
         ${input.examType}, 'DRAFT', ${input.startDate}, ${input.endDate},
         ${input.hallTicketReleaseAt ?? null}, ${input.instructions ?? null},
         ${actor.id}, ${JSON.stringify(input.campusIds ?? [])}::jsonb,
         ${JSON.stringify(input.departmentIds ?? [])}::jsonb,
         ${JSON.stringify(input.programIds ?? [])}::jsonb,
         ${JSON.stringify(input.semesterIds ?? [])}::jsonb,
         ${JSON.stringify(input.sectionIds ?? [])}::jsonb,
         ${JSON.stringify(input.studentIds ?? [])}::jsonb,
         ${input.registrationRequired ?? true}, ${input.registrationStart ?? null},
         ${input.registrationEnd ?? null}, ${input.examFee ?? 0},
         ${input.attendanceRequirement ?? null}, ${JSON.stringify(input.eligibilityRules ?? {})}::jsonb,
         CASE WHEN ${input.registrationRequired ?? true} = FALSE THEN 'NOT_REQUIRED'
              WHEN ${input.registrationStart ?? null} IS NULL THEN 'OPEN'
              WHEN ${input.registrationStart ?? null} > CURRENT_TIMESTAMP THEN 'NOT_OPEN'
              WHEN ${input.registrationEnd ?? null} IS NOT NULL AND ${input.registrationEnd ?? null} < CURRENT_TIMESTAMP THEN 'CLOSED'
              ELSE 'OPEN' END)
    `;
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2010"
    ) {
      throw new AppError(
        "An examination session with this code already exists",
        409
      );
    }
    throw error;
  }

  await recordAuditLog({
    institutionId,
    userId: actor.id,
    action: "exam.session_created",
    entityType: "ExamSession",
    entityId: id,
    metadata: { code, name: input.name, examType: input.examType },
    ...meta,
  });

  return loadSession(institutionId, id);
}

export async function listExamSessions(
  institutionId: string,
  actor: AuthenticatedUser,
  pagination: PaginationParams,
  filters: { status?: string; examType?: string; search?: string }
) {
  const conditions: Prisma.Sql[] = [
    Prisma.sql`"institutionId" = ${institutionId}`,
  ];
  const roles = actor.roles;
  if (roles.includes("STUDENT")) {
    const context = await loadStudentExamContext(institutionId, actor.id);
    conditions.push(Prisma.sql`(
      ("studentIds" = '[]'::jsonb OR "studentIds" ? ${actor.id})
      AND ("campusIds" = '[]'::jsonb OR ("campusIds" ? ${context.campusId ?? ""}))
      AND ("departmentIds" = '[]'::jsonb OR ("departmentIds" ? ${context.departmentId ?? ""}))
      AND ("programIds" = '[]'::jsonb OR ("programIds" ? ${context.programId ?? ""}))
      AND ("semesterIds" = '[]'::jsonb OR ("semesterIds" ? ${context.semesterId ?? ""}))
      AND ("sectionIds" = '[]'::jsonb OR ("sectionIds" ? ${context.sectionId ?? ""}))
      AND ("academicYearId" IS NULL OR "academicYearId"=${context.academicYearId})
      AND ("semesterId" IS NULL OR "semesterId"=${context.semesterId})
    )`);
  } else if (roles.includes("PARENT")) {
    return { items: [], total: 0 };
  } else if (roles.includes("FACULTY")) {
    conditions.push(Prisma.sql`EXISTS (
      SELECT 1 FROM "exam_schedules" es
      JOIN "course_offerings" co ON co."id"=es."courseOfferingId"
      WHERE es."examSessionId"="exam_sessions"."id"
        AND es."institutionId"=${institutionId}
        AND co."facultyId"=${actor.id}
    )`);
  } else if (roles.includes("HOD")) {
    const ids = await getManagedDepartmentIds(institutionId, actor.id);
    if (!ids.length) return { items: [], total: 0 };
    conditions.push(Prisma.sql`(
      "departmentIds" = '[]'::jsonb OR "departmentIds" ?| ARRAY[${Prisma.join(ids)}]
      OR EXISTS (
        SELECT 1 FROM "exam_schedules" es
        JOIN "course_offerings" co ON co."id"=es."courseOfferingId"
        JOIN "courses" c ON c."id"=co."courseId"
        WHERE es."examSessionId"="exam_sessions"."id" AND c."departmentId" IN (${Prisma.join(ids)})
      )
    )`);
  } else if (roles.includes("DEAN")) {
    const ids = await getManagedDepartmentIds(institutionId, actor.id);
    if (!ids.length) return { items: [], total: 0 };
    conditions.push(Prisma.sql`(
      "departmentIds" = '[]'::jsonb OR "departmentIds" ?| ARRAY[${Prisma.join(ids)}]
      OR EXISTS (
        SELECT 1 FROM "exam_schedules" es
        JOIN "course_offerings" co ON co."id"=es."courseOfferingId"
        JOIN "courses" c ON c."id"=co."courseId"
        WHERE es."examSessionId"="exam_sessions"."id" AND c."departmentId" IN (${Prisma.join(ids)})
      )
    )`);
  } else if (roles.includes("DIRECTOR")) {
    const ids = await getDirectorDepartmentIds(institutionId, actor.id);
    if (!ids.length) return { items: [], total: 0 };
    conditions.push(Prisma.sql`(
      "departmentIds" = '[]'::jsonb OR "departmentIds" ?| ARRAY[${Prisma.join(ids)}]
      OR EXISTS (
        SELECT 1 FROM "exam_schedules" es
        JOIN "course_offerings" co ON co."id"=es."courseOfferingId"
        JOIN "courses" c ON c."id"=co."courseId"
        WHERE es."examSessionId"="exam_sessions"."id" AND c."departmentId" IN (${Prisma.join(ids)})
      )
    )`);
  }
  if (filters.status) {
    conditions.push(Prisma.sql`"status" = ${filters.status}`);
  }
  if (filters.examType) {
    conditions.push(Prisma.sql`"examType" = ${filters.examType}`);
  }
  if (filters.search) {
    const like = `%${filters.search}%`;
    conditions.push(
      Prisma.sql`("name" ILIKE ${like} OR "code" ILIKE ${like})`
    );
  }
  const where = andWhere(conditions);

  const [items, total] = await Promise.all([
    prisma.$queryRaw<ExamSessionRow[]>(Prisma.sql`
      SELECT * FROM "exam_sessions"
      ${where}
      ORDER BY "startDate" DESC
      LIMIT ${pagination.take} OFFSET ${pagination.skip}
    `),
    countRows(prisma, "exam_sessions", where),
  ]);

  return { items, total };
}

export async function getExamSession(
  institutionId: string,
  actor: AuthenticatedUser,
  examSessionId: string
) {
  const session = await loadSession(institutionId, examSessionId);
  if (actor.roles.includes("STUDENT")) {
    const context = await loadStudentExamContext(institutionId, actor.id);
    if (!sessionTargetsStudent(session, context)) throw new AppError("Examination is outside your academic scope",403);
  } else if (actor.roles.includes("FACULTY")) {
    const rows = await prisma.$queryRaw<Array<{id:string}>>(Prisma.sql`
      SELECT es."id" FROM "exam_schedules" es
      JOIN "course_offerings" co ON co."id"=es."courseOfferingId"
      WHERE es."examSessionId"=${examSessionId} AND es."institutionId"=${institutionId} AND co."facultyId"=${actor.id} LIMIT 1`);
    if (!rows.length) throw new AppError("Examination is outside your assignment scope",403);
  } else if (actor.roles.includes("HOD") || actor.roles.includes("DEAN") || actor.roles.includes("DIRECTOR")) {
    const ids = actor.roles.includes("DIRECTOR") ? await getDirectorDepartmentIds(institutionId, actor.id) : await getManagedDepartmentIds(institutionId, actor.id);
    if (!ids.length) throw new AppError("No examination scope is assigned to this account",403);
    const rows = await prisma.$queryRaw<Array<{id:string}>>(Prisma.sql`
      SELECT es."id" FROM "exam_schedules" es
      JOIN "course_offerings" co ON co."id"=es."courseOfferingId"
      JOIN "courses" c ON c."id"=co."courseId"
      WHERE es."examSessionId"=${examSessionId} AND es."institutionId"=${institutionId} AND c."departmentId" IN (${Prisma.join(ids)}) LIMIT 1`);
    const target = jsonStringArray(session.departmentIds);
    if (!rows.length && !(target.length === 0 || target.some(id => ids.includes(id)))) throw new AppError("Examination is outside your authorized scope",403);
  }

  const schedules = await prisma.$queryRaw<
    Array<
      ExamScheduleRow & {
        courseCode: string;
        courseName: string;
        sectionName: string | null;
        seatCount: number;
        markCount: number;
      }
    >
  >(Prisma.sql`
    SELECT s.*,
      c."code"  AS "courseCode",
      c."name"  AS "courseName",
      sec."name" AS "sectionName",
      (SELECT COUNT(*) FROM "exam_seat_allocations" a WHERE a."examScheduleId" = s."id")::int AS "seatCount",
      (SELECT COUNT(*) FROM "exam_marks" m WHERE m."examScheduleId" = s."id")::int AS "markCount"
    FROM "exam_schedules" s
    JOIN "course_offerings" co ON co."id" = s."courseOfferingId"
    JOIN "courses" c ON c."id" = co."courseId"
    LEFT JOIN "sections" sec ON sec."id" = co."sectionId"
    WHERE s."examSessionId" = ${examSessionId}
      AND s."institutionId" = ${institutionId}
    ORDER BY s."examDate" ASC, s."startTime" ASC
  `);

  return { ...session, schedules };
}

export async function updateExamSessionStatus(
  institutionId: string,
  actor: AuthenticatedUser,
  examSessionId: string,
  nextStatus: string,
  meta: { ipAddress?: string; userAgent?: string }
) {
  assertExamController(actor);
  const status = assertValue(nextStatus, SESSION_STATUSES, "status");
  const session = await loadSession(institutionId, examSessionId);

  if (!SESSION_TRANSITIONS[session.status].includes(status)) {
    throw new AppError(
      `An examination session cannot move from ${session.status} to ${status}`,
      409
    );
  }

  if (status === "PUBLISHED") {
    const pending = await countRows(
      prisma,
      "exam_schedules",
      Prisma.sql`WHERE "examSessionId" = ${examSessionId}
        AND "institutionId" = ${institutionId}
        AND "status" NOT IN ('RESULTS_PUBLISHED', 'CANCELLED')`
    );
    if (pending > 0) {
      throw new AppError(
        `${pending} schedule(s) still have unpublished results`,
        409
      );
    }
  }

  await prisma.$executeRaw`
    UPDATE "exam_sessions"
    SET "status" = ${status},
        "resultPublishedAt" = CASE WHEN ${status} = 'PUBLISHED'
          THEN CURRENT_TIMESTAMP ELSE "resultPublishedAt" END
    WHERE "id" = ${examSessionId} AND "institutionId" = ${institutionId}
  `;

  await recordAuditLog({
    institutionId,
    userId: actor.id,
    action: "exam.session_status_changed",
    entityType: "ExamSession",
    entityId: examSessionId,
    metadata: { from: session.status, to: status },
    ...meta,
  });

  return loadSession(institutionId, examSessionId);
}

export async function updateExamSession(
  institutionId: string,
  actor: AuthenticatedUser,
  examSessionId: string,
  input: Partial<CreateExamSessionInput>,
  meta: { ipAddress?: string; userAgent?: string }
) {
  assertExamController(actor);
  const session = await loadSession(institutionId, examSessionId);

  if (session.status === "PUBLISHED" || session.status === "CANCELLED") {
    throw new AppError(
      "A published or cancelled examination session can no longer be edited",
      409
    );
  }

  const startDate = input.startDate ?? session.startDate;
  const endDate = input.endDate ?? session.endDate;
  if (endDate < startDate) {
    throw new AppError("endDate must not be before startDate", 400);
  }

  if (input.registrationStart && input.registrationEnd && input.registrationEnd < input.registrationStart) throw new AppError("registrationEnd must not be before registrationStart",400);
  if (input.examFee !== undefined && input.examFee < 0) throw new AppError("examFee cannot be negative",400);
  if (input.attendanceRequirement !== undefined && (input.attendanceRequirement < 0 || input.attendanceRequirement > 100)) throw new AppError("attendanceRequirement must be between 0 and 100",400);
  for (const [ids, table, label] of [
    [input.campusIds ?? [], "campuses", "Campus"],
    [input.departmentIds ?? [], "departments", "Department"],
    [input.programIds ?? [], "programs", "Program"],
    [input.semesterIds ?? [], "semesters", "Semester"],
    [input.sectionIds ?? [], "sections", "Section"],
  ] as Array<[string[], string, string]>) for (const id of ids) await assertTenantReference(prisma, table, institutionId, id, label);
  for (const id of input.studentIds ?? []) await assertStudentExists(institutionId, id);

  await prisma.$executeRaw`
    UPDATE "exam_sessions"
    SET "name" = COALESCE(${input.name ?? null}, "name"),
        "startDate" = ${startDate},
        "endDate" = ${endDate},
        "registrationRequired" = COALESCE(${input.registrationRequired ?? null}, "registrationRequired"),
        "registrationStart" = COALESCE(${input.registrationStart ?? null}, "registrationStart"),
        "registrationEnd" = COALESCE(${input.registrationEnd ?? null}, "registrationEnd"),
        "examFee" = COALESCE(${input.examFee ?? null}, "examFee"),
        "attendanceRequirement" = COALESCE(${input.attendanceRequirement ?? null}, "attendanceRequirement"),
        "eligibilityRules" = COALESCE(${input.eligibilityRules ? JSON.stringify(input.eligibilityRules) : null}::jsonb, "eligibilityRules"),
        "campusIds" = COALESCE(${input.campusIds ? JSON.stringify(input.campusIds) : null}::jsonb, "campusIds"),
        "departmentIds" = COALESCE(${input.departmentIds ? JSON.stringify(input.departmentIds) : null}::jsonb, "departmentIds"),
        "programIds" = COALESCE(${input.programIds ? JSON.stringify(input.programIds) : null}::jsonb, "programIds"),
        "semesterIds" = COALESCE(${input.semesterIds ? JSON.stringify(input.semesterIds) : null}::jsonb, "semesterIds"),
        "sectionIds" = COALESCE(${input.sectionIds ? JSON.stringify(input.sectionIds) : null}::jsonb, "sectionIds"),
        "studentIds" = COALESCE(${input.studentIds ? JSON.stringify(input.studentIds) : null}::jsonb, "studentIds"),
        "hallTicketReleaseAt" = COALESCE(${input.hallTicketReleaseAt ?? null}, "hallTicketReleaseAt"),
        "instructions" = COALESCE(${input.instructions ?? null}, "instructions")
    WHERE "id" = ${examSessionId} AND "institutionId" = ${institutionId}
  `;

  await recordAuditLog({
    institutionId,
    userId: actor.id,
    action: "exam.session_updated",
    entityType: "ExamSession",
    entityId: examSessionId,
    metadata: { changed: Object.keys(input) },
    ...meta,
  });

  return loadSession(institutionId, examSessionId);
}

// ==========================================================
// EXAM ROOMS
// ==========================================================

export async function listExamRooms(
  institutionId: string,
  filters: { includeInactive?: boolean; search?: string }
) {
  const conditions: Prisma.Sql[] = [
    Prisma.sql`"institutionId" = ${institutionId}`,
  ];
  if (!filters.includeInactive) {
    conditions.push(Prisma.sql`"isActive" = TRUE`);
  }
  if (filters.search) {
    const like = `%${filters.search}%`;
    conditions.push(Prisma.sql`("name" ILIKE ${like} OR "code" ILIKE ${like})`);
  }

  return prisma.$queryRaw<
    Array<{
      id: string;
      name: string;
      code: string;
      building: string | null;
      capacity: number;
      isActive: boolean;
    }>
  >(Prisma.sql`
    SELECT "id", "name", "code", "building", "floor", "capacity",
           "rowCount", "columnCount", "isActive", "campusId"
    FROM "exam_rooms"
    ${andWhere(conditions)}
    ORDER BY "name" ASC
    LIMIT 200
  `);
}

export async function createExamRoom(
  institutionId: string,
  actor: AuthenticatedUser,
  input: {
    name: string;
    code: string;
    capacity: number;
    campusId?: string;
    building?: string;
    floor?: string;
    rowCount?: number;
    columnCount?: number;
  },
  meta: { ipAddress?: string; userAgent?: string }
) {
  assertExamController(actor);
  if (input.campusId) {
    await assertTenantReference(
      prisma,
      "campuses",
      institutionId,
      input.campusId,
      "Campus"
    );
  }

  const id = randomUUID();
  const code = input.code.trim().toUpperCase().replace(/\s+/g, "_");

  await prisma.$executeRaw`
    INSERT INTO "exam_rooms"
      ("id", "institutionId", "campusId", "name", "code", "building",
       "floor", "capacity", "rowCount", "columnCount")
    VALUES
      (${id}, ${institutionId}, ${input.campusId ?? null}, ${input.name.trim()},
       ${code}, ${input.building ?? null}, ${input.floor ?? null},
       ${input.capacity}, ${input.rowCount ?? null}, ${input.columnCount ?? null})
  `;

  await recordAuditLog({
    institutionId,
    userId: actor.id,
    action: "exam.room_created",
    entityType: "ExamRoom",
    entityId: id,
    metadata: { code, capacity: input.capacity },
    ...meta,
  });

  return requireTenantRow(prisma, "exam_rooms", institutionId, id, "Exam room");
}

export async function updateExamRoom(
  institutionId: string,
  actor: AuthenticatedUser,
  examRoomId: string,
  input: {
    name?: string;
    capacity?: number;
    building?: string;
    floor?: string;
    isActive?: boolean;
  },
  meta: { ipAddress?: string; userAgent?: string }
) {
  assertExamController(actor);
  await requireTenantRow(
    prisma,
    "exam_rooms",
    institutionId,
    examRoomId,
    "Exam room"
  );

  await prisma.$executeRaw`
    UPDATE "exam_rooms"
    SET "name" = COALESCE(${input.name ?? null}, "name"),
        "capacity" = COALESCE(${input.capacity ?? null}, "capacity"),
        "building" = COALESCE(${input.building ?? null}, "building"),
        "floor" = COALESCE(${input.floor ?? null}, "floor"),
        "isActive" = COALESCE(${input.isActive ?? null}, "isActive")
    WHERE "id" = ${examRoomId} AND "institutionId" = ${institutionId}
  `;

  await recordAuditLog({
    institutionId,
    userId: actor.id,
    action: "exam.room_updated",
    entityType: "ExamRoom",
    entityId: examRoomId,
    metadata: { changed: Object.keys(input) },
    ...meta,
  });

  return requireTenantRow(
    prisma,
    "exam_rooms",
    institutionId,
    examRoomId,
    "Exam room"
  );
}

// ==========================================================
// EXAM SCHEDULES
// ==========================================================

export async function createExamSchedule(
  institutionId: string,
  actor: AuthenticatedUser,
  input: {
    examSessionId: string;
    courseOfferingId: string;
    examDate: Date;
    startTime: string;
    endTime: string;
    maxMarks: number;
    passMarks: number;
    instructions?: string;
  },
  meta: { ipAddress?: string; userAgent?: string }
) {
  assertExamController(actor);
  const session = await loadSession(institutionId, input.examSessionId);
  if (["PUBLISHED", "CANCELLED", "COMPLETED"].includes(session.status)) {
    throw new AppError(
      "Schedules cannot be added to a completed or published session",
      409
    );
  }
  await loadCourseOfferingOrThrow(institutionId, input.courseOfferingId);

  if (input.passMarks > input.maxMarks) {
    throw new AppError("passMarks cannot exceed maxMarks", 400);
  }
  if (input.endTime <= input.startTime) {
    throw new AppError("endTime must be after startTime", 400);
  }

  // A student must never be double-booked: reject a second paper for the
  // same section on the same date in an overlapping window.
  const clash = await prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
    SELECT s."id"
    FROM "exam_schedules" s
    JOIN "course_offerings" a ON a."id" = s."courseOfferingId"
    JOIN "course_offerings" b ON b."id" = ${input.courseOfferingId}
    WHERE s."institutionId" = ${institutionId}
      AND s."status" <> 'CANCELLED'
      AND s."examDate" = ${input.examDate}
      AND a."sectionId" = b."sectionId"
      AND s."startTime" < ${input.endTime}
      AND s."endTime" > ${input.startTime}
    LIMIT 1
  `);
  if (clash.length > 0) {
    throw new AppError(
      "This section already has an examination in that time window",
      409
    );
  }

  const id = randomUUID();
  await prisma.$executeRaw`
    INSERT INTO "exam_schedules"
      ("id", "institutionId", "examSessionId", "courseOfferingId", "examDate",
       "startTime", "endTime", "maxMarks", "passMarks", "status",
       "instructions", "createdById")
    VALUES
      (${id}, ${institutionId}, ${input.examSessionId}, ${input.courseOfferingId},
       ${input.examDate}, ${input.startTime}, ${input.endTime}, ${input.maxMarks},
       ${input.passMarks}, 'DRAFT', ${input.instructions ?? null}, ${actor.id})
  `;

  await recordAuditLog({
    institutionId,
    userId: actor.id,
    action: "exam.schedule_created",
    entityType: "ExamSchedule",
    entityId: id,
    metadata: {
      examSessionId: input.examSessionId,
      courseOfferingId: input.courseOfferingId,
    },
    ...meta,
  });

  return loadSchedule(institutionId, id);
}

export async function updateExamSchedule(
  institutionId: string,
  actor: AuthenticatedUser,
  examScheduleId: string,
  input: {
    examDate?: Date;
    startTime?: string;
    endTime?: string;
    maxMarks?: number;
    passMarks?: number;
    instructions?: string;
    status?: string;
  },
  meta: { ipAddress?: string; userAgent?: string }
) {
  assertExamController(actor);
  const schedule = await loadSchedule(institutionId, examScheduleId);

  if (["LOCKED", "RESULTS_PUBLISHED"].includes(schedule.status)) {
    throw new AppError(
      "A locked or published schedule can no longer be edited",
      409
    );
  }

  if (input.status) {
    const status = assertValue(input.status, SCHEDULE_STATUSES, "status");
    if (!["DRAFT", "PUBLISHED", "CANCELLED"].includes(status)) {
      throw new AppError(
        "Locking and publication have dedicated endpoints",
        400
      );
    }
  }

  await prisma.$executeRaw`
    UPDATE "exam_schedules"
    SET "examDate" = COALESCE(${input.examDate ?? null}, "examDate"),
        "startTime" = COALESCE(${input.startTime ?? null}, "startTime"),
        "endTime" = COALESCE(${input.endTime ?? null}, "endTime"),
        "maxMarks" = COALESCE(${input.maxMarks ?? null}, "maxMarks"),
        "passMarks" = COALESCE(${input.passMarks ?? null}, "passMarks"),
        "instructions" = COALESCE(${input.instructions ?? null}, "instructions"),
        "status" = COALESCE(${input.status ?? null}, "status")
    WHERE "id" = ${examScheduleId} AND "institutionId" = ${institutionId}
  `;

  await recordAuditLog({
    institutionId,
    userId: actor.id,
    action: "exam.schedule_updated",
    entityType: "ExamSchedule",
    entityId: examScheduleId,
    metadata: { changed: Object.keys(input) },
    ...meta,
  });

  return loadSchedule(institutionId, examScheduleId);
}

export async function getExamScheduleDetail(
  institutionId: string,
  actor: AuthenticatedUser,
  examScheduleId: string
) {
  const schedule = await loadSchedule(institutionId, examScheduleId);
  await assertCanReadSchedule(institutionId, actor, schedule);

  const [offering, seats, invigilators, attendance] = await Promise.all([
    loadCourseOfferingOrThrow(institutionId, schedule.courseOfferingId),
    prisma.$queryRaw<
      Array<{
        studentId: string;
        seatNumber: string;
        roomName: string;
        firstName: string;
        lastName: string;
      }>
    >(Prisma.sql`
      SELECT a."studentId", a."seatNumber", r."name" AS "roomName",
             u."firstName", u."lastName"
      FROM "exam_seat_allocations" a
      JOIN "exam_rooms" r ON r."id" = a."examRoomId"
      JOIN "users" u ON u."id" = a."studentId"
      WHERE a."examScheduleId" = ${examScheduleId}
        AND a."institutionId" = ${institutionId}
      ORDER BY r."name" ASC, a."seatNumber" ASC
    `),
    prisma.$queryRaw<
      Array<{
        facultyId: string;
        dutyRole: string;
        roomName: string;
        firstName: string;
        lastName: string;
      }>
    >(Prisma.sql`
      SELECT i."facultyId", i."dutyRole", r."name" AS "roomName",
             u."firstName", u."lastName"
      FROM "exam_invigilators" i
      JOIN "exam_rooms" r ON r."id" = i."examRoomId"
      JOIN "users" u ON u."id" = i."facultyId"
      WHERE i."examScheduleId" = ${examScheduleId}
        AND i."institutionId" = ${institutionId}
      ORDER BY r."name" ASC
    `),
    prisma.$queryRaw<
      Array<{ studentId: string; status: string; bookletNumber: string | null }>
    >(Prisma.sql`
      SELECT "studentId", "status", "bookletNumber"
      FROM "exam_attendances"
      WHERE "examScheduleId" = ${examScheduleId}
        AND "institutionId" = ${institutionId}
    `),
  ]);

  return { schedule, offering, seats, invigilators, attendance };
}

// ==========================================================
// SEATING
// ==========================================================

/**
 * Allocates every rostered student of the offering across the chosen
 * rooms. Seats are laid out room by room in roster order so a printed
 * seating chart and the hall tickets agree. Re-running replaces the
 * previous allocation inside one transaction.
 */
export async function allocateSeating(
  institutionId: string,
  actor: AuthenticatedUser,
  examScheduleId: string,
  roomIds: string[],
  meta: { ipAddress?: string; userAgent?: string }
) {
  assertExamController(actor);
  const schedule = await loadSchedule(institutionId, examScheduleId);
  if (["LOCKED", "RESULTS_PUBLISHED", "CANCELLED"].includes(schedule.status)) {
    throw new AppError(
      "Seating cannot be changed after the schedule is locked",
      409
    );
  }
  if (roomIds.length === 0) {
    throw new AppError("At least one examination room is required", 400);
  }

  const rooms = await prisma.$queryRaw<
    Array<{ id: string; name: string; code: string; capacity: number }>
  >(Prisma.sql`
    SELECT "id", "name", "code", "capacity"
    FROM "exam_rooms"
    WHERE "institutionId" = ${institutionId}
      AND "isActive" = TRUE
      AND "id" IN (${Prisma.join(roomIds)})
    ORDER BY "name" ASC
  `);
  if (rooms.length !== new Set(roomIds).size) {
    throw new AppError(
      "One or more rooms are not active in this institution",
      404
    );
  }

  const roster = await getCourseOfferingRoster(
    institutionId,
    schedule.courseOfferingId
  );
  if (roster.length === 0) {
    throw new AppError(
      "This course offering has no active students to seat",
      409
    );
  }

  const totalCapacity = rooms.reduce((sum, room) => sum + room.capacity, 0);
  if (totalCapacity < roster.length) {
    throw new AppError(
      `Selected rooms seat ${totalCapacity} but ${roster.length} students are rostered`,
      409
    );
  }

  const ordered = [...roster].sort((a, b) =>
    (a.rollNumber ?? "").localeCompare(b.rollNumber ?? "")
  );

  const allocations: Array<{
    studentId: string;
    roomId: string;
    seatNumber: string;
  }> = [];
  let cursor = 0;
  for (const room of rooms) {
    for (let seat = 1; seat <= room.capacity && cursor < ordered.length; seat += 1) {
      allocations.push({
        studentId: ordered[cursor].studentId,
        roomId: room.id,
        seatNumber: `${room.code}-${String(seat).padStart(3, "0")}`,
      });
      cursor += 1;
    }
    if (cursor >= ordered.length) break;
  }

  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      DELETE FROM "exam_seat_allocations"
      WHERE "examScheduleId" = ${examScheduleId}
        AND "institutionId" = ${institutionId}
    `;
    for (const allocation of allocations) {
      await tx.$executeRaw`
        INSERT INTO "exam_seat_allocations"
          ("id", "institutionId", "examScheduleId", "examRoomId", "studentId", "seatNumber")
        VALUES
          (${randomUUID()}, ${institutionId}, ${examScheduleId},
           ${allocation.roomId}, ${allocation.studentId}, ${allocation.seatNumber})
      `;
    }
  });

  await recordAuditLog({
    institutionId,
    userId: actor.id,
    action: "exam.seating_allocated",
    entityType: "ExamSchedule",
    entityId: examScheduleId,
    metadata: { rooms: rooms.map((r) => r.code), seated: allocations.length },
    ...meta,
  });

  return { seated: allocations.length, rooms: rooms.length };
}

// ==========================================================
// INVIGILATION
// ==========================================================

export async function assignInvigilators(
  institutionId: string,
  actor: AuthenticatedUser,
  examScheduleId: string,
  assignments: Array<{ facultyId: string; examRoomId: string; dutyRole?: string }>,
  meta: { ipAddress?: string; userAgent?: string }
) {
  assertExamController(actor);
  const schedule = await loadSchedule(institutionId, examScheduleId);
  if (["RESULTS_PUBLISHED", "CANCELLED"].includes(schedule.status)) {
    throw new AppError(
      "Invigilation cannot be changed after results are published",
      409
    );
  }

  const facultyIds = Array.from(new Set(assignments.map((a) => a.facultyId)));
  const validFaculty = await prisma.user.count({
    where: {
      institutionId,
      isActive: true,
      id: { in: facultyIds },
      userRoles: { some: { role: { name: { in: ["FACULTY", "HOD", "STAFF"] } } } },
    },
  });
  if (validFaculty !== facultyIds.length) {
    throw new AppError(
      "One or more invigilators are not active staff in this institution",
      404
    );
  }

  // The same person cannot invigilate two papers at once.
  const conflicts = await prisma.$queryRaw<{ facultyId: string }[]>(Prisma.sql`
    SELECT DISTINCT i."facultyId"
    FROM "exam_invigilators" i
    JOIN "exam_schedules" s ON s."id" = i."examScheduleId"
    WHERE i."institutionId" = ${institutionId}
      AND i."examScheduleId" <> ${examScheduleId}
      AND s."examDate" = ${schedule.examDate}
      AND s."status" <> 'CANCELLED'
      AND s."startTime" < ${schedule.endTime}
      AND s."endTime" > ${schedule.startTime}
      AND i."facultyId" IN (${Prisma.join(facultyIds)})
  `);
  if (conflicts.length > 0) {
    throw new AppError(
      "One or more invigilators are already on duty in that time window",
      409
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      DELETE FROM "exam_invigilators"
      WHERE "examScheduleId" = ${examScheduleId}
        AND "institutionId" = ${institutionId}
    `;
    for (const assignment of assignments) {
      await assertTenantReference(
        tx,
        "exam_rooms",
        institutionId,
        assignment.examRoomId,
        "Exam room"
      );
      await tx.$executeRaw`
        INSERT INTO "exam_invigilators"
          ("id", "institutionId", "examScheduleId", "examRoomId", "facultyId",
           "dutyRole", "assignedById")
        VALUES
          (${randomUUID()}, ${institutionId}, ${examScheduleId},
           ${assignment.examRoomId}, ${assignment.facultyId},
           ${assignment.dutyRole === "CHIEF" ? "CHIEF" : "ASSISTANT"}, ${actor.id})
      `;
    }
  });

  await recordAuditLog({
    institutionId,
    userId: actor.id,
    action: "exam.invigilators_assigned",
    entityType: "ExamSchedule",
    entityId: examScheduleId,
    metadata: { count: assignments.length },
    ...meta,
  });

  return { assigned: assignments.length };
}

export async function listMyInvigilationDuties(
  institutionId: string,
  actor: AuthenticatedUser
) {
  return prisma.$queryRaw<
    Array<{
      examScheduleId: string;
      examDate: Date;
      startTime: string;
      endTime: string;
      roomName: string;
      dutyRole: string;
      courseCode: string;
      courseName: string;
    }>
  >(Prisma.sql`
    SELECT s."id" AS "examScheduleId", s."examDate", s."startTime", s."endTime",
           r."name" AS "roomName", i."dutyRole",
           c."code" AS "courseCode", c."name" AS "courseName"
    FROM "exam_invigilators" i
    JOIN "exam_schedules" s ON s."id" = i."examScheduleId"
    JOIN "exam_rooms" r ON r."id" = i."examRoomId"
    JOIN "course_offerings" co ON co."id" = s."courseOfferingId"
    JOIN "courses" c ON c."id" = co."courseId"
    WHERE i."institutionId" = ${institutionId}
      AND i."facultyId" = ${actor.id}
      AND s."status" <> 'CANCELLED'
    ORDER BY s."examDate" ASC, s."startTime" ASC
    LIMIT 200
  `);
}

// ==========================================================
// HALL TICKETS
// ==========================================================

/**
 * Issues hall tickets for every student seated in the session.
 * A student is blocked (ticket still created, but status BLOCKED with a
 * reason) when attendance is below the governing policy or fees are
 * overdue — the institution then has an auditable record of why.
 */
export async function generateHallTickets(
  institutionId: string,
  actor: AuthenticatedUser,
  examSessionId: string,
  meta: { ipAddress?: string; userAgent?: string }
) {
  assertExamController(actor);
  const session = await loadSession(institutionId, examSessionId);
  if (session.status === "DRAFT") {
    throw new AppError(
      "Schedule the session before issuing hall tickets",
      409
    );
  }

  const students = await prisma.$queryRaw<
    Array<{ studentId: string }>
  >(Prisma.sql`
    SELECT DISTINCT a."studentId"
    FROM "exam_seat_allocations" a
    JOIN "exam_schedules" s ON s."id" = a."examScheduleId"
    WHERE s."examSessionId" = ${examSessionId}
      AND a."institutionId" = ${institutionId}
  `);
  if (students.length === 0) {
    throw new AppError(
      "Allocate seating before issuing hall tickets",
      409
    );
  }

  const year = new Date(session.startDate).getUTCFullYear();
  const prefix = `HT${year}-`;

  const results = { issued: 0, blocked: 0 };

  await prisma.$transaction(async (tx) => {
    for (const { studentId } of students) {
      const [attendance, dues] = await Promise.all([
        getStudentAttendancePercentage(institutionId, studentId),
        tx.$queryRaw<{ outstanding: number | null }[]>(Prisma.sql`
          SELECT SUM("amount" - "paidAmount" + "lateFeeAmount")::float AS "outstanding"
          FROM "fee_invoices"
          WHERE "institutionId" = ${institutionId}
            AND "studentId" = ${studentId}
            AND "status" <> 'CANCELLED'
            AND "dueDate" IS NOT NULL
            AND "dueDate" < CURRENT_TIMESTAMP
        `),
      ]);

      const reasons: string[] = [];
      const registration = await tx.$queryRaw<Array<{status:string;feeStatus:string}>>(Prisma.sql`
        SELECT "status","feeStatus" FROM "exam_registrations"
        WHERE "institutionId"=${institutionId} AND "examSessionId"=${examSessionId}
          AND "studentId"=${studentId} LIMIT 1
      `);
      if (session.registrationRequired && registration[0]?.status !== "REGISTERED") {
        reasons.push("Examination registration is not confirmed");
      }
      if (session.registrationRequired && registration[0]?.feeStatus === "PENDING") {
        reasons.push("Examination fee is pending");
      }
      const holds = await tx.$queryRaw<Array<{reason:string}>>(Prisma.sql`
        SELECT "reason" FROM "admit_card_holds"
        WHERE "institutionId"=${institutionId} AND "examSessionId"=${examSessionId}
          AND "studentId"=${studentId} AND "status"='ACTIVE'
      `);
      reasons.push(...holds.map(h => h.reason));
      if (
        attendance.policy.blockHallTicket &&
        attendance.percentage !== null &&
        attendance.percentage < attendance.policy.minPercentage
      ) {
        reasons.push(
          `Attendance ${attendance.percentage}% is below the required ${attendance.policy.minPercentage}%`
        );
      }
      const outstanding = dues[0]?.outstanding ?? 0;
      if (outstanding > 0) {
        reasons.push(`Outstanding fees of ${outstanding.toFixed(2)}`);
      }

      const blocked = reasons.length > 0;
      const existing = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`
        SELECT "id" FROM "hall_tickets"
        WHERE "examSessionId" = ${examSessionId} AND "studentId" = ${studentId}
        LIMIT 1
      `);

      if (existing.length > 0) {
        await tx.$executeRaw`
          UPDATE "hall_tickets"
          SET "status" = ${blocked ? "BLOCKED" : "ISSUED"},
              "blockedReason" = ${blocked ? reasons.join("; ") : null}
          WHERE "id" = ${existing[0].id}
        `;
      } else {
        const serial = await nextSequenceNumber(tx, {
          table: "hall_tickets",
          column: "serialNumber",
          institutionId,
          prefix,
        });
        await tx.$executeRaw`
          INSERT INTO "hall_tickets"
            ("id", "institutionId", "examSessionId", "studentId", "serialNumber",
             "status", "blockedReason", "issuedById")
          VALUES
            (${randomUUID()}, ${institutionId}, ${examSessionId}, ${studentId},
             ${serial}, ${blocked ? "BLOCKED" : "ISSUED"},
             ${blocked ? reasons.join("; ") : null}, ${actor.id})
        `;
      }

      if (blocked) results.blocked += 1;
      else results.issued += 1;
    }
  });

  await prisma.$executeRaw`
    UPDATE "exam_sessions"
    SET "admitCardStatus" = CASE WHEN ${results.issued} > 0 THEN 'ISSUED' ELSE 'ON_HOLD' END
    WHERE "id"=${examSessionId} AND "institutionId"=${institutionId}
  `;

  await recordAuditLog({
    institutionId,
    userId: actor.id,
    action: "exam.hall_tickets_generated",
    entityType: "ExamSession",
    entityId: examSessionId,
    metadata: results,
    ...meta,
  });

  return results;
}

/** Overrides a block once the underlying dues or shortage are settled. */
export async function updateHallTicketStatus(
  institutionId: string,
  actor: AuthenticatedUser,
  hallTicketId: string,
  status: "ISSUED" | "BLOCKED" | "REVOKED",
  reason: string | undefined,
  meta: { ipAddress?: string; userAgent?: string }
) {
  assertExamController(actor);
  await requireTenantRow(
    prisma,
    "hall_tickets",
    institutionId,
    hallTicketId,
    "Hall ticket"
  );

  await prisma.$executeRaw`
    UPDATE "hall_tickets"
    SET "status" = ${status}, "blockedReason" = ${reason ?? null}
    WHERE "id" = ${hallTicketId} AND "institutionId" = ${institutionId}
  `;

  await recordAuditLog({
    institutionId,
    userId: actor.id,
    action: "exam.hall_ticket_status_changed",
    entityType: "HallTicket",
    entityId: hallTicketId,
    metadata: { status, reason },
    ...meta,
  });

  return requireTenantRow(
    prisma,
    "hall_tickets",
    institutionId,
    hallTicketId,
    "Hall ticket"
  );
}

/**
 * A student's own hall ticket, including their per-paper seat.
 * Callers other than the student are re-checked against the shared
 * student-visibility rule, so parents see only their linked child.
 */

/**
 * Lists only hall tickets that are actually available to the student.
 *
 * This is intentionally independent of the student's generic upcoming-exam
 * feed. A hall ticket is a published examination document and must remain
 * discoverable even when the generic exam dashboard has different filters.
 */
export async function listStudentHallTickets(
  institutionId: string,
  actor: AuthenticatedUser,
  studentId: string
): Promise<Awaited<ReturnType<typeof getStudentHallTicket>>[]> {
  await assertCanViewStudent(institutionId, actor, studentId);

  const now = new Date();

  const tickets = await prisma.$queryRaw<
    Array<{ examSessionId: string }>
  >(Prisma.sql`
    SELECT DISTINCT h."examSessionId"
    FROM "hall_tickets" h
    JOIN "exam_sessions" es ON es."id" = h."examSessionId"
    WHERE h."institutionId" = ${institutionId}
      AND h."studentId" = ${studentId}
      AND h."status" = 'ISSUED'
      AND es."status" <> 'CANCELLED'
      AND (
        es."hallTicketReleaseAt" IS NULL
        OR es."hallTicketReleaseAt" <= ${now}
      )
    ORDER BY h."examSessionId"
  `);

  return Promise.all(
    tickets.map(({ examSessionId }) =>
      getStudentHallTicket(institutionId, actor, examSessionId, studentId)
    )
  );
}

export async function getStudentHallTicket(
  institutionId: string,
  actor: AuthenticatedUser,
  examSessionId: string,
  studentId: string
) {
  await assertCanViewStudent(institutionId, actor, studentId);
  const session = await loadSession(institutionId, examSessionId);

  const tickets = await prisma.$queryRaw<
    Array<{
      id: string;
      serialNumber: string;
      status: string;
      blockedReason: string | null;
      issuedAt: Date;
    }>
  >(Prisma.sql`
    SELECT "id", "serialNumber", "status", "blockedReason", "issuedAt"
    FROM "hall_tickets"
    WHERE "examSessionId" = ${examSessionId}
      AND "studentId" = ${studentId}
      AND "institutionId" = ${institutionId}
    LIMIT 1
  `);
  if (tickets.length === 0) {
    throw new AppError(
      "No hall ticket has been issued for this session yet",
      404
    );
  }

  if (session.hallTicketReleaseAt && session.hallTicketReleaseAt > new Date()) {
    if (actor.id === studentId || actor.roles.includes("PARENT")) {
      throw new AppError(
        "Hall tickets for this session have not been released yet",
        403
      );
    }
  }

  const papers = await prisma.$queryRaw<
    Array<{
      examScheduleId: string;
      examDate: Date;
      startTime: string;
      endTime: string;
      seatNumber: string;
      roomName: string;
      building: string | null;
      courseCode: string;
      courseName: string;
    }>
  >(Prisma.sql`
    SELECT s."id" AS "examScheduleId", s."examDate", s."startTime", s."endTime",
           a."seatNumber", r."name" AS "roomName", r."building",
           c."code" AS "courseCode", c."name" AS "courseName"
    FROM "exam_seat_allocations" a
    JOIN "exam_schedules" s ON s."id" = a."examScheduleId"
    JOIN "exam_rooms" r ON r."id" = a."examRoomId"
    JOIN "course_offerings" co ON co."id" = s."courseOfferingId"
    JOIN "courses" c ON c."id" = co."courseId"
    WHERE a."studentId" = ${studentId}
      AND a."institutionId" = ${institutionId}
      AND s."examSessionId" = ${examSessionId}
      AND s."status" <> 'CANCELLED'
    ORDER BY s."examDate" ASC, s."startTime" ASC
  `);

  return { session, ticket: tickets[0], papers };
}

export async function generateStudentHallTicketPdf(
  institutionId: string,
  actor: AuthenticatedUser,
  examSessionId: string,
  studentId: string,
): Promise<{ buffer: Buffer; filename: string }> {
  const ticket = await getStudentHallTicket(institutionId, actor, examSessionId, studentId);
  if (ticket.ticket.status !== "ISSUED") {
    throw new AppError("This hall ticket is not available for download.", 409);
  }

  const rows = await prisma.$queryRaw<Array<{
    firstName: string; lastName: string; rollNumber: string | null;
    enrollmentNumber: string | null; programName: string | null;
    departmentName: string | null; semesterName: string | null;
    institutionName: string; logoUrl: string | null; primaryColor: string | null;
    avatarUrl: string | null;
  }>>(Prisma.sql`
    SELECT u."firstName", u."lastName", se."rollNumber", sp."admissionNumber" AS "enrollmentNumber",
           p."name" AS "programName", d."name" AS "departmentName", sem."name" AS "semesterName",
           i."name" AS "institutionName", i."logoUrl", i."primaryColor", u."avatarUrl"
    FROM "users" u
    JOIN "student_profiles" sp ON sp."userId" = u."id"
    JOIN "institutions" i ON i."id" = u."institutionId"
    LEFT JOIN "student_enrollments" se ON se."studentId" = u."id"
      AND se."institutionId" = ${institutionId} AND se."status" = 'ACTIVE'
    LEFT JOIN "programs" p ON p."id" = se."programId"
    LEFT JOIN "departments" d ON d."id" = p."departmentId"
    LEFT JOIN "semesters" sem ON sem."id" = se."semesterId"
    WHERE u."id" = ${studentId} AND u."institutionId" = ${institutionId}
      AND u."isActive" = TRUE LIMIT 1
  `);
  if (!rows[0]) throw new AppError("Student profile could not be loaded for the hall ticket.", 404);

  const template = await getActiveAdmitCardTemplate(institutionId);
  const config = (template?.config ?? {}) as Record<string, unknown>;
  const fetchJpeg = async (url: string | null): Promise<Buffer | null> => {
    if (!url || !/^https?:\/\//i.test(url)) return null;
    try {
      const response = await fetch(url);
      if (!response.ok) return null;
      const type = response.headers.get("content-type") || "";
      if (!type.toLowerCase().includes("jpeg") && !type.toLowerCase().includes("jpg")) return null;
      return Buffer.from(await response.arrayBuffer());
    } catch { return null; }
  };
  const [logo, photo] = await Promise.all([fetchJpeg(rows[0].logoUrl), fetchJpeg(rows[0].avatarUrl)]);
  const verificationValue = createHash("sha256")
    .update(`${institutionId}:${examSessionId}:${ticket.ticket.serialNumber}:${studentId}`)
    .digest("hex").slice(0, 16).toUpperCase();

  const buffer = createAdmitCardPdf({
    institutionName: rows[0].institutionName,
    institutionAddress: null,
    institutionLogoJpeg: logo,
    institutionPrimaryColor: rows[0].primaryColor,
    examination: ticket.session.name,
    sessionCode: ticket.session.code,
    serialNumber: ticket.ticket.serialNumber,
    studentName: [rows[0].firstName, rows[0].lastName].filter(Boolean).join(" "),
    studentPhotoJpeg: photo,
    rollNumber: rows[0].rollNumber,
    enrollmentNumber: rows[0].enrollmentNumber,
    program: rows[0].programName,
    department: rows[0].departmentName,
    semester: rows[0].semesterName,
    instructions: ticket.session.instructions,
    verificationValue,
    config: config as never,
    papers: ticket.papers.map((paper) => ({
      code: paper.courseCode,
      name: paper.courseName,
      date: paper.examDate.toISOString().slice(0, 10),
      startTime: paper.startTime,
      endTime: paper.endTime,
      room: paper.roomName,
      seat: paper.seatNumber,
    })),
  });
  return { buffer, filename: "ACADLYX_" + ticket.ticket.serialNumber + "_AdmitCard.pdf" };
}


export async function generateStudentMarksheetPdf(
  institutionId: string,
  actor: AuthenticatedUser,
  examSessionId: string,
  studentId: string,
): Promise<{ buffer: Buffer; filename: string }> {
  await assertCanViewStudent(institutionId, actor, studentId);
  const session = await loadSession(institutionId, examSessionId);
  const rows = await prisma.$queryRaw<Array<{
    courseCode:string; courseName:string; examDate:Date; maxMarks:number; passMarks:number;
    marksObtained:number|null; isAbsent:boolean;
  }>>(Prisma.sql`
    SELECT c."code" AS "courseCode", c."name" AS "courseName", s."examDate",
           s."maxMarks", s."passMarks", m."marksObtained", m."isAbsent"
    FROM "exam_marks" m
    JOIN "exam_schedules" s ON s."id"=m."examScheduleId"
    JOIN "course_offerings" co ON co."id"=s."courseOfferingId"
    JOIN "courses" c ON c."id"=co."courseId"
    WHERE m."institutionId"=${institutionId} AND m."studentId"=${studentId}
      AND m."status"='PUBLISHED' AND s."examSessionId"=${examSessionId}
    ORDER BY s."examDate" ASC, c."code" ASC
  `);
  if (!rows.length) throw new AppError("No published result is available for this examination",404);
  const student = await prisma.$queryRaw<Array<{
    firstName:string;lastName:string;enrollmentNumber:string|null;program:string|null;department:string|null;semester:string|null;institutionName:string;
  }>>(Prisma.sql`
    SELECT u."firstName",u."lastName",sp."admissionNumber" AS "enrollmentNumber",
           p."name" AS "program",d."name" AS "department",sem."name" AS "semester",i."name" AS "institutionName"
    FROM "users" u JOIN "student_profiles" sp ON sp."userId"=u."id"
    JOIN "institutions" i ON i."id"=u."institutionId"
    LEFT JOIN "student_enrollments" se ON se."userId"=u."id" AND se."institutionId"=${institutionId} AND se."status"='ACTIVE'
    LEFT JOIN "programs" p ON p."id"=se."programId"
    LEFT JOIN "departments" d ON d."id"=p."departmentId"
    LEFT JOIN "semesters" sem ON sem."id"=se."semesterId"
    WHERE u."id"=${studentId} AND u."institutionId"=${institutionId} LIMIT 1
  `);
  if (!student[0]) throw new AppError("Student profile not found",404);
  const buffer=createMarksheetPdf({
    institutionName:student[0].institutionName,
    studentName:(student[0].firstName+" "+student[0].lastName).trim(),
    enrollmentNumber:student[0].enrollmentNumber,program:student[0].program,
    department:student[0].department,semester:student[0].semester,
    examination:session.name,sessionCode:session.code,
    rows:rows.map(r=>({code:r.courseCode,name:r.courseName,marks:r.marksObtained,max:r.maxMarks,pass:r.passMarks,absent:r.isAbsent}))
  });
  return {buffer,filename:"ACADLYX_"+session.code+"_Marksheet.pdf"};
}

// ==========================================================
// EXAM ATTENDANCE
// ==========================================================

export async function recordExamAttendance(
  institutionId: string,
  actor: AuthenticatedUser,
  examScheduleId: string,
  entries: Array<{
    studentId: string;
    status: string;
    bookletNumber?: string;
    remarks?: string;
  }>,
  meta: { ipAddress?: string; userAgent?: string }
) {
  const schedule = await loadSchedule(institutionId, examScheduleId);
  await assertCanConductSchedule(institutionId, actor, schedule);

  if (["RESULTS_PUBLISHED", "CANCELLED"].includes(schedule.status)) {
    throw new AppError(
      "Attendance cannot be changed after results are published",
      409
    );
  }

  const seated = await prisma.$queryRaw<{ studentId: string }[]>(Prisma.sql`
    SELECT "studentId" FROM "exam_seat_allocations"
    WHERE "examScheduleId" = ${examScheduleId}
      AND "institutionId" = ${institutionId}
  `);
  const seatedIds = new Set(seated.map((row) => row.studentId));

  for (const entry of entries) {
    assertValue(entry.status, EXAM_ATTENDANCE_STATUSES, "status");
    if (!seatedIds.has(entry.studentId)) {
      throw new AppError(
        "One or more students are not seated for this examination",
        400
      );
    }
  }

  await prisma.$transaction(async (tx) => {
    for (const entry of entries) {
      await tx.$executeRaw`
        INSERT INTO "exam_attendances"
          ("id", "institutionId", "examScheduleId", "studentId", "status",
           "bookletNumber", "remarks", "markedById")
        VALUES
          (${randomUUID()}, ${institutionId}, ${examScheduleId}, ${entry.studentId},
           ${entry.status}, ${entry.bookletNumber ?? null}, ${entry.remarks ?? null},
           ${actor.id})
        ON CONFLICT ("examScheduleId", "studentId") DO UPDATE
        SET "status" = EXCLUDED."status",
            "bookletNumber" = EXCLUDED."bookletNumber",
            "remarks" = EXCLUDED."remarks",
            "markedById" = EXCLUDED."markedById",
            "markedAt" = CURRENT_TIMESTAMP
      `;
    }
  });

  await recordAuditLog({
    institutionId,
    userId: actor.id,
    action: "exam.attendance_recorded",
    entityType: "ExamSchedule",
    entityId: examScheduleId,
    metadata: { count: entries.length },
    ...meta,
  });

  return { recorded: entries.length };
}

// ==========================================================
// MARKS
// ==========================================================

export async function getMarksSheet(
  institutionId: string,
  actor: AuthenticatedUser,
  examScheduleId: string
) {
  const schedule = await loadSchedule(institutionId, examScheduleId);
  await assertCanReadSchedule(institutionId, actor, schedule);

  const roster = await getCourseOfferingRoster(
    institutionId,
    schedule.courseOfferingId
  );

  const [marks, attendance] = await Promise.all([
    prisma.$queryRaw<
      Array<{
        studentId: string;
        marksObtained: number | null;
        isAbsent: boolean;
        status: ExamMarkStatus;
        remarks: string | null;
      }>
    >(Prisma.sql`
      SELECT "studentId", "marksObtained", "isAbsent", "status", "remarks"
      FROM "exam_marks"
      WHERE "examScheduleId" = ${examScheduleId}
        AND "institutionId" = ${institutionId}
    `),
    prisma.$queryRaw<Array<{ studentId: string; status: string }>>(Prisma.sql`
      SELECT "studentId", "status" FROM "exam_attendances"
      WHERE "examScheduleId" = ${examScheduleId}
        AND "institutionId" = ${institutionId}
    `),
  ]);

  const markByStudent = new Map(marks.map((row) => [row.studentId, row]));
  const attendanceByStudent = new Map(
    attendance.map((row) => [row.studentId, row.status])
  );

  return {
    schedule,
    rows: roster.map((student) => ({
      ...student,
      examAttendance: attendanceByStudent.get(student.studentId) ?? null,
      marksObtained: markByStudent.get(student.studentId)?.marksObtained ?? null,
      isAbsent: markByStudent.get(student.studentId)?.isAbsent ?? false,
      status: markByStudent.get(student.studentId)?.status ?? "DRAFT",
      remarks: markByStudent.get(student.studentId)?.remarks ?? null,
    })),
  };
}

/**
 * Saves or resubmits marks. Entries are written as DRAFT or SUBMITTED
 * only; approval and publication are separate, higher-authority steps.
 * Every write appends to exam_mark_histories so the paper trail survives
 * a later correction.
 */
export async function saveExamMarks(
  institutionId: string,
  actor: AuthenticatedUser,
  examScheduleId: string,
  entries: Array<{
    studentId: string;
    marksObtained?: number | null;
    isAbsent?: boolean;
    remarks?: string;
  }>,
  submit: boolean,
  meta: { ipAddress?: string; userAgent?: string }
) {
  const schedule = await loadSchedule(institutionId, examScheduleId);
  await assertCanActOnSchedule(institutionId, actor, schedule);

  if (schedule.status === "LOCKED" || schedule.status === "RESULTS_PUBLISHED") {
    throw new AppError(
      "Marks are locked. Raise a revaluation request to change a result.",
      409
    );
  }
  if (schedule.status === "CANCELLED") {
    throw new AppError("This examination has been cancelled", 409);
  }

  const roster = await getCourseOfferingRoster(
    institutionId,
    schedule.courseOfferingId
  );
  const rosterIds = new Set(roster.map((student) => student.studentId));

  for (const entry of entries) {
    if (!rosterIds.has(entry.studentId)) {
      throw new AppError(
        "One or more students are not on this course offering roster",
        400
      );
    }
    if (entry.isAbsent) continue;
    if (
      entry.marksObtained === null ||
      entry.marksObtained === undefined ||
      !Number.isFinite(entry.marksObtained)
    ) {
      throw new AppError(
        "marksObtained is required unless the student is marked absent",
        400
      );
    }
    if (entry.marksObtained < 0 || entry.marksObtained > schedule.maxMarks) {
      throw new AppError(
        `marksObtained must be between 0 and ${schedule.maxMarks}`,
        400
      );
    }
  }

  const nextStatus: ExamMarkStatus = submit ? "SUBMITTED" : "DRAFT";

  await prisma.$transaction(async (tx) => {
    for (const entry of entries) {
      const existing = await tx.$queryRaw<
        Array<{ id: string; marksObtained: number | null; status: ExamMarkStatus }>
      >(Prisma.sql`
        SELECT "id", "marksObtained", "status" FROM "exam_marks"
        WHERE "examScheduleId" = ${examScheduleId} AND "studentId" = ${entry.studentId}
        LIMIT 1
      `);

      if (existing[0] && ["APPROVED", "PUBLISHED"].includes(existing[0].status)) {
        throw new AppError(
          "Approved marks cannot be edited. Use revaluation instead.",
          409
        );
      }

      const marks = entry.isAbsent ? null : entry.marksObtained ?? null;
      const markId = existing[0]?.id ?? randomUUID();

      if (existing[0]) {
        await tx.$executeRaw`
          UPDATE "exam_marks"
          SET "marksObtained" = ${marks},
              "isAbsent" = ${entry.isAbsent ?? false},
              "remarks" = ${entry.remarks ?? null},
              "status" = ${nextStatus},
              "enteredById" = ${actor.id},
              "enteredAt" = CURRENT_TIMESTAMP
          WHERE "id" = ${markId}
        `;
      } else {
        await tx.$executeRaw`
          INSERT INTO "exam_marks"
            ("id", "institutionId", "examScheduleId", "studentId", "marksObtained",
             "isAbsent", "status", "remarks", "enteredById")
          VALUES
            (${markId}, ${institutionId}, ${examScheduleId}, ${entry.studentId},
             ${marks}, ${entry.isAbsent ?? false}, ${nextStatus},
             ${entry.remarks ?? null}, ${actor.id})
        `;
      }

      await tx.$executeRaw`
        INSERT INTO "exam_mark_histories"
          ("id", "institutionId", "examMarkId", "previousMarks", "newMarks",
           "previousStatus", "newStatus", "reason", "changedById")
        VALUES
          (${randomUUID()}, ${institutionId}, ${markId},
           ${existing[0]?.marksObtained ?? null}, ${marks},
           ${existing[0]?.status ?? null}, ${nextStatus},
           ${submit ? "Marks submitted for approval" : "Marks saved as draft"},
           ${actor.id})
      `;
    }
  });

  await recordAuditLog({
    institutionId,
    userId: actor.id,
    action: submit ? "exam.marks_submitted" : "exam.marks_saved",
    entityType: "ExamSchedule",
    entityId: examScheduleId,
    metadata: { count: entries.length },
    ...meta,
  });

  return { saved: entries.length, status: nextStatus };
}

/** Approves every submitted mark on a schedule. Entry author may not approve. */
export async function approveExamMarks(
  institutionId: string,
  actor: AuthenticatedUser,
  examScheduleId: string,
  meta: { ipAddress?: string; userAgent?: string }
) {
  assertExamApprover(actor);
  const schedule = await loadSchedule(institutionId, examScheduleId);

  const pending = await prisma.$queryRaw<
    Array<{ id: string; enteredById: string; marksObtained: number | null; status: string }>
  >(Prisma.sql`
    SELECT "id", "enteredById", "marksObtained", "status"
    FROM "exam_marks"
    WHERE "examScheduleId" = ${examScheduleId}
      AND "institutionId" = ${institutionId}
      AND "status" = 'SUBMITTED'
  `);

  if (pending.length === 0) {
    throw new AppError("There are no submitted marks awaiting approval", 409);
  }
  if (pending.some((mark) => mark.enteredById === actor.id)) {
    throw new AppError(
      "Marks must be approved by someone other than the person who entered them",
      403
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      UPDATE "exam_marks"
      SET "status" = 'APPROVED', "approvedById" = ${actor.id},
          "approvedAt" = CURRENT_TIMESTAMP
      WHERE "examScheduleId" = ${examScheduleId}
        AND "institutionId" = ${institutionId}
        AND "status" = 'SUBMITTED'
    `;
    for (const mark of pending) {
      await tx.$executeRaw`
        INSERT INTO "exam_mark_histories"
          ("id", "institutionId", "examMarkId", "previousMarks", "newMarks",
           "previousStatus", "newStatus", "reason", "changedById")
        VALUES
          (${randomUUID()}, ${institutionId}, ${mark.id}, ${mark.marksObtained},
           ${mark.marksObtained}, ${mark.status}, 'APPROVED',
           'Approved by examination controller', ${actor.id})
      `;
    }
  });

  await recordAuditLog({
    institutionId,
    userId: actor.id,
    action: "exam.marks_approved",
    entityType: "ExamSchedule",
    entityId: examScheduleId,
    metadata: { count: pending.length, scheduleStatus: schedule.status },
    ...meta,
  });

  return { approved: pending.length };
}

export async function lockExamSchedule(
  institutionId: string,
  actor: AuthenticatedUser,
  examScheduleId: string,
  meta: { ipAddress?: string; userAgent?: string }
) {
  assertExamApprover(actor);
  const schedule = await loadSchedule(institutionId, examScheduleId);
  if (schedule.status === "LOCKED" || schedule.status === "RESULTS_PUBLISHED") {
    throw new AppError("This schedule is already locked", 409);
  }

  const roster = await getCourseOfferingRoster(institutionId, schedule.courseOfferingId);
  const enteredCount = await countRows(prisma, "exam_marks", Prisma.sql`WHERE "examScheduleId"=${examScheduleId} AND "institutionId"=${institutionId}`);
  if (enteredCount !== roster.length) {
    throw new AppError(`Cannot lock results: ${roster.length - enteredCount} student mark(s) are missing`,409);
  }
  const outstanding = await countRows(
    prisma,
    "exam_marks",
    Prisma.sql`WHERE "examScheduleId" = ${examScheduleId}
      AND "institutionId" = ${institutionId}
      AND "status" <> 'APPROVED'`
  );
  if (outstanding > 0) {
    throw new AppError(
      `${outstanding} mark(s) are not approved yet`,
      409
    );
  }

  await prisma.$executeRaw`
    UPDATE "exam_schedules"
    SET "status" = 'LOCKED', "marksLockedAt" = CURRENT_TIMESTAMP,
        "marksLockedById" = ${actor.id}
    WHERE "id" = ${examScheduleId} AND "institutionId" = ${institutionId}
  `;
  const approvedCount = await countRows(prisma, "exam_marks", Prisma.sql`WHERE "examScheduleId"=${examScheduleId} AND "institutionId"=${institutionId} AND "status"='APPROVED'`);
  await prisma.$executeRaw`
    INSERT INTO "exam_result_publications" ("id","institutionId","examScheduleId","status","totalCandidates","processedCandidates","approvedById","approvedAt")
    VALUES (${randomUUID()},${institutionId},${examScheduleId},'APPROVED',${approvedCount},0,${actor.id},CURRENT_TIMESTAMP)
    ON CONFLICT ("examScheduleId") DO UPDATE SET
      "status"='APPROVED',"totalCandidates"=${approvedCount},"approvedById"=${actor.id},"approvedAt"=CURRENT_TIMESTAMP
  `;

  await recordAuditLog({
    institutionId,
    userId: actor.id,
    action: "exam.schedule_locked",
    entityType: "ExamSchedule",
    entityId: examScheduleId,
    ...meta,
  });

  return loadSchedule(institutionId, examScheduleId);
}

/**
 * Publishes a locked schedule's results.
 *
 * Publication mirrors approved marks into the Exam/ExamResult models
 * inside the same transaction, which is what makes the new examination
 * module show up in existing transcripts, grade sheets and CGPA without
 * duplicating the grading rules.
 */
export async function enqueuePublishExamResults(
  institutionId: string,
  actor: AuthenticatedUser,
  examScheduleId: string,
) {
  assertExamApprover(actor);
  const schedule = await loadSchedule(institutionId, examScheduleId);
  if (schedule.status !== "LOCKED") throw new AppError("Lock the schedule before publishing its results", 409);
  const marks = await prisma.$queryRaw<Array<{ count: number }>>(Prisma.sql`
    SELECT COUNT(*)::int AS count FROM "exam_marks"
    WHERE "examScheduleId" = ${examScheduleId} AND "institutionId" = ${institutionId} AND "status" = 'APPROVED'
  `);
  const total = marks[0]?.count ?? 0;
  if (!total) throw new AppError("There are no approved marks to publish", 409);
  const job = await enqueueJob({
    institutionId, type: JOB_TYPES.RESULT_PROCESSING,
    payload: { examScheduleId }, createdById: actor.id, total,
    priority: 10, maxAttempts: 2,
    idempotencyKey: "RESULT_PUBLICATION:" + examScheduleId,
  });
  return { jobId: job.id, status: job.status, total: job.total, progress: job.progress };
}

export async function publishExamResults(
  institutionId: string,
  actor: AuthenticatedUser,
  examScheduleId: string,
  meta: { ipAddress?: string; userAgent?: string }
) {
  assertExamApprover(actor);
  const schedule = await loadSchedule(institutionId, examScheduleId);
  if (schedule.status !== "LOCKED") {
    throw new AppError(
      "Lock the schedule before publishing its results",
      409
    );
  }

  const session = await loadSession(institutionId, schedule.examSessionId);
  const offering = await loadCourseOfferingOrThrow(
    institutionId,
    schedule.courseOfferingId
  );

  const marks = await prisma.$queryRaw<
    Array<{ id: string; studentId: string; marksObtained: number | null; isAbsent: boolean }>
  >(Prisma.sql`
    SELECT "id", "studentId", "marksObtained", "isAbsent"
    FROM "exam_marks"
    WHERE "examScheduleId" = ${examScheduleId}
      AND "institutionId" = ${institutionId}
      AND "status" = 'APPROVED'
  `);
  if (marks.length === 0) {
    throw new AppError("There are no approved marks to publish", 409);
  }

  const title = `${session.name} — ${offering.course.code}`;

  await prisma.$transaction(async (tx) => {
    let legacyExamId = schedule.legacyExamId;

    if (legacyExamId) {
      await tx.exam.update({
        where: { id: legacyExamId },
        data: {
          title,
          examDate: schedule.examDate,
          maxMarks: schedule.maxMarks,
        },
      });
    } else {
      const created = await tx.exam.create({
        data: {
          institutionId,
          courseOfferingId: schedule.courseOfferingId,
          title,
          examDate: schedule.examDate,
          maxMarks: schedule.maxMarks,
          createdById: actor.id,
        },
        select: { id: true },
      });
      legacyExamId = created.id;
      await tx.$executeRaw`
        UPDATE "exam_schedules" SET "legacyExamId" = ${legacyExamId}
        WHERE "id" = ${examScheduleId} AND "institutionId" = ${institutionId}
      `;
    }

    for (const mark of marks) {
      const value = mark.isAbsent ? 0 : mark.marksObtained ?? 0;
      await tx.examResult.upsert({
        where: {
          examId_studentId: { examId: legacyExamId, studentId: mark.studentId },
        },
        create: {
          institutionId,
          examId: legacyExamId,
          studentId: mark.studentId,
          marks: value,
          remarks: mark.isAbsent ? "ABSENT" : null,
          enteredById: actor.id,
        },
        update: {
          marks: value,
          remarks: mark.isAbsent ? "ABSENT" : null,
          enteredById: actor.id,
        },
      });

      await tx.$executeRaw`
        INSERT INTO "exam_mark_histories"
          ("id", "institutionId", "examMarkId", "previousMarks", "newMarks",
           "previousStatus", "newStatus", "reason", "changedById")
        VALUES
          (${randomUUID()}, ${institutionId}, ${mark.id}, ${mark.marksObtained},
           ${mark.marksObtained}, 'APPROVED', 'PUBLISHED',
           'Results published to transcript', ${actor.id})
      `;
    }

    await tx.$executeRaw`
      UPDATE "exam_marks"
      SET "status" = 'PUBLISHED', "publishedAt" = CURRENT_TIMESTAMP
      WHERE "examScheduleId" = ${examScheduleId}
        AND "institutionId" = ${institutionId}
        AND "status" = 'APPROVED'
    `;

    await tx.$executeRaw`
      UPDATE "exam_schedules"
      SET "status" = 'RESULTS_PUBLISHED', "resultsPublishedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${examScheduleId} AND "institutionId" = ${institutionId}
    `;
    await tx.$executeRaw`
      UPDATE "exam_sessions"
      SET "resultStatus"='PUBLISHED', "registrationStatus"=CASE WHEN "registrationRequired" THEN 'CLOSED' ELSE "registrationStatus" END
      WHERE "id"=${session.id} AND "institutionId"=${institutionId}
    `;
    await tx.$executeRaw`
      UPDATE "exam_result_publications"
      SET "status"='PUBLISHED',"processedCandidates"=${marks.length},
          "publishedById"=${actor.id},"publishedAt"=CURRENT_TIMESTAMP
      WHERE "examScheduleId"=${examScheduleId} AND "institutionId"=${institutionId}
    `;

    // Tell every affected student, in the same transaction, that their
    // result is available — no separate job that can silently not run.
    await tx.notification.createMany({
      data: marks.map((mark) => ({
        institutionId,
        userId: mark.studentId,
        title: "Examination result published",
        body: `${title} results are now available in your results page.`,
      })),
    });
  });

  await recordAuditLog({
    institutionId,
    userId: actor.id,
    action: "exam.results_published",
    entityType: "ExamSchedule",
    entityId: examScheduleId,
    metadata: { published: marks.length, course: offering.course.code },
    ...meta,
  });

  return { published: marks.length };
}

export async function getExamMarkHistory(
  institutionId: string,
  actor: AuthenticatedUser,
  examMarkId: string
) {
  const mark = await requireTenantRow<{ id: string; studentId: string }>(
    prisma,
    "exam_marks",
    institutionId,
    examMarkId,
    "Examination mark"
  );
  await assertCanViewStudent(institutionId, actor, mark.studentId);

  return prisma.$queryRaw<
    Array<{
      id: string;
      previousMarks: number | null;
      newMarks: number | null;
      previousStatus: string | null;
      newStatus: string;
      reason: string | null;
      createdAt: Date;
      changedByName: string;
    }>
  >(Prisma.sql`
    SELECT h."id", h."previousMarks", h."newMarks", h."previousStatus",
           h."newStatus", h."reason", h."createdAt",
           u."firstName" || ' ' || u."lastName" AS "changedByName"
    FROM "exam_mark_histories" h
    JOIN "users" u ON u."id" = h."changedById"
    WHERE h."examMarkId" = ${examMarkId}
      AND h."institutionId" = ${institutionId}
    ORDER BY h."createdAt" DESC
  `);
}

// ==========================================================
// REVALUATION
// ==========================================================

export async function requestRevaluation(
  institutionId: string,
  actor: AuthenticatedUser,
  input: { examScheduleId: string; studentId?: string; reason: string; feeAmount?: number },
  meta: { ipAddress?: string; userAgent?: string }
) {
  const studentId = input.studentId ?? actor.id;
  if (studentId !== actor.id) {
    // Staff may raise on a student's behalf, but only inside their scope.
    await assertCanViewStudent(institutionId, actor, studentId);
    if (!actor.permissions.includes("exams.manage")) {
      throw new AppError(
        "You are not authorized to raise a revaluation for another student",
        403
      );
    }
  }

  const schedule = await loadSchedule(institutionId, input.examScheduleId);
  if (schedule.status !== "RESULTS_PUBLISHED") {
    throw new AppError(
      "Revaluation can only be requested after results are published",
      409
    );
  }

  const marks = await prisma.$queryRaw<{ marksObtained: number | null }[]>(Prisma.sql`
    SELECT "marksObtained" FROM "exam_marks"
    WHERE "examScheduleId" = ${input.examScheduleId} AND "studentId" = ${studentId}
    LIMIT 1
  `);
  if (marks.length === 0) {
    throw new AppError("You have no published result for this examination", 404);
  }

  const id = randomUUID();
  try {
    await prisma.$executeRaw`
      INSERT INTO "revaluation_requests"
        ("id", "institutionId", "examScheduleId", "studentId", "reason",
         "status", "feeAmount", "originalMarks")
      VALUES
        (${id}, ${institutionId}, ${input.examScheduleId}, ${studentId},
         ${input.reason.trim()}, 'REQUESTED', ${input.feeAmount ?? 0},
         ${marks[0].marksObtained})
    `;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new AppError(
        "A revaluation request already exists for this examination",
        409
      );
    }
    throw error;
  }

  await recordAuditLog({
    institutionId,
    userId: actor.id,
    action: "exam.revaluation_requested",
    entityType: "RevaluationRequest",
    entityId: id,
    metadata: { examScheduleId: input.examScheduleId, studentId },
    ...meta,
  });

  return requireTenantRow(
    prisma,
    "revaluation_requests",
    institutionId,
    id,
    "Revaluation request"
  );
}

export async function listRevaluationRequests(
  institutionId: string,
  actor: AuthenticatedUser,
  pagination: PaginationParams,
  filters: { status?: string; examScheduleId?: string; mine?: boolean }
) {
  const conditions: Prisma.Sql[] = [
    Prisma.sql`r."institutionId" = ${institutionId}`,
  ];
  if (filters.status) conditions.push(Prisma.sql`r."status" = ${filters.status}`);
  if (filters.examScheduleId) {
    conditions.push(Prisma.sql`r."examScheduleId" = ${filters.examScheduleId}`);
  }
  // Students and parents never see the whole queue.
  if (filters.mine || actor.roles.includes("STUDENT")) {
    conditions.push(Prisma.sql`r."studentId" = ${actor.id}`);
  } else if (!isInstitutionWide(actor) && !actor.permissions.includes("exams.manage")) {
    conditions.push(Prisma.sql`r."studentId" = ${actor.id}`);
  }

  const where = andWhere(conditions);

  const [items, totalRows] = await Promise.all([
    prisma.$queryRaw<
      Array<{
        id: string;
        status: string;
        reason: string;
        originalMarks: number | null;
        revisedMarks: number | null;
        studentName: string;
        courseCode: string;
        examDate: Date;
        createdAt: Date;
      }>
    >(Prisma.sql`
      SELECT r."id", r."status", r."reason", r."originalMarks", r."revisedMarks",
             r."createdAt", r."feeAmount", r."decisionNote",
             u."firstName" || ' ' || u."lastName" AS "studentName",
             c."code" AS "courseCode", s."examDate"
      FROM "revaluation_requests" r
      JOIN "users" u ON u."id" = r."studentId"
      JOIN "exam_schedules" s ON s."id" = r."examScheduleId"
      JOIN "course_offerings" co ON co."id" = s."courseOfferingId"
      JOIN "courses" c ON c."id" = co."courseId"
      ${where}
      ORDER BY r."createdAt" DESC
      LIMIT ${pagination.take} OFFSET ${pagination.skip}
    `),
    prisma.$queryRaw<{ count: bigint }[]>(Prisma.sql`
      SELECT COUNT(*)::bigint AS "count"
      FROM "revaluation_requests" r
      ${where}
    `),
  ]);

  return { items, total: Number(totalRows[0]?.count ?? 0) };
}

/**
 * Decides a revaluation. A COMPLETED decision with revised marks rewrites
 * the published mark and the mirrored ExamResult atomically, so a
 * transcript can never show a mark the examination module has superseded.
 */
export async function decideRevaluation(
  institutionId: string,
  actor: AuthenticatedUser,
  revaluationId: string,
  input: { status: string; revisedMarks?: number; decisionNote?: string },
  meta: { ipAddress?: string; userAgent?: string }
) {
  assertExamController(actor);
  const request = await requireTenantRow<{
    id: string;
    examScheduleId: string;
    studentId: string;
    status: string;
    originalMarks: number | null;
  }>(
    prisma,
    "revaluation_requests",
    institutionId,
    revaluationId,
    "Revaluation request"
  );

  if (["COMPLETED", "REJECTED"].includes(request.status)) {
    throw new AppError("This revaluation has already been decided", 409);
  }

  const status = assertValue(
    input.status,
    ["IN_REVIEW", "COMPLETED", "REJECTED"] as const,
    "status"
  );

  const schedule = await loadSchedule(institutionId, request.examScheduleId);

  if (status === "COMPLETED") {
    if (input.revisedMarks === undefined) {
      throw new AppError("revisedMarks is required to complete a revaluation", 400);
    }
    if (input.revisedMarks < 0 || input.revisedMarks > schedule.maxMarks) {
      throw new AppError(
        `revisedMarks must be between 0 and ${schedule.maxMarks}`,
        400
      );
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      UPDATE "revaluation_requests"
      SET "status" = ${status},
          "revisedMarks" = ${input.revisedMarks ?? null},
          "decisionNote" = ${input.decisionNote ?? null},
          "reviewedById" = ${actor.id},
          "decidedAt" = CASE WHEN ${status} = 'IN_REVIEW' THEN NULL ELSE CURRENT_TIMESTAMP END
      WHERE "id" = ${revaluationId} AND "institutionId" = ${institutionId}
    `;

    if (status !== "COMPLETED" || input.revisedMarks === undefined) return;

    const existing = await tx.$queryRaw<
      Array<{ id: string; marksObtained: number | null; status: string }>
    >(Prisma.sql`
      SELECT "id", "marksObtained", "status" FROM "exam_marks"
      WHERE "examScheduleId" = ${request.examScheduleId}
        AND "studentId" = ${request.studentId}
      LIMIT 1
    `);
    if (existing.length === 0) return;

    await tx.$executeRaw`
      UPDATE "exam_marks"
      SET "marksObtained" = ${input.revisedMarks}, "isAbsent" = FALSE,
          "status" = 'PUBLISHED', "approvedById" = ${actor.id},
          "approvedAt" = CURRENT_TIMESTAMP, "publishedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${existing[0].id}
    `;

    await tx.$executeRaw`
      INSERT INTO "exam_mark_histories"
        ("id", "institutionId", "examMarkId", "previousMarks", "newMarks",
         "previousStatus", "newStatus", "reason", "changedById")
      VALUES
        (${randomUUID()}, ${institutionId}, ${existing[0].id},
         ${existing[0].marksObtained}, ${input.revisedMarks},
         ${existing[0].status}, 'PUBLISHED',
         ${`Revaluation ${revaluationId} completed`}, ${actor.id})
    `;

    if (schedule.legacyExamId) {
      await tx.examResult.upsert({
        where: {
          examId_studentId: {
            examId: schedule.legacyExamId,
            studentId: request.studentId,
          },
        },
        create: {
          institutionId,
          examId: schedule.legacyExamId,
          studentId: request.studentId,
          marks: input.revisedMarks,
          remarks: "REVALUATED",
          enteredById: actor.id,
        },
        update: {
          marks: input.revisedMarks,
          remarks: "REVALUATED",
          enteredById: actor.id,
        },
      });
    }

    await tx.notification.create({
      data: {
        institutionId,
        userId: request.studentId,
        title: "Revaluation completed",
        body: "Your revaluation has been processed and your result updated.",
      },
    });
  });

  await recordAuditLog({
    institutionId,
    userId: actor.id,
    action: "exam.revaluation_decided",
    entityType: "RevaluationRequest",
    entityId: revaluationId,
    metadata: {
      status,
      previousMarks: request.originalMarks,
      revisedMarks: input.revisedMarks,
    },
    ...meta,
  });

  return requireTenantRow(
    prisma,
    "revaluation_requests",
    institutionId,
    revaluationId,
    "Revaluation request"
  );
}

// ==========================================================
// MALPRACTICE / INCIDENTS
// ==========================================================

export async function reportExamIncident(
  institutionId: string,
  actor: AuthenticatedUser,
  input: {
    examScheduleId: string;
    studentId: string;
    category: string;
    description: string;
    severity?: string;
  },
  meta: { ipAddress?: string; userAgent?: string }
) {
  const schedule = await loadSchedule(institutionId, input.examScheduleId);
  await assertCanActOnSchedule(institutionId, actor, schedule);
  await assertCanViewStudent(institutionId, actor, input.studentId);

  const id = randomUUID();
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      INSERT INTO "exam_incidents"
        ("id", "institutionId", "examScheduleId", "studentId", "category",
         "description", "severity", "status", "reportedById")
      VALUES
        (${id}, ${institutionId}, ${input.examScheduleId}, ${input.studentId},
         ${input.category}, ${input.description.trim()},
         ${input.severity === "MAJOR" ? "MAJOR" : "MINOR"}, 'REPORTED', ${actor.id})
    `;

    // A reported incident immediately flags exam attendance so the marks
    // sheet cannot be finalised as if nothing happened.
    await tx.$executeRaw`
      UPDATE "exam_attendances"
      SET "status" = 'MALPRACTICE'
      WHERE "examScheduleId" = ${input.examScheduleId}
        AND "studentId" = ${input.studentId}
        AND "institutionId" = ${institutionId}
    `;
  });

  await recordAuditLog({
    institutionId,
    userId: actor.id,
    action: "exam.incident_reported",
    entityType: "ExamIncident",
    entityId: id,
    metadata: { studentId: input.studentId, category: input.category },
    ...meta,
  });

  return requireTenantRow(
    prisma,
    "exam_incidents",
    institutionId,
    id,
    "Examination incident"
  );
}

export async function listExamIncidents(
  institutionId: string,
  pagination: PaginationParams,
  filters: { status?: string; examScheduleId?: string }
) {
  const conditions: Prisma.Sql[] = [
    Prisma.sql`i."institutionId" = ${institutionId}`,
  ];
  if (filters.status) conditions.push(Prisma.sql`i."status" = ${filters.status}`);
  if (filters.examScheduleId) {
    conditions.push(Prisma.sql`i."examScheduleId" = ${filters.examScheduleId}`);
  }
  const where = andWhere(conditions);

  const [items, totalRows] = await Promise.all([
    prisma.$queryRaw<
      Array<{
        id: string;
        category: string;
        severity: string;
        status: string;
        description: string;
        studentName: string;
        courseCode: string;
        createdAt: Date;
      }>
    >(Prisma.sql`
      SELECT i."id", i."category", i."severity", i."status", i."description",
             i."actionTaken", i."createdAt",
             u."firstName" || ' ' || u."lastName" AS "studentName",
             c."code" AS "courseCode"
      FROM "exam_incidents" i
      JOIN "users" u ON u."id" = i."studentId"
      JOIN "exam_schedules" s ON s."id" = i."examScheduleId"
      JOIN "course_offerings" co ON co."id" = s."courseOfferingId"
      JOIN "courses" c ON c."id" = co."courseId"
      ${where}
      ORDER BY i."createdAt" DESC
      LIMIT ${pagination.take} OFFSET ${pagination.skip}
    `),
    prisma.$queryRaw<{ count: bigint }[]>(Prisma.sql`
      SELECT COUNT(*)::bigint AS "count" FROM "exam_incidents" i ${where}
    `),
  ]);

  return { items, total: Number(totalRows[0]?.count ?? 0) };
}

export async function decideExamIncident(
  institutionId: string,
  actor: AuthenticatedUser,
  incidentId: string,
  input: { status: string; actionTaken?: string },
  meta: { ipAddress?: string; userAgent?: string }
) {
  assertExamController(actor);
  const incident = await requireTenantRow<{
    id: string;
    studentId: string;
    examScheduleId: string;
    status: string;
  }>(prisma, "exam_incidents", institutionId, incidentId, "Examination incident");

  const status = assertValue(
    input.status,
    ["REPORTED", "UNDER_REVIEW", "UPHELD", "DISMISSED"] as const,
    "status"
  );

  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      UPDATE "exam_incidents"
      SET "status" = ${status}, "actionTaken" = ${input.actionTaken ?? null},
          "decidedById" = ${actor.id},
          "decidedAt" = CASE WHEN ${status} IN ('UPHELD','DISMISSED')
            THEN CURRENT_TIMESTAMP ELSE NULL END
      WHERE "id" = ${incidentId} AND "institutionId" = ${institutionId}
    `;

    if (status === "UPHELD") {
      // An upheld malpractice finding voids the paper.
      await tx.$executeRaw`
        UPDATE "exam_marks"
        SET "marksObtained" = 0, "isAbsent" = FALSE,
            "remarks" = 'Voided — malpractice upheld'
        WHERE "examScheduleId" = ${incident.examScheduleId}
          AND "studentId" = ${incident.studentId}
          AND "institutionId" = ${institutionId}
      `;
    }

    if (status === "DISMISSED") {
      await tx.$executeRaw`
        UPDATE "exam_attendances"
        SET "status" = 'PRESENT'
        WHERE "examScheduleId" = ${incident.examScheduleId}
          AND "studentId" = ${incident.studentId}
          AND "institutionId" = ${institutionId}
          AND "status" = 'MALPRACTICE'
      `;
    }
  });

  await recordAuditLog({
    institutionId,
    userId: actor.id,
    action: "exam.incident_decided",
    entityType: "ExamIncident",
    entityId: incidentId,
    metadata: { status, actionTaken: input.actionTaken },
    ...meta,
  });

  return requireTenantRow(
    prisma,
    "exam_incidents",
    institutionId,
    incidentId,
    "Examination incident"
  );
}

// ==========================================================
// STUDENT VIEW
// ==========================================================

/** Upcoming papers plus published results for one student. */
export async function getStudentExaminations(
  institutionId: string,
  actor: AuthenticatedUser,
  studentId: string
) {
  await assertCanViewStudent(institutionId, actor, studentId);

  const [upcoming, results] = await Promise.all([
    prisma.$queryRaw<
      Array<{
        examScheduleId: string;
        examSessionId: string;
        sessionName: string;
        courseCode: string;
        courseName: string;
        examDate: Date;
        startTime: string;
        endTime: string;
        roomName: string | null;
        seatNumber: string | null;
      }>
    >(Prisma.sql`
      SELECT s."id" AS "examScheduleId", s."examSessionId",
             es."name" AS "sessionName",
             c."code" AS "courseCode", c."name" AS "courseName",
             s."examDate", s."startTime", s."endTime",
             r."name" AS "roomName", a."seatNumber"
      FROM "exam_schedules" s
      JOIN "exam_sessions" es ON es."id" = s."examSessionId"
      JOIN "course_offerings" co ON co."id" = s."courseOfferingId"
      JOIN "courses" c ON c."id" = co."courseId"
      LEFT JOIN "exam_seat_allocations" a
        ON a."examScheduleId" = s."id" AND a."studentId" = ${studentId}
      LEFT JOIN "exam_rooms" r ON r."id" = a."examRoomId"
      WHERE s."institutionId" = ${institutionId}
        AND s."status" IN ('PUBLISHED', 'LOCKED')
        AND s."examDate" >= CURRENT_DATE - INTERVAL '1 day'
        AND a."studentId" IS NOT NULL
      ORDER BY s."examDate" ASC, s."startTime" ASC
      LIMIT 100
    `),
    prisma.$queryRaw<
      Array<{
        courseCode: string;
        courseName: string;
        sessionName: string;
        marksObtained: number | null;
        maxMarks: number;
        passMarks: number;
        isAbsent: boolean;
        publishedAt: Date | null;
      }>
    >(Prisma.sql`
      SELECT c."code" AS "courseCode", c."name" AS "courseName",
             es."name" AS "sessionName", m."marksObtained", s."maxMarks",
             s."passMarks", m."isAbsent", m."publishedAt"
      FROM "exam_marks" m
      JOIN "exam_schedules" s ON s."id" = m."examScheduleId"
      JOIN "exam_sessions" es ON es."id" = s."examSessionId"
      JOIN "course_offerings" co ON co."id" = s."courseOfferingId"
      JOIN "courses" c ON c."id" = co."courseId"
      WHERE m."institutionId" = ${institutionId}
        AND m."studentId" = ${studentId}
        AND m."status" = 'PUBLISHED'
      ORDER BY m."publishedAt" DESC
      LIMIT 200
    `),
  ]);

  return { upcoming, results };
}
/* ==========================================================
 * STUDENT REGISTRATION + CENTRAL ELIGIBILITY
 * ========================================================== */

type StudentExamContext = {
  studentId: string;
  institutionId: string;
  departmentId: string | null;
  departmentName: string | null;
  campusId: string | null;
  programId: string | null;
  programName: string | null;
  batchId: string | null;
  academicYearId: string | null;
  semesterId: string | null;
  sectionId: string | null;
  academicStatus: string | null;
};

function jsonStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

async function loadStudentExamContext(
  institutionId: string,
  studentId: string,
): Promise<StudentExamContext> {
  const row = await prisma.studentEnrollment.findFirst({
    where: { institutionId, userId: studentId, status: "ACTIVE" },
    orderBy: { createdAt: "desc" },
    select: {
      userId: true,
      institutionId: true,
      programId: true,
      batchId: true,
      academicYearId: true,
      semesterId: true,
      sectionId: true,
      program: {
        select: {
          id: true,
          name: true,
          departmentId: true,
          department: { select: { id: true, name: true, campusId: true } },
        },
      },
    },
  });
  if (!row) throw new AppError("No active academic enrollment was found for this student", 409);
  const student = await prisma.user.findFirst({
    where: { id: studentId, institutionId, isActive: true },
    select: { profile: { select: { status: true } } },
  });
  if (!student) throw new AppError("Student not found in this institution", 404);
  return {
    studentId,
    institutionId,
    departmentId: row.program.departmentId,
    departmentName: row.program.department.name,
    campusId: row.program.department.campusId,
    programId: row.programId,
    programName: row.program.name,
    batchId: row.batchId,
    academicYearId: row.academicYearId,
    semesterId: row.semesterId,
    sectionId: row.sectionId,
    academicStatus: student.profile?.status ?? "ACTIVE",
  };
}

function sessionTargetsStudent(session: ExamSessionRow, context: StudentExamContext): boolean {
  const studentIds = jsonStringArray(session.studentIds);
  if (studentIds.length > 0 && !studentIds.includes(context.studentId)) return false;
  const campuses = jsonStringArray(session.campusIds);
  const departments = jsonStringArray(session.departmentIds);
  const programs = jsonStringArray(session.programIds);
  const semesters = jsonStringArray(session.semesterIds);
  const sections = jsonStringArray(session.sectionIds);
  if (campuses.length && (!context.campusId || !campuses.includes(context.campusId))) return false;
  if (departments.length && (!context.departmentId || !departments.includes(context.departmentId))) return false;
  if (programs.length && (!context.programId || !programs.includes(context.programId))) return false;
  if (semesters.length && (!context.semesterId || !semesters.includes(context.semesterId))) return false;
  if (sections.length && (!context.sectionId || !sections.includes(context.sectionId))) return false;
  if (session.academicYearId && session.academicYearId !== context.academicYearId) return false;
  if (session.semesterId && session.semesterId !== context.semesterId) return false;
  return true;
}

async function evaluateExamEligibility(
  institutionId: string,
  actor: AuthenticatedUser,
  examSessionId: string,
  studentId: string,
) {
  const session = await loadSession(institutionId, examSessionId);
  const context = await loadStudentExamContext(institutionId, studentId);
  const reasons: string[] = [];
  let status = "ELIGIBLE";
  if (!sessionTargetsStudent(session, context)) {
    status = "INELIGIBLE"; reasons.push("Student is outside the examination target scope");
  }
  if (!["ACTIVE"].includes(context.academicStatus ?? "ACTIVE")) {
    status = "INELIGIBLE"; reasons.push(`Academic status is ${context.academicStatus}`);
  }
  const rules = session.eligibilityRules && typeof session.eligibilityRules === "object"
    ? session.eligibilityRules as Record<string, unknown> : {};
  const attendanceRequired = typeof session.attendanceRequirement === "number"
    ? session.attendanceRequirement : (typeof rules.attendancePercentage === "number" ? Number(rules.attendancePercentage) : null);
  if (attendanceRequired !== null) {
    const attendance = await getStudentAttendancePercentage(institutionId, studentId);
    if (attendance.percentage !== null && attendance.percentage < attendanceRequired) {
      status = "ATTENDANCE_SHORTAGE";
      reasons.push(`Attendance ${attendance.percentage}% is below required ${attendanceRequired}%`);
    }
  }
  const debarred = await prisma.$queryRaw<Array<{ exists: boolean }>>(Prisma.sql`
    SELECT EXISTS(
      SELECT 1 FROM "exam_incidents" i
      WHERE i."institutionId" = ${institutionId} AND i."studentId" = ${studentId}
        AND i."status" IN ('DEBARRED','UPHELD')
        AND i."examScheduleId" IN (SELECT s."id" FROM "exam_schedules" s WHERE s."examSessionId" = ${examSessionId})
    ) AS "exists"
  `);
  if (debarred[0]?.exists) { status = "DEBARRED"; reasons.push("Student is debarred from this examination"); }
  const existingHold = await prisma.$queryRaw<Array<{ reason: string }>>(Prisma.sql`
    SELECT "reason" FROM "admit_card_holds"
    WHERE "institutionId" = ${institutionId} AND "examSessionId" = ${examSessionId}
      AND "studentId" = ${studentId} AND "status" = 'ACTIVE' LIMIT 10
  `);
  if (existingHold.length) { status = "ADMINISTRATIVE_HOLD"; reasons.push(...existingHold.map(x => x.reason)); }
  const eligibility = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    INSERT INTO "exam_eligibilities"
      ("id","institutionId","examSessionId","studentId","status","reasons","contextSnapshot","evaluatedById")
    VALUES
      (${randomUUID()},${institutionId},${examSessionId},${studentId},${status},
       ${JSON.stringify(reasons)}::jsonb,${JSON.stringify(context)}::jsonb,${actor.id})
    ON CONFLICT ("examSessionId","studentId") DO UPDATE SET
      "status"=EXCLUDED."status","reasons"=EXCLUDED."reasons",
      "contextSnapshot"=EXCLUDED."contextSnapshot","evaluatedAt"=CURRENT_TIMESTAMP,
      "evaluatedById"=EXCLUDED."evaluatedById"
    RETURNING "id"
  `);
  return { status, reasons, context, eligibilityId: eligibility[0]?.id ?? null };
}

export async function listStudentExamEligibility(
  institutionId: string,
  actor: AuthenticatedUser,
  studentId: string,
) {
  await assertCanViewStudent(institutionId, actor, studentId);
  const context = await loadStudentExamContext(institutionId, studentId);
  const sessions = await prisma.$queryRaw<ExamSessionRow[]>(Prisma.sql`
    SELECT * FROM "exam_sessions"
    WHERE "institutionId" = ${institutionId}
      AND "status" NOT IN ('CANCELLED','PUBLISHED')
      AND "startDate" >= CURRENT_TIMESTAMP - INTERVAL '1 day'
    ORDER BY "startDate" ASC LIMIT 200
  `);
  const items = [];
  for (const session of sessions) {
    if (!sessionTargetsStudent(session, context)) continue;
    const now = new Date();
    const registrationStatus = !session.registrationRequired
      ? "NOT_REQUIRED"
      : session.registrationStart && now < session.registrationStart
        ? "NOT_OPEN"
        : session.registrationEnd && now > session.registrationEnd
          ? "CLOSED"
          : "OPEN";
    const eligibility = await evaluateExamEligibility(institutionId, actor, session.id, studentId);
    const registration = await prisma.$queryRaw<Array<{status:string;feeStatus:string;feeInvoiceId:string|null}>>(Prisma.sql`
      SELECT "status","feeStatus","feeInvoiceId" FROM "exam_registrations"
      WHERE "institutionId"=${institutionId} AND "examSessionId"=${session.id} AND "studentId"=${studentId} LIMIT 1
    `);
    const effectiveEligibility = registrationStatus === "CLOSED" && !registration[0]
      ? { ...eligibility, status: "REGISTRATION_CLOSED", reasons: [...eligibility.reasons, "Registration window is closed"] }
      : registrationStatus === "NOT_OPEN" && !registration[0]
        ? { ...eligibility, status: "REGISTRATION_PENDING", reasons: [...eligibility.reasons, "Registration window has not opened"] }
        : eligibility;
    items.push({ session: { ...session, registrationStatus }, eligibility: effectiveEligibility, registration: registration[0] ?? null });
  }
  return items;
}

export async function registerStudentForExam(
  institutionId: string,
  actor: AuthenticatedUser,
  examSessionId: string,
  studentId: string,
  meta: { ipAddress?: string; userAgent?: string },
) {
  if (actor.id !== studentId) await assertCanViewStudent(institutionId, actor, studentId);
  if (!actor.roles.includes("STUDENT") && actor.id !== studentId) throw new AppError("Only the student can create their examination registration", 403);
  const session = await loadSession(institutionId, examSessionId);
  if (!session.registrationRequired) throw new AppError("Registration is not required for this examination", 409);
  const now = new Date();
  if (session.registrationStart && now < session.registrationStart) throw new AppError("Examination registration has not opened yet", 409);
  if (session.registrationEnd && now > session.registrationEnd) throw new AppError("Examination registration is closed", 409);
  if (["CANCELLED","PUBLISHED"].includes(session.status)) throw new AppError("This examination is not open for registration", 409);
  const eligibility = await evaluateExamEligibility(institutionId, actor, examSessionId, studentId);
  if (eligibility.status !== "ELIGIBLE") throw new AppError(`Student is not eligible: ${eligibility.reasons.join("; ") || eligibility.status}`, 409);
  const existing = await prisma.$queryRaw<Array<{id:string;status:string;feeStatus:string}>>(Prisma.sql`
    SELECT "id","status","feeStatus" FROM "exam_registrations"
    WHERE "institutionId"=${institutionId} AND "examSessionId"=${examSessionId} AND "studentId"=${studentId} LIMIT 1
  `);
  if (existing[0] && existing[0].status === "REGISTERED") return existing[0];
  const id = existing[0]?.id ?? randomUUID();
  let invoiceId: string | null = null;
  let feeStatus = session.examFee > 0 ? "PENDING" : "WAIVED";
  await prisma.$transaction(async tx => {
    if (session.examFee > 0) {
      const invoice = await tx.feeInvoice.upsert({
        where: { institutionId_sourceEventKey: { institutionId, sourceEventKey: `EXAM_REGISTRATION:${examSessionId}:${studentId}` } },
        update: {},
        create: {
          institutionId, studentId, title: `Examination Fee — ${session.name}`,
          amount: session.examFee, dueDate: session.registrationEnd ?? null,
          status: "PENDING", sourceModule: "EXAMINATION", sourceType: "EXAM_REGISTRATION",
          sourceEntityId: examSessionId, sourceEventKey: `EXAM_REGISTRATION:${examSessionId}:${studentId}`,
        },
        select: { id: true },
      });
      invoiceId = invoice.id;
    }
    await tx.$executeRaw`
      INSERT INTO "exam_registrations"
        ("id","institutionId","examSessionId","studentId","status","feeStatus","feeInvoiceId")
      VALUES (${id},${institutionId},${examSessionId},${studentId},'REGISTERED',${feeStatus},${invoiceId})
      ON CONFLICT ("examSessionId","studentId") DO UPDATE SET
        "status"='REGISTERED',"feeStatus"=EXCLUDED."feeStatus","feeInvoiceId"=EXCLUDED."feeInvoiceId",
        "cancelledAt"=NULL,"updatedAt"=CURRENT_TIMESTAMP
    `;
  });
  await recordAuditLog({ institutionId, userId: actor.id, action: "exam.registration_created", entityType: "ExamRegistration", entityId: id, metadata: { examSessionId, studentId, feeStatus }, ...meta });
  return { id, examSessionId, studentId, status: "REGISTERED", feeStatus, feeInvoiceId: invoiceId };
}

export async function getStudentExamPerformance(
  institutionId: string,
  actor: AuthenticatedUser,
  studentId: string,
) {
  await assertCanViewStudent(institutionId, actor, studentId);
  return prisma.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
    SELECT s."id" AS "examScheduleId", es."id" AS "examSessionId", es."name" AS "examName",
           c."code" AS "courseCode", c."name" AS "courseName", s."examDate",
           s."maxMarks", s."passMarks", m."marksObtained", m."isAbsent", m."status",
           m."remarks", m."publishedAt"
    FROM "exam_marks" m
    JOIN "exam_schedules" s ON s."id"=m."examScheduleId"
    JOIN "exam_sessions" es ON es."id"=s."examSessionId"
    JOIN "course_offerings" co ON co."id"=s."courseOfferingId"
    JOIN "courses" c ON c."id"=co."courseId"
    WHERE m."institutionId"=${institutionId} AND m."studentId"=${studentId}
      AND m."status" IN ('APPROVED','PUBLISHED')
    ORDER BY s."examDate" DESC LIMIT 500
  `);
}

export async function getStudentPublishedResults(
  institutionId: string,
  actor: AuthenticatedUser,
  studentId: string,
) {
  await assertCanViewStudent(institutionId, actor, studentId);
  return prisma.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
    SELECT s."id" AS "examScheduleId", es."id" AS "examSessionId", es."name" AS "examName",
           c."code" AS "courseCode", c."name" AS "courseName", s."examDate",
           s."maxMarks", s."passMarks", m."marksObtained", m."isAbsent", m."remarks",
           m."publishedAt"
    FROM "exam_marks" m
    JOIN "exam_schedules" s ON s."id"=m."examScheduleId"
    JOIN "exam_sessions" es ON es."id"=s."examSessionId"
    JOIN "course_offerings" co ON co."id"=s."courseOfferingId"
    JOIN "courses" c ON c."id"=co."courseId"
    WHERE m."institutionId"=${institutionId} AND m."studentId"=${studentId}
      AND m."status"='PUBLISHED'
    ORDER BY m."publishedAt" DESC LIMIT 500
  `);
}


export async function createAdmitCardHold(
  institutionId: string,
  actor: AuthenticatedUser,
  examSessionId: string,
  input: { studentId: string; reasonCode: string; reason: string },
  meta: { ipAddress?: string; userAgent?: string },
) {
  assertExamController(actor);
  const session = await loadSession(institutionId, examSessionId);
  const eligibility = await evaluateExamEligibility(institutionId, actor, examSessionId, input.studentId);
  if (eligibility.status === "ELIGIBLE" && input.reasonCode !== "OTHER") {
    // A manual hold may still be applied; it is intentionally independent of eligibility.
  }
  const id = randomUUID();
  await prisma.$executeRaw`
    INSERT INTO "admit_card_holds"
      ("id","institutionId","examSessionId","studentId","reasonCode","reason","status","createdById")
    VALUES (${id},${institutionId},${examSessionId},${input.studentId},${input.reasonCode},${input.reason},'ACTIVE',${actor.id})
  `;
  await recordAuditLog({ institutionId, userId: actor.id, action: "exam.admit_card_hold_created", entityType: "AdmitCardHold", entityId: id, metadata: { examSessionId, studentId: input.studentId, reasonCode: input.reasonCode }, ...meta });
  return requireTenantRow(prisma, "admit_card_holds", institutionId, id, "Admit-card hold");
}

export async function resolveAdmitCardHold(
  institutionId: string,
  actor: AuthenticatedUser,
  holdId: string,
  resolution: string,
  meta: { ipAddress?: string; userAgent?: string },
) {
  assertExamController(actor);
  const hold = await requireTenantRow<{ id:string; status:string }>(prisma, "admit_card_holds", institutionId, holdId, "Admit-card hold");
  if (hold.status !== "ACTIVE") throw new AppError("Admit-card hold is already resolved", 409);
  await prisma.$executeRaw`
    UPDATE "admit_card_holds"
    SET "status"='RESOLVED',"resolution"=${resolution},
        "resolvedById"=${actor.id},"resolvedAt"=CURRENT_TIMESTAMP
    WHERE "id"=${holdId} AND "institutionId"=${institutionId}
  `;
  await recordAuditLog({ institutionId, userId: actor.id, action: "exam.admit_card_hold_resolved", entityType: "AdmitCardHold", entityId: holdId, metadata: { resolution }, ...meta });
  return requireTenantRow(prisma, "admit_card_holds", institutionId, holdId, "Admit-card hold");
}

export async function requestExamMarkCorrection(
  institutionId: string,
  actor: AuthenticatedUser,
  input: { examMarkId: string; newMarks: number | null; reason: string },
  meta: { ipAddress?: string; userAgent?: string },
) {
  const mark = await requireTenantRow<{ id:string; examScheduleId:string; studentId:string; marksObtained:number|null; status:string }>(prisma, "exam_marks", institutionId, input.examMarkId, "Examination mark");
  const schedule = await loadSchedule(institutionId, mark.examScheduleId);
  await assertCanActOnSchedule(institutionId, actor, schedule);
  if (!["APPROVED","PUBLISHED"].includes(mark.status) && schedule.status !== "LOCKED") {
    throw new AppError("A correction request is only required for approved or locked marks", 409);
  }
  if (input.newMarks !== null && input.newMarks > schedule.maxMarks) throw new AppError(`newMarks cannot exceed ${schedule.maxMarks}`, 400);
  const id = randomUUID();
  await prisma.$executeRaw`
    INSERT INTO "exam_mark_correction_requests"
      ("id","institutionId","examScheduleId","examMarkId","studentId","requestedById","oldMarks","newMarks","reason")
    VALUES (${id},${institutionId},${mark.examScheduleId},${mark.id},${mark.studentId},${actor.id},${mark.marksObtained},${input.newMarks},${input.reason})
  `;
  await recordAuditLog({ institutionId, userId: actor.id, action: "exam.mark_correction_requested", entityType: "ExamMarkCorrectionRequest", entityId: id, metadata: { examMarkId: mark.id, oldMarks: mark.marksObtained, newMarks: input.newMarks }, ...meta });
  return requireTenantRow(prisma, "exam_mark_correction_requests", institutionId, id, "Mark correction request");
}

export async function decideExamMarkCorrection(
  institutionId: string,
  actor: AuthenticatedUser,
  requestId: string,
  decision: "APPROVED" | "REJECTED",
  decisionNote: string | undefined,
  meta: { ipAddress?: string; userAgent?: string },
) {
  assertExamApprover(actor);
  const req = await requireTenantRow<{id:string;examScheduleId:string;examMarkId:string;status:string;newMarks:number|null}>(
    prisma,"exam_mark_correction_requests",institutionId,requestId,"Mark correction request"
  );
  if (req.status !== "PENDING") throw new AppError("This correction request has already been decided",409);
  if (decision === "APPROVED") {
    await prisma.$transaction(async tx => {
      await tx.$executeRaw`
        UPDATE "exam_mark_correction_requests"
        SET "status"='APPROVED',"decisionNote"=${decisionNote ?? null},
            "decidedById"=${actor.id},"decidedAt"=CURRENT_TIMESTAMP,"unlockedAt"=CURRENT_TIMESTAMP
        WHERE "id"=${requestId} AND "institutionId"=${institutionId}
      `;
      await tx.$executeRaw`
        UPDATE "exam_marks" SET "status"='DRAFT',"correctionRequestId"=${requestId}
        WHERE "id"=${req.examMarkId} AND "institutionId"=${institutionId}
      `;
      await tx.$executeRaw`
        UPDATE "exam_schedules" SET "status"='CORRECTION_OPEN'
        WHERE "id"=${req.examScheduleId} AND "institutionId"=${institutionId}
      `;
    });
  } else {
    await prisma.$executeRaw`
      UPDATE "exam_mark_correction_requests"
      SET "status"='REJECTED',"decisionNote"=${decisionNote ?? null},
          "decidedById"=${actor.id},"decidedAt"=CURRENT_TIMESTAMP
      WHERE "id"=${requestId} AND "institutionId"=${institutionId}
    `;
  }
  await recordAuditLog({ institutionId,userId:actor.id,action:"exam.mark_correction_decided",entityType:"ExamMarkCorrectionRequest",entityId:requestId,metadata:{decision,decisionNote:decisionNote??null},...meta });
  return requireTenantRow(prisma,"exam_mark_correction_requests",institutionId,requestId,"Mark correction request");
}

export async function listExamMarkCorrectionRequests(
  institutionId: string,
  actor: AuthenticatedUser,
  pagination: PaginationParams,
) {
  assertExamController(actor);
  const where = Prisma.sql`WHERE "institutionId"=${institutionId} ORDER BY "createdAt" DESC LIMIT ${pagination.take} OFFSET ${pagination.skip}`;
  const items = await prisma.$queryRaw<Array<Record<string,unknown>>>(Prisma.sql`SELECT * FROM "exam_mark_correction_requests" ${where}`);
  const total = await countRows(prisma, "exam_mark_correction_requests", Prisma.sql`WHERE "institutionId"=${institutionId}`);
  return { items, total };
}


