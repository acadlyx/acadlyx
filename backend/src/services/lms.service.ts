import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";

import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";
import { AuthenticatedUser } from "../types/auth";
import { round2 } from "../utils/http";
import {
  assertStudentEnrolledInCourseOffering,
  getCourseOfferingRoster,
} from "../utils/academicRoster";
import {
  assertOwnsCourseOffering,
  loadCourseOfferingOrThrow,
} from "../utils/courseOfferingAccess";
import { PaginationParams } from "../utils/pagination";
import {
  andWhere,
  countRows,
  requireTenantRow,
} from "../utils/sqlScope";
import { assertCanViewStudent, isInstitutionWide } from "./accessScope.service";
import { recordAuditLog } from "./audit.service";

/**
 * Learning management.
 *
 * Structure is offering-scoped: modules hold lessons, lessons hold
 * resources, and a quiz draws its questions from the institution's
 * question bank. Two rules run through everything here:
 *
 *  1. Teaching staff act only on offerings they are assigned to.
 *  2. Students only ever see PUBLISHED content for offerings they are
 *     actually rostered into, and a quiz answer key never crosses the
 *     API boundary before the attempt is graded.
 */

const QUESTION_TYPES = [
  "SINGLE_CHOICE",
  "MULTIPLE_CHOICE",
  "TRUE_FALSE",
  "SHORT_ANSWER",
  "LONG_ANSWER",
] as const;

type QuestionType = (typeof QUESTION_TYPES)[number];

/** Types the platform can score without a human reading the answer. */
const AUTO_GRADABLE: QuestionType[] = [
  "SINGLE_CHOICE",
  "MULTIPLE_CHOICE",
  "TRUE_FALSE",
];

interface ModuleRow {
  id: string;
  institutionId: string;
  courseOfferingId: string;
  title: string;
  description: string | null;
  sequence: number;
  isPublished: boolean;
  availableFrom: Date | null;
}

interface QuizRow {
  id: string;
  institutionId: string;
  courseOfferingId: string;
  courseModuleId: string | null;
  title: string;
  description: string | null;
  totalMarks: number;
  passMarks: number;
  durationMinutes: number | null;
  attemptsAllowed: number;
  opensAt: Date | null;
  closesAt: Date | null;
  shuffleQuestions: boolean;
  showResultsImmediately: boolean;
  gradingMode: string;
  status: string;
  createdById: string;
}

/** Teaching-side authority for one offering. */
async function assertCanTeach(
  institutionId: string,
  actor: AuthenticatedUser,
  courseOfferingId: string
) {
  const offering = await loadCourseOfferingOrThrow(
    institutionId,
    courseOfferingId
  );
  if (isInstitutionWide(actor)) return offering;
  assertOwnsCourseOffering(actor, offering.facultyId);
  return offering;
}

/** Student-side authority: enrolled, or a staff member who may view them. */
async function assertCanLearn(
  institutionId: string,
  actor: AuthenticatedUser,
  courseOfferingId: string
) {
  if (isInstitutionWide(actor)) return;
  if (actor.roles.includes("STUDENT")) {
    await assertStudentEnrolledInCourseOffering(
      institutionId,
      actor.id,
      courseOfferingId
    );
    return;
  }
  await assertCanTeach(institutionId, actor, courseOfferingId);
}

function isStudentView(actor: AuthenticatedUser): boolean {
  return (
    actor.roles.includes("STUDENT") &&
    !isInstitutionWide(actor) &&
    !actor.roles.includes("FACULTY")
  );
}

// ==========================================================
// MODULES
// ==========================================================

export async function listModules(
  institutionId: string,
  actor: AuthenticatedUser,
  courseOfferingId: string
) {
  await assertCanLearn(institutionId, actor, courseOfferingId);
  const studentView = isStudentView(actor);

  const conditions: Prisma.Sql[] = [
    Prisma.sql`m."institutionId" = ${institutionId}`,
    Prisma.sql`m."courseOfferingId" = ${courseOfferingId}`,
  ];
  if (studentView) {
    conditions.push(Prisma.sql`m."isPublished" = TRUE`);
    conditions.push(
      Prisma.sql`(m."availableFrom" IS NULL OR m."availableFrom" <= CURRENT_TIMESTAMP)`
    );
  }

  const modules = await prisma.$queryRaw<ModuleRow[]>(Prisma.sql`
    SELECT m.* FROM "course_modules" m
    ${andWhere(conditions)}
    ORDER BY m."sequence" ASC
  `);
  if (modules.length === 0) return [];

  const moduleIds = modules.map((module) => module.id);
  const lessonConditions: Prisma.Sql[] = [
    Prisma.sql`l."courseModuleId" IN (${Prisma.join(moduleIds)})`,
    Prisma.sql`l."institutionId" = ${institutionId}`,
  ];
  if (studentView) lessonConditions.push(Prisma.sql`l."isPublished" = TRUE`);

  const lessons = await prisma.$queryRaw<
    Array<{
      id: string;
      courseModuleId: string;
      title: string;
      summary: string | null;
      contentType: string;
      sequence: number;
      durationMinutes: number | null;
      isPublished: boolean;
      progressStatus: string | null;
      resourceCount: number;
    }>
  >(Prisma.sql`
    SELECT l."id", l."courseModuleId", l."title", l."summary", l."contentType",
           l."sequence", l."durationMinutes", l."isPublished",
           p."status" AS "progressStatus",
           (SELECT COUNT(*) FROM "lesson_resources" r
             WHERE r."courseLessonId" = l."id")::int AS "resourceCount"
    FROM "course_lessons" l
    LEFT JOIN "lesson_progresses" p
      ON p."courseLessonId" = l."id" AND p."studentId" = ${actor.id}
    ${andWhere(lessonConditions)}
    ORDER BY l."sequence" ASC
  `);

  return modules.map((module) => ({
    ...module,
    lessons: lessons.filter((lesson) => lesson.courseModuleId === module.id),
  }));
}

export async function createModule(
  institutionId: string,
  actor: AuthenticatedUser,
  input: {
    courseOfferingId: string;
    title: string;
    description?: string;
    sequence?: number;
    availableFrom?: Date;
  },
  meta: { ipAddress?: string; userAgent?: string }
) {
  await assertCanTeach(institutionId, actor, input.courseOfferingId);

  const sequence =
    input.sequence ??
    (await countRows(
      prisma,
      "course_modules",
      Prisma.sql`WHERE "courseOfferingId" = ${input.courseOfferingId}
        AND "institutionId" = ${institutionId}`
    )) + 1;

  const id = randomUUID();
  await prisma.$executeRaw`
    INSERT INTO "course_modules"
      ("id", "institutionId", "courseOfferingId", "title", "description",
       "sequence", "availableFrom", "createdById")
    VALUES
      (${id}, ${institutionId}, ${input.courseOfferingId}, ${input.title.trim()},
       ${input.description ?? null}, ${sequence}, ${input.availableFrom ?? null},
       ${actor.id})
  `;

  await recordAuditLog({
    institutionId,
    userId: actor.id,
    action: "lms.module_created",
    entityType: "CourseModule",
    entityId: id,
    metadata: { courseOfferingId: input.courseOfferingId, title: input.title },
    ...meta,
  });

  return requireTenantRow<ModuleRow>(
    prisma,
    "course_modules",
    institutionId,
    id,
    "Course module"
  );
}

export async function updateModule(
  institutionId: string,
  actor: AuthenticatedUser,
  moduleId: string,
  input: {
    title?: string;
    description?: string;
    sequence?: number;
    isPublished?: boolean;
    availableFrom?: Date;
  },
  meta: { ipAddress?: string; userAgent?: string }
) {
  const module = await requireTenantRow<ModuleRow>(
    prisma,
    "course_modules",
    institutionId,
    moduleId,
    "Course module"
  );
  await assertCanTeach(institutionId, actor, module.courseOfferingId);

  await prisma.$executeRaw`
    UPDATE "course_modules"
    SET "title" = COALESCE(${input.title ?? null}, "title"),
        "description" = COALESCE(${input.description ?? null}, "description"),
        "sequence" = COALESCE(${input.sequence ?? null}, "sequence"),
        "isPublished" = COALESCE(${input.isPublished ?? null}, "isPublished"),
        "availableFrom" = COALESCE(${input.availableFrom ?? null}, "availableFrom")
    WHERE "id" = ${moduleId} AND "institutionId" = ${institutionId}
  `;

  await recordAuditLog({
    institutionId,
    userId: actor.id,
    action: "lms.module_updated",
    entityType: "CourseModule",
    entityId: moduleId,
    metadata: { changed: Object.keys(input) },
    ...meta,
  });

  return requireTenantRow<ModuleRow>(
    prisma,
    "course_modules",
    institutionId,
    moduleId,
    "Course module"
  );
}

export async function deleteModule(
  institutionId: string,
  actor: AuthenticatedUser,
  moduleId: string,
  meta: { ipAddress?: string; userAgent?: string }
) {
  const module = await requireTenantRow<ModuleRow>(
    prisma,
    "course_modules",
    institutionId,
    moduleId,
    "Course module"
  );
  await assertCanTeach(institutionId, actor, module.courseOfferingId);

  if (module.isPublished) {
    throw new AppError(
      "Unpublish the module before deleting it",
      409
    );
  }

  await prisma.$executeRaw`
    DELETE FROM "course_modules"
    WHERE "id" = ${moduleId} AND "institutionId" = ${institutionId}
  `;

  await recordAuditLog({
    institutionId,
    userId: actor.id,
    action: "lms.module_deleted",
    entityType: "CourseModule",
    entityId: moduleId,
    ...meta,
  });

  return { id: moduleId, deleted: true };
}

// ==========================================================
// LESSONS + RESOURCES
// ==========================================================

export async function createLesson(
  institutionId: string,
  actor: AuthenticatedUser,
  input: {
    courseModuleId: string;
    title: string;
    summary?: string;
    content?: string;
    contentType?: string;
    sequence?: number;
    durationMinutes?: number;
  },
  meta: { ipAddress?: string; userAgent?: string }
) {
  const module = await requireTenantRow<ModuleRow>(
    prisma,
    "course_modules",
    institutionId,
    input.courseModuleId,
    "Course module"
  );
  await assertCanTeach(institutionId, actor, module.courseOfferingId);

  const sequence =
    input.sequence ??
    (await countRows(
      prisma,
      "course_lessons",
      Prisma.sql`WHERE "courseModuleId" = ${input.courseModuleId}`
    )) + 1;

  const id = randomUUID();
  await prisma.$executeRaw`
    INSERT INTO "course_lessons"
      ("id", "institutionId", "courseModuleId", "title", "summary", "content",
       "contentType", "sequence", "durationMinutes", "createdById")
    VALUES
      (${id}, ${institutionId}, ${input.courseModuleId}, ${input.title.trim()},
       ${input.summary ?? null}, ${input.content ?? null},
       ${input.contentType ?? "TEXT"}, ${sequence},
       ${input.durationMinutes ?? null}, ${actor.id})
  `;

  await recordAuditLog({
    institutionId,
    userId: actor.id,
    action: "lms.lesson_created",
    entityType: "CourseLesson",
    entityId: id,
    metadata: { courseModuleId: input.courseModuleId },
    ...meta,
  });

  return requireTenantRow(
    prisma,
    "course_lessons",
    institutionId,
    id,
    "Lesson"
  );
}

export async function getLesson(
  institutionId: string,
  actor: AuthenticatedUser,
  lessonId: string
) {
  const lesson = await requireTenantRow<{
    id: string;
    courseModuleId: string;
    isPublished: boolean;
    title: string;
  }>(prisma, "course_lessons", institutionId, lessonId, "Lesson");

  const module = await requireTenantRow<ModuleRow>(
    prisma,
    "course_modules",
    institutionId,
    lesson.courseModuleId,
    "Course module"
  );
  await assertCanLearn(institutionId, actor, module.courseOfferingId);

  if (isStudentView(actor) && (!lesson.isPublished || !module.isPublished)) {
    throw new AppError("This lesson has not been published yet", 404);
  }

  const resources = await prisma.$queryRaw<
    Array<{ id: string; title: string; url: string; resourceType: string }>
  >(Prisma.sql`
    SELECT "id", "title", "url", "resourceType", "sizeKb"
    FROM "lesson_resources"
    WHERE "courseLessonId" = ${lessonId} AND "institutionId" = ${institutionId}
    ORDER BY "createdAt" ASC
  `);

  return { lesson, module, resources };
}

export async function updateLesson(
  institutionId: string,
  actor: AuthenticatedUser,
  lessonId: string,
  input: {
    title?: string;
    summary?: string;
    content?: string;
    contentType?: string;
    sequence?: number;
    durationMinutes?: number;
    isPublished?: boolean;
  },
  meta: { ipAddress?: string; userAgent?: string }
) {
  const lesson = await requireTenantRow<{ id: string; courseModuleId: string }>(
    prisma,
    "course_lessons",
    institutionId,
    lessonId,
    "Lesson"
  );
  const module = await requireTenantRow<ModuleRow>(
    prisma,
    "course_modules",
    institutionId,
    lesson.courseModuleId,
    "Course module"
  );
  await assertCanTeach(institutionId, actor, module.courseOfferingId);

  await prisma.$executeRaw`
    UPDATE "course_lessons"
    SET "title" = COALESCE(${input.title ?? null}, "title"),
        "summary" = COALESCE(${input.summary ?? null}, "summary"),
        "content" = COALESCE(${input.content ?? null}, "content"),
        "contentType" = COALESCE(${input.contentType ?? null}, "contentType"),
        "sequence" = COALESCE(${input.sequence ?? null}, "sequence"),
        "durationMinutes" = COALESCE(${input.durationMinutes ?? null}, "durationMinutes"),
        "isPublished" = COALESCE(${input.isPublished ?? null}, "isPublished")
    WHERE "id" = ${lessonId} AND "institutionId" = ${institutionId}
  `;

  await recordAuditLog({
    institutionId,
    userId: actor.id,
    action: "lms.lesson_updated",
    entityType: "CourseLesson",
    entityId: lessonId,
    metadata: { changed: Object.keys(input) },
    ...meta,
  });

  return requireTenantRow(prisma, "course_lessons", institutionId, lessonId, "Lesson");
}

export async function addLessonResource(
  institutionId: string,
  actor: AuthenticatedUser,
  lessonId: string,
  input: { title: string; url: string; resourceType?: string; sizeKb?: number },
  meta: { ipAddress?: string; userAgent?: string }
) {
  const lesson = await requireTenantRow<{ id: string; courseModuleId: string }>(
    prisma,
    "course_lessons",
    institutionId,
    lessonId,
    "Lesson"
  );
  const module = await requireTenantRow<ModuleRow>(
    prisma,
    "course_modules",
    institutionId,
    lesson.courseModuleId,
    "Course module"
  );
  await assertCanTeach(institutionId, actor, module.courseOfferingId);

  const id = randomUUID();
  await prisma.$executeRaw`
    INSERT INTO "lesson_resources"
      ("id", "institutionId", "courseLessonId", "title", "url", "resourceType",
       "sizeKb", "uploadedById")
    VALUES
      (${id}, ${institutionId}, ${lessonId}, ${input.title.trim()}, ${input.url},
       ${input.resourceType ?? "LINK"}, ${input.sizeKb ?? null}, ${actor.id})
  `;

  await recordAuditLog({
    institutionId,
    userId: actor.id,
    action: "lms.resource_added",
    entityType: "LessonResource",
    entityId: id,
    metadata: { lessonId, resourceType: input.resourceType ?? "LINK" },
    ...meta,
  });

  return requireTenantRow(
    prisma,
    "lesson_resources",
    institutionId,
    id,
    "Resource"
  );
}

export async function deleteLessonResource(
  institutionId: string,
  actor: AuthenticatedUser,
  resourceId: string,
  meta: { ipAddress?: string; userAgent?: string }
) {
  const resource = await requireTenantRow<{ id: string; courseLessonId: string }>(
    prisma,
    "lesson_resources",
    institutionId,
    resourceId,
    "Resource"
  );
  const lesson = await requireTenantRow<{ courseModuleId: string }>(
    prisma,
    "course_lessons",
    institutionId,
    resource.courseLessonId,
    "Lesson"
  );
  const module = await requireTenantRow<ModuleRow>(
    prisma,
    "course_modules",
    institutionId,
    lesson.courseModuleId,
    "Course module"
  );
  await assertCanTeach(institutionId, actor, module.courseOfferingId);

  await prisma.$executeRaw`
    DELETE FROM "lesson_resources"
    WHERE "id" = ${resourceId} AND "institutionId" = ${institutionId}
  `;

  await recordAuditLog({
    institutionId,
    userId: actor.id,
    action: "lms.resource_deleted",
    entityType: "LessonResource",
    entityId: resourceId,
    ...meta,
  });

  return { id: resourceId, deleted: true };
}

/** Student-side progress marker. Idempotent; completion is monotonic. */
export async function recordLessonProgress(
  institutionId: string,
  actor: AuthenticatedUser,
  lessonId: string,
  input: { status: "IN_PROGRESS" | "COMPLETED"; secondsSpent?: number }
) {
  const lesson = await requireTenantRow<{ id: string; courseModuleId: string; isPublished: boolean }>(
    prisma,
    "course_lessons",
    institutionId,
    lessonId,
    "Lesson"
  );
  const module = await requireTenantRow<ModuleRow>(
    prisma,
    "course_modules",
    institutionId,
    lesson.courseModuleId,
    "Course module"
  );
  await assertStudentEnrolledInCourseOffering(
    institutionId,
    actor.id,
    module.courseOfferingId
  );
  if (!lesson.isPublished) {
    throw new AppError("This lesson has not been published yet", 404);
  }

  await prisma.$executeRaw`
    INSERT INTO "lesson_progresses"
      ("id", "institutionId", "courseLessonId", "studentId", "status",
       "completedAt", "secondsSpent")
    VALUES
      (${randomUUID()}, ${institutionId}, ${lessonId}, ${actor.id},
       ${input.status},
       ${input.status === "COMPLETED" ? new Date() : null},
       ${input.secondsSpent ?? 0})
    ON CONFLICT ("courseLessonId", "studentId") DO UPDATE
    SET "status" = CASE
          WHEN "lesson_progresses"."status" = 'COMPLETED' THEN 'COMPLETED'
          ELSE EXCLUDED."status" END,
        "completedAt" = COALESCE("lesson_progresses"."completedAt", EXCLUDED."completedAt"),
        "secondsSpent" = "lesson_progresses"."secondsSpent" + EXCLUDED."secondsSpent"
  `;

  return { lessonId, status: input.status };
}

// ==========================================================
// QUESTION BANK
// ==========================================================

export async function listQuestions(
  institutionId: string,
  actor: AuthenticatedUser,
  pagination: PaginationParams,
  filters: {
    courseId?: string;
    courseOfferingId?: string;
    questionType?: string;
    search?: string;
  }
) {
  if (isStudentView(actor)) {
    throw new AppError("The question bank is not available to students", 403);
  }

  const conditions: Prisma.Sql[] = [
    Prisma.sql`q."institutionId" = ${institutionId}`,
    Prisma.sql`q."isActive" = TRUE`,
  ];
  if (filters.courseId) conditions.push(Prisma.sql`q."courseId" = ${filters.courseId}`);
  if (filters.courseOfferingId) {
    await assertCanTeach(institutionId, actor, filters.courseOfferingId);
    conditions.push(Prisma.sql`q."courseOfferingId" = ${filters.courseOfferingId}`);
  }
  if (filters.questionType) {
    conditions.push(Prisma.sql`q."questionType" = ${filters.questionType}`);
  }
  if (filters.search) {
    const like = `%${filters.search}%`;
    conditions.push(Prisma.sql`(q."prompt" ILIKE ${like} OR q."topic" ILIKE ${like})`);
  }
  const where = andWhere(conditions);

  const [items, totalRows] = await Promise.all([
    prisma.$queryRaw<
      Array<{
        id: string;
        prompt: string;
        questionType: string;
        defaultMarks: number;
        difficulty: string;
        topic: string | null;
        optionCount: number;
      }>
    >(Prisma.sql`
      SELECT q."id", q."prompt", q."questionType", q."defaultMarks",
             q."difficulty", q."topic", q."explanation", q."courseId",
             (SELECT COUNT(*) FROM "question_options" o
               WHERE o."questionBankItemId" = q."id")::int AS "optionCount"
      FROM "question_bank_items" q
      ${where}
      ORDER BY q."createdAt" DESC
      LIMIT ${pagination.take} OFFSET ${pagination.skip}
    `),
    prisma.$queryRaw<{ count: bigint }[]>(Prisma.sql`
      SELECT COUNT(*)::bigint AS "count" FROM "question_bank_items" q ${where}
    `),
  ]);

  return { items, total: Number(totalRows[0]?.count ?? 0) };
}

export async function createQuestion(
  institutionId: string,
  actor: AuthenticatedUser,
  input: {
    questionType: string;
    prompt: string;
    defaultMarks?: number;
    difficulty?: string;
    explanation?: string;
    topic?: string;
    courseId?: string;
    courseOfferingId?: string;
    options?: Array<{ label: string; isCorrect: boolean }>;
  },
  meta: { ipAddress?: string; userAgent?: string }
) {
  if (isStudentView(actor)) {
    throw new AppError("The question bank is not available to students", 403);
  }
  if (!(QUESTION_TYPES as readonly string[]).includes(input.questionType)) {
    throw new AppError(
      `questionType must be one of: ${QUESTION_TYPES.join(", ")}`,
      400
    );
  }
  if (input.courseOfferingId) {
    await assertCanTeach(institutionId, actor, input.courseOfferingId);
  }

  const type = input.questionType as QuestionType;
  const options = input.options ?? [];

  if (AUTO_GRADABLE.includes(type)) {
    if (options.length < 2) {
      throw new AppError(
        "An objective question needs at least two options",
        400
      );
    }
    const correct = options.filter((option) => option.isCorrect).length;
    if (correct === 0) {
      throw new AppError("At least one option must be correct", 400);
    }
    if (type !== "MULTIPLE_CHOICE" && correct > 1) {
      throw new AppError(
        "This question type allows exactly one correct option",
        400
      );
    }
  }

  const id = randomUUID();
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      INSERT INTO "question_bank_items"
        ("id", "institutionId", "courseId", "courseOfferingId", "questionType",
         "prompt", "defaultMarks", "difficulty", "explanation", "topic", "createdById")
      VALUES
        (${id}, ${institutionId}, ${input.courseId ?? null},
         ${input.courseOfferingId ?? null}, ${type}, ${input.prompt.trim()},
         ${input.defaultMarks ?? 1}, ${input.difficulty ?? "MEDIUM"},
         ${input.explanation ?? null}, ${input.topic ?? null}, ${actor.id})
    `;
    let sequence = 1;
    for (const option of options) {
      await tx.$executeRaw`
        INSERT INTO "question_options"
          ("id", "institutionId", "questionBankItemId", "label", "isCorrect", "sequence")
        VALUES
          (${randomUUID()}, ${institutionId}, ${id}, ${option.label.trim()},
           ${option.isCorrect}, ${sequence})
      `;
      sequence += 1;
    }
  });

  await recordAuditLog({
    institutionId,
    userId: actor.id,
    action: "lms.question_created",
    entityType: "QuestionBankItem",
    entityId: id,
    metadata: { questionType: type, optionCount: options.length },
    ...meta,
  });

  return getQuestion(institutionId, actor, id);
}

export async function getQuestion(
  institutionId: string,
  actor: AuthenticatedUser,
  questionId: string
) {
  if (isStudentView(actor)) {
    throw new AppError("The question bank is not available to students", 403);
  }
  const question = await requireTenantRow(
    prisma,
    "question_bank_items",
    institutionId,
    questionId,
    "Question"
  );
  const options = await prisma.$queryRaw<
    Array<{ id: string; label: string; isCorrect: boolean; sequence: number }>
  >(Prisma.sql`
    SELECT "id", "label", "isCorrect", "sequence"
    FROM "question_options"
    WHERE "questionBankItemId" = ${questionId} AND "institutionId" = ${institutionId}
    ORDER BY "sequence" ASC
  `);
  return { ...question, options };
}

export async function deactivateQuestion(
  institutionId: string,
  actor: AuthenticatedUser,
  questionId: string,
  meta: { ipAddress?: string; userAgent?: string }
) {
  if (isStudentView(actor)) {
    throw new AppError("The question bank is not available to students", 403);
  }
  await requireTenantRow(
    prisma,
    "question_bank_items",
    institutionId,
    questionId,
    "Question"
  );

  await prisma.$executeRaw`
    UPDATE "question_bank_items" SET "isActive" = FALSE
    WHERE "id" = ${questionId} AND "institutionId" = ${institutionId}
  `;

  await recordAuditLog({
    institutionId,
    userId: actor.id,
    action: "lms.question_deactivated",
    entityType: "QuestionBankItem",
    entityId: questionId,
    ...meta,
  });

  return { id: questionId, isActive: false };
}

// ==========================================================
// QUIZZES
// ==========================================================

export async function listQuizzes(
  institutionId: string,
  actor: AuthenticatedUser,
  courseOfferingId: string
) {
  await assertCanLearn(institutionId, actor, courseOfferingId);
  const studentView = isStudentView(actor);

  const conditions: Prisma.Sql[] = [
    Prisma.sql`q."institutionId" = ${institutionId}`,
    Prisma.sql`q."courseOfferingId" = ${courseOfferingId}`,
  ];
  if (studentView) conditions.push(Prisma.sql`q."status" = 'PUBLISHED'`);

  return prisma.$queryRaw<
    Array<{
      id: string;
      title: string;
      status: string;
      totalMarks: number;
      opensAt: Date | null;
      closesAt: Date | null;
      attemptsAllowed: number;
      questionCount: number;
      myAttempts: number;
      myBestScore: number | null;
    }>
  >(Prisma.sql`
    SELECT q."id", q."title", q."description", q."status", q."totalMarks",
           q."passMarks", q."opensAt", q."closesAt", q."attemptsAllowed",
           q."durationMinutes", q."gradingMode",
           (SELECT COUNT(*) FROM "quiz_questions" qq WHERE qq."quizId" = q."id")::int AS "questionCount",
           (SELECT COUNT(*) FROM "quiz_attempts" a
             WHERE a."quizId" = q."id" AND a."studentId" = ${actor.id})::int AS "myAttempts",
           (SELECT MAX(a."score") FROM "quiz_attempts" a
             WHERE a."quizId" = q."id" AND a."studentId" = ${actor.id}
               AND a."status" = 'GRADED') AS "myBestScore"
    FROM "quizzes" q
    ${andWhere(conditions)}
    ORDER BY q."createdAt" DESC
  `);
}

export async function createQuiz(
  institutionId: string,
  actor: AuthenticatedUser,
  input: {
    courseOfferingId: string;
    courseModuleId?: string;
    title: string;
    description?: string;
    passMarks?: number;
    durationMinutes?: number;
    attemptsAllowed?: number;
    opensAt?: Date;
    closesAt?: Date;
    shuffleQuestions?: boolean;
    showResultsImmediately?: boolean;
    gradingMode?: string;
  },
  meta: { ipAddress?: string; userAgent?: string }
) {
  await assertCanTeach(institutionId, actor, input.courseOfferingId);
  if (input.opensAt && input.closesAt && input.closesAt <= input.opensAt) {
    throw new AppError("closesAt must be after opensAt", 400);
  }

  const id = randomUUID();
  await prisma.$executeRaw`
    INSERT INTO "quizzes"
      ("id", "institutionId", "courseOfferingId", "courseModuleId", "title",
       "description", "passMarks", "durationMinutes", "attemptsAllowed",
       "opensAt", "closesAt", "shuffleQuestions", "showResultsImmediately",
       "gradingMode", "status", "createdById")
    VALUES
      (${id}, ${institutionId}, ${input.courseOfferingId},
       ${input.courseModuleId ?? null}, ${input.title.trim()},
       ${input.description ?? null}, ${input.passMarks ?? 0},
       ${input.durationMinutes ?? null}, ${input.attemptsAllowed ?? 1},
       ${input.opensAt ?? null}, ${input.closesAt ?? null},
       ${input.shuffleQuestions ?? false}, ${input.showResultsImmediately ?? true},
       ${input.gradingMode === "MANUAL" ? "MANUAL" : "AUTO"}, 'DRAFT', ${actor.id})
  `;

  await recordAuditLog({
    institutionId,
    userId: actor.id,
    action: "lms.quiz_created",
    entityType: "Quiz",
    entityId: id,
    metadata: { courseOfferingId: input.courseOfferingId, title: input.title },
    ...meta,
  });

  return requireTenantRow<QuizRow>(prisma, "quizzes", institutionId, id, "Quiz");
}

/** Replaces the quiz paper and recomputes totalMarks in one transaction. */
export async function setQuizQuestions(
  institutionId: string,
  actor: AuthenticatedUser,
  quizId: string,
  questions: Array<{ questionBankItemId: string; marks?: number }>,
  meta: { ipAddress?: string; userAgent?: string }
) {
  const quiz = await requireTenantRow<QuizRow>(
    prisma,
    "quizzes",
    institutionId,
    quizId,
    "Quiz"
  );
  await assertCanTeach(institutionId, actor, quiz.courseOfferingId);

  if (quiz.status !== "DRAFT") {
    throw new AppError(
      "A published quiz's questions can no longer be changed",
      409
    );
  }
  if (questions.length === 0) {
    throw new AppError("A quiz needs at least one question", 400);
  }

  const ids = questions.map((question) => question.questionBankItemId);
  const available = await prisma.$queryRaw<
    Array<{ id: string; defaultMarks: number }>
  >(Prisma.sql`
    SELECT "id", "defaultMarks" FROM "question_bank_items"
    WHERE "institutionId" = ${institutionId}
      AND "isActive" = TRUE
      AND "id" IN (${Prisma.join(ids)})
  `);
  if (available.length !== new Set(ids).size) {
    throw new AppError(
      "One or more questions are not available in this institution",
      404
    );
  }
  const defaultMarks = new Map(
    available.map((item) => [item.id, item.defaultMarks])
  );

  let total = 0;
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      DELETE FROM "quiz_questions"
      WHERE "quizId" = ${quizId} AND "institutionId" = ${institutionId}
    `;
    let sequence = 1;
    for (const question of questions) {
      const marks =
        question.marks ?? defaultMarks.get(question.questionBankItemId) ?? 1;
      total += marks;
      await tx.$executeRaw`
        INSERT INTO "quiz_questions"
          ("id", "institutionId", "quizId", "questionBankItemId", "sequence", "marks")
        VALUES
          (${randomUUID()}, ${institutionId}, ${quizId},
           ${question.questionBankItemId}, ${sequence}, ${marks})
      `;
      sequence += 1;
    }
    await tx.$executeRaw`
      UPDATE "quizzes" SET "totalMarks" = ${total}
      WHERE "id" = ${quizId} AND "institutionId" = ${institutionId}
    `;
  });

  await recordAuditLog({
    institutionId,
    userId: actor.id,
    action: "lms.quiz_questions_set",
    entityType: "Quiz",
    entityId: quizId,
    metadata: { questionCount: questions.length, totalMarks: total },
    ...meta,
  });

  return { quizId, questionCount: questions.length, totalMarks: total };
}

export async function updateQuizStatus(
  institutionId: string,
  actor: AuthenticatedUser,
  quizId: string,
  status: "DRAFT" | "PUBLISHED" | "CLOSED",
  meta: { ipAddress?: string; userAgent?: string }
) {
  const quiz = await requireTenantRow<QuizRow>(
    prisma,
    "quizzes",
    institutionId,
    quizId,
    "Quiz"
  );
  await assertCanTeach(institutionId, actor, quiz.courseOfferingId);

  if (status === "PUBLISHED") {
    const questionCount = await countRows(
      prisma,
      "quiz_questions",
      Prisma.sql`WHERE "quizId" = ${quizId} AND "institutionId" = ${institutionId}`
    );
    if (questionCount === 0) {
      throw new AppError("Add questions before publishing the quiz", 409);
    }
  }
  if (quiz.status === "PUBLISHED" && status === "DRAFT") {
    const attempts = await countRows(
      prisma,
      "quiz_attempts",
      Prisma.sql`WHERE "quizId" = ${quizId} AND "institutionId" = ${institutionId}`
    );
    if (attempts > 0) {
      throw new AppError(
        "This quiz already has attempts and cannot return to draft",
        409
      );
    }
  }

  await prisma.$executeRaw`
    UPDATE "quizzes" SET "status" = ${status}
    WHERE "id" = ${quizId} AND "institutionId" = ${institutionId}
  `;

  await recordAuditLog({
    institutionId,
    userId: actor.id,
    action: "lms.quiz_status_changed",
    entityType: "Quiz",
    entityId: quizId,
    metadata: { from: quiz.status, to: status },
    ...meta,
  });

  return requireTenantRow<QuizRow>(prisma, "quizzes", institutionId, quizId, "Quiz");
}

// ==========================================================
// ATTEMPTS
// ==========================================================

/**
 * Opens an attempt and returns the paper WITHOUT any correctness flag.
 * The answer key stays server-side until the attempt is graded.
 */
export async function startQuizAttempt(
  institutionId: string,
  actor: AuthenticatedUser,
  quizId: string
) {
  const quiz = await requireTenantRow<QuizRow>(
    prisma,
    "quizzes",
    institutionId,
    quizId,
    "Quiz"
  );
  await assertStudentEnrolledInCourseOffering(
    institutionId,
    actor.id,
    quiz.courseOfferingId
  );

  if (quiz.status !== "PUBLISHED") {
    throw new AppError("This quiz is not open", 403);
  }
  const now = new Date();
  if (quiz.opensAt && quiz.opensAt > now) {
    throw new AppError("This quiz has not opened yet", 403);
  }
  if (quiz.closesAt && quiz.closesAt < now) {
    throw new AppError("This quiz has closed", 403);
  }

  const attempts = await prisma.$queryRaw<
    Array<{ id: string; attemptNumber: number; status: string }>
  >(Prisma.sql`
    SELECT "id", "attemptNumber", "status" FROM "quiz_attempts"
    WHERE "quizId" = ${quizId} AND "studentId" = ${actor.id}
    ORDER BY "attemptNumber" DESC
  `);

  const inProgress = attempts.find((attempt) => attempt.status === "IN_PROGRESS");
  const attemptId = inProgress?.id ?? randomUUID();

  if (!inProgress) {
    if (attempts.length >= quiz.attemptsAllowed) {
      throw new AppError(
        `You have used all ${quiz.attemptsAllowed} permitted attempt(s)`,
        409
      );
    }
    await prisma.$executeRaw`
      INSERT INTO "quiz_attempts"
        ("id", "institutionId", "quizId", "studentId", "attemptNumber",
         "status", "maxScore")
      VALUES
        (${attemptId}, ${institutionId}, ${quizId}, ${actor.id},
         ${(attempts[0]?.attemptNumber ?? 0) + 1}, 'IN_PROGRESS', ${quiz.totalMarks})
    `;
  }

  const questions = await prisma.$queryRaw<
    Array<{
      questionBankItemId: string;
      sequence: number;
      marks: number;
      prompt: string;
      questionType: string;
    }>
  >(Prisma.sql`
    SELECT qq."questionBankItemId", qq."sequence", qq."marks",
           q."prompt", q."questionType"
    FROM "quiz_questions" qq
    JOIN "question_bank_items" q ON q."id" = qq."questionBankItemId"
    WHERE qq."quizId" = ${quizId} AND qq."institutionId" = ${institutionId}
    ORDER BY ${quiz.shuffleQuestions ? Prisma.sql`RANDOM()` : Prisma.sql`qq."sequence" ASC`}
  `);

  const options = await prisma.$queryRaw<
    Array<{ id: string; questionBankItemId: string; label: string; sequence: number }>
  >(Prisma.sql`
    SELECT o."id", o."questionBankItemId", o."label", o."sequence"
    FROM "question_options" o
    JOIN "quiz_questions" qq ON qq."questionBankItemId" = o."questionBankItemId"
    WHERE qq."quizId" = ${quizId} AND o."institutionId" = ${institutionId}
    ORDER BY o."sequence" ASC
  `);

  return {
    attemptId,
    quiz: {
      id: quiz.id,
      title: quiz.title,
      durationMinutes: quiz.durationMinutes,
      totalMarks: quiz.totalMarks,
      closesAt: quiz.closesAt,
    },
    questions: questions.map((question) => ({
      ...question,
      options: options
        .filter((option) => option.questionBankItemId === question.questionBankItemId)
        .map((option) => ({ id: option.id, label: option.label })),
    })),
  };
}

/**
 * Submits an attempt. Objective questions are scored against the key
 * immediately; written answers are parked for manual review and the
 * attempt stays SUBMITTED until a grader closes it.
 */
export async function submitQuizAttempt(
  institutionId: string,
  actor: AuthenticatedUser,
  attemptId: string,
  answers: Array<{
    questionBankItemId: string;
    selectedOptionIds?: string[];
    textAnswer?: string;
  }>,
  meta: { ipAddress?: string; userAgent?: string }
) {
  const attempt = await requireTenantRow<{
    id: string;
    quizId: string;
    studentId: string;
    status: string;
    attemptNumber: number;
  }>(prisma, "quiz_attempts", institutionId, attemptId, "Quiz attempt");

  if (attempt.studentId !== actor.id) {
    throw new AppError("This attempt does not belong to you", 403);
  }
  if (attempt.status !== "IN_PROGRESS") {
    throw new AppError("This attempt has already been submitted", 409);
  }

  const quiz = await requireTenantRow<QuizRow>(
    prisma,
    "quizzes",
    institutionId,
    attempt.quizId,
    "Quiz"
  );
  if (quiz.closesAt && quiz.closesAt < new Date()) {
    // The attempt still submits — the student may have started in time —
    // but the late submission is recorded on the attempt.
    await prisma.$executeRaw`
      UPDATE "quiz_attempts" SET "feedback" = 'Submitted after the deadline'
      WHERE "id" = ${attemptId}
    `;
  }

  const paper = await prisma.$queryRaw<
    Array<{ questionBankItemId: string; marks: number; questionType: string }>
  >(Prisma.sql`
    SELECT qq."questionBankItemId", qq."marks", q."questionType"
    FROM "quiz_questions" qq
    JOIN "question_bank_items" q ON q."id" = qq."questionBankItemId"
    WHERE qq."quizId" = ${attempt.quizId} AND qq."institutionId" = ${institutionId}
  `);
  const paperByQuestion = new Map(
    paper.map((row) => [row.questionBankItemId, row])
  );

  const correctOptions = await prisma.$queryRaw<
    Array<{ questionBankItemId: string; id: string }>
  >(Prisma.sql`
    SELECT o."questionBankItemId", o."id"
    FROM "question_options" o
    JOIN "quiz_questions" qq ON qq."questionBankItemId" = o."questionBankItemId"
    WHERE qq."quizId" = ${attempt.quizId}
      AND o."institutionId" = ${institutionId}
      AND o."isCorrect" = TRUE
  `);
  const keyByQuestion = new Map<string, Set<string>>();
  for (const option of correctOptions) {
    const set = keyByQuestion.get(option.questionBankItemId) ?? new Set<string>();
    set.add(option.id);
    keyByQuestion.set(option.questionBankItemId, set);
  }

  let autoScore = 0;
  let needsReview = false;

  await prisma.$transaction(async (tx) => {
    for (const answer of answers) {
      const question = paperByQuestion.get(answer.questionBankItemId);
      if (!question) {
        throw new AppError(
          "An answer was submitted for a question outside this quiz",
          400
        );
      }

      const autoGradable =
        AUTO_GRADABLE.includes(question.questionType as QuestionType) &&
        quiz.gradingMode === "AUTO";

      let awarded: number | null = null;
      let isCorrect: boolean | null = null;

      if (autoGradable) {
        const key = keyByQuestion.get(answer.questionBankItemId) ?? new Set();
        const selected = new Set(answer.selectedOptionIds ?? []);
        isCorrect =
          selected.size === key.size &&
          [...selected].every((optionId) => key.has(optionId));
        awarded = isCorrect ? question.marks : 0;
        autoScore += awarded;
      } else {
        needsReview = true;
      }

      await tx.$executeRaw`
        INSERT INTO "quiz_answers"
          ("id", "institutionId", "quizAttemptId", "questionBankItemId",
           "selectedOptionIds", "textAnswer", "awardedMarks", "isCorrect",
           "requiresManualReview")
        VALUES
          (${randomUUID()}, ${institutionId}, ${attemptId},
           ${answer.questionBankItemId},
           ${answer.selectedOptionIds
             ? (answer.selectedOptionIds as Prisma.InputJsonValue)
             : Prisma.JsonNull},
           ${answer.textAnswer ?? null}, ${awarded}, ${isCorrect}, ${!autoGradable})
        ON CONFLICT ("quizAttemptId", "questionBankItemId") DO UPDATE
        SET "selectedOptionIds" = EXCLUDED."selectedOptionIds",
            "textAnswer" = EXCLUDED."textAnswer",
            "awardedMarks" = EXCLUDED."awardedMarks",
            "isCorrect" = EXCLUDED."isCorrect",
            "requiresManualReview" = EXCLUDED."requiresManualReview"
      `;
    }

    await tx.$executeRaw`
      UPDATE "quiz_attempts"
      SET "status" = ${needsReview ? "SUBMITTED" : "GRADED"},
          "submittedAt" = CURRENT_TIMESTAMP,
          "score" = ${needsReview ? null : autoScore},
          "maxScore" = ${quiz.totalMarks},
          "gradedAt" = ${needsReview ? null : new Date()}
      WHERE "id" = ${attemptId} AND "institutionId" = ${institutionId}
    `;
  });

  await recordAuditLog({
    institutionId,
    userId: actor.id,
    action: "lms.quiz_submitted",
    entityType: "QuizAttempt",
    entityId: attemptId,
    metadata: {
      quizId: attempt.quizId,
      answered: answers.length,
      autoScore: needsReview ? null : autoScore,
    },
    ...meta,
  });

  return {
    attemptId,
    status: needsReview ? "SUBMITTED" : "GRADED",
    score: needsReview ? null : autoScore,
    maxScore: quiz.totalMarks,
    showResults: quiz.showResultsImmediately && !needsReview,
  };
}

export async function listAttemptsForGrading(
  institutionId: string,
  actor: AuthenticatedUser,
  quizId: string
) {
  const quiz = await requireTenantRow<QuizRow>(
    prisma,
    "quizzes",
    institutionId,
    quizId,
    "Quiz"
  );
  await assertCanTeach(institutionId, actor, quiz.courseOfferingId);

  return prisma.$queryRaw<
    Array<{
      id: string;
      studentId: string;
      studentName: string;
      attemptNumber: number;
      status: string;
      score: number | null;
      maxScore: number | null;
      submittedAt: Date | null;
      pendingAnswers: number;
    }>
  >(Prisma.sql`
    SELECT a."id", a."studentId", a."attemptNumber", a."status", a."score",
           a."maxScore", a."submittedAt",
           u."firstName" || ' ' || u."lastName" AS "studentName",
           (SELECT COUNT(*) FROM "quiz_answers" ans
             WHERE ans."quizAttemptId" = a."id"
               AND ans."requiresManualReview" = TRUE
               AND ans."awardedMarks" IS NULL)::int AS "pendingAnswers"
    FROM "quiz_attempts" a
    JOIN "users" u ON u."id" = a."studentId"
    WHERE a."quizId" = ${quizId} AND a."institutionId" = ${institutionId}
    ORDER BY a."submittedAt" DESC NULLS LAST
  `);
}

export async function getAttemptForGrading(
  institutionId: string,
  actor: AuthenticatedUser,
  attemptId: string
) {
  const attempt = await requireTenantRow<{
    id: string;
    quizId: string;
    studentId: string;
    status: string;
  }>(prisma, "quiz_attempts", institutionId, attemptId, "Quiz attempt");
  const quiz = await requireTenantRow<QuizRow>(
    prisma,
    "quizzes",
    institutionId,
    attempt.quizId,
    "Quiz"
  );

  if (attempt.studentId === actor.id) {
    // A student may review their own graded attempt only.
    if (attempt.status !== "GRADED") {
      throw new AppError("This attempt has not been graded yet", 403);
    }
  } else {
    await assertCanTeach(institutionId, actor, quiz.courseOfferingId);
  }

  const answers = await prisma.$queryRaw<
    Array<{
      id: string;
      questionBankItemId: string;
      prompt: string;
      questionType: string;
      marks: number;
      textAnswer: string | null;
      selectedOptionIds: unknown;
      awardedMarks: number | null;
      isCorrect: boolean | null;
      requiresManualReview: boolean;
      feedback: string | null;
    }>
  >(Prisma.sql`
    SELECT ans."id", ans."questionBankItemId", q."prompt", q."questionType",
           qq."marks", ans."textAnswer", ans."selectedOptionIds",
           ans."awardedMarks", ans."isCorrect", ans."requiresManualReview",
           ans."feedback"
    FROM "quiz_answers" ans
    JOIN "question_bank_items" q ON q."id" = ans."questionBankItemId"
    JOIN "quiz_questions" qq
      ON qq."questionBankItemId" = ans."questionBankItemId" AND qq."quizId" = ${attempt.quizId}
    WHERE ans."quizAttemptId" = ${attemptId}
      AND ans."institutionId" = ${institutionId}
    ORDER BY qq."sequence" ASC
  `);

  return { attempt, quiz, answers };
}

/** Manual grading closes the attempt and recomputes its total. */
export async function gradeQuizAttempt(
  institutionId: string,
  actor: AuthenticatedUser,
  attemptId: string,
  input: {
    answers: Array<{ answerId: string; awardedMarks: number; feedback?: string }>;
    feedback?: string;
  },
  meta: { ipAddress?: string; userAgent?: string }
) {
  const attempt = await requireTenantRow<{
    id: string;
    quizId: string;
    studentId: string;
    status: string;
  }>(prisma, "quiz_attempts", institutionId, attemptId, "Quiz attempt");
  const quiz = await requireTenantRow<QuizRow>(
    prisma,
    "quizzes",
    institutionId,
    attempt.quizId,
    "Quiz"
  );
  await assertCanTeach(institutionId, actor, quiz.courseOfferingId);

  if (attempt.status === "IN_PROGRESS") {
    throw new AppError("This attempt has not been submitted yet", 409);
  }

  const maxima = await prisma.$queryRaw<
    Array<{ id: string; marks: number }>
  >(Prisma.sql`
    SELECT ans."id", qq."marks"
    FROM "quiz_answers" ans
    JOIN "quiz_questions" qq
      ON qq."questionBankItemId" = ans."questionBankItemId" AND qq."quizId" = ${attempt.quizId}
    WHERE ans."quizAttemptId" = ${attemptId}
      AND ans."institutionId" = ${institutionId}
  `);
  const maxByAnswer = new Map(maxima.map((row) => [row.id, row.marks]));

  for (const answer of input.answers) {
    const max = maxByAnswer.get(answer.answerId);
    if (max === undefined) {
      throw new AppError("An answer does not belong to this attempt", 400);
    }
    if (answer.awardedMarks < 0 || answer.awardedMarks > max) {
      throw new AppError(
        `Awarded marks must be between 0 and ${max}`,
        400
      );
    }
  }

  let total = 0;
  await prisma.$transaction(async (tx) => {
    for (const answer of input.answers) {
      await tx.$executeRaw`
        UPDATE "quiz_answers"
        SET "awardedMarks" = ${answer.awardedMarks},
            "feedback" = ${answer.feedback ?? null},
            "requiresManualReview" = FALSE
        WHERE "id" = ${answer.answerId}
          AND "quizAttemptId" = ${attemptId}
          AND "institutionId" = ${institutionId}
      `;
    }

    const totals = await tx.$queryRaw<{ total: number | null }[]>(Prisma.sql`
      SELECT SUM("awardedMarks")::float AS "total"
      FROM "quiz_answers"
      WHERE "quizAttemptId" = ${attemptId} AND "institutionId" = ${institutionId}
    `);
    total = round2(totals[0]?.total ?? 0);

    await tx.$executeRaw`
      UPDATE "quiz_attempts"
      SET "status" = 'GRADED', "score" = ${total}, "gradedById" = ${actor.id},
          "gradedAt" = CURRENT_TIMESTAMP,
          "feedback" = COALESCE(${input.feedback ?? null}, "feedback")
      WHERE "id" = ${attemptId} AND "institutionId" = ${institutionId}
    `;

    await tx.notification.create({
      data: {
        institutionId,
        userId: attempt.studentId,
        title: "Quiz graded",
        body: `Your attempt for "${quiz.title}" has been graded.`,
      },
    });
  });

  await recordAuditLog({
    institutionId,
    userId: actor.id,
    action: "lms.quiz_graded",
    entityType: "QuizAttempt",
    entityId: attemptId,
    metadata: { quizId: attempt.quizId, score: total },
    ...meta,
  });

  return { attemptId, score: total };
}

// ==========================================================
// PROGRESS
// ==========================================================

/** Per-student completion across the offering's published content. */
export async function getStudentCourseProgress(
  institutionId: string,
  actor: AuthenticatedUser,
  courseOfferingId: string,
  studentId: string
) {
  await assertCanViewStudent(institutionId, actor, studentId);

  const rows = await prisma.$queryRaw<
    Array<{ totalLessons: number; completedLessons: number }>
  >(Prisma.sql`
    SELECT
      COUNT(*)::int AS "totalLessons",
      COUNT(*) FILTER (WHERE p."status" = 'COMPLETED')::int AS "completedLessons"
    FROM "course_lessons" l
    JOIN "course_modules" m ON m."id" = l."courseModuleId"
    LEFT JOIN "lesson_progresses" p
      ON p."courseLessonId" = l."id" AND p."studentId" = ${studentId}
    WHERE m."courseOfferingId" = ${courseOfferingId}
      AND m."institutionId" = ${institutionId}
      AND m."isPublished" = TRUE
      AND l."isPublished" = TRUE
  `);

  const quizRows = await prisma.$queryRaw<
    Array<{ totalQuizzes: number; attemptedQuizzes: number; averageScore: number | null }>
  >(Prisma.sql`
    SELECT
      COUNT(DISTINCT q."id")::int AS "totalQuizzes",
      COUNT(DISTINCT a."quizId")::int AS "attemptedQuizzes",
      AVG(CASE WHEN a."maxScore" > 0 THEN a."score" / a."maxScore" * 100 END)::float AS "averageScore"
    FROM "quizzes" q
    LEFT JOIN "quiz_attempts" a
      ON a."quizId" = q."id" AND a."studentId" = ${studentId} AND a."status" = 'GRADED'
    WHERE q."courseOfferingId" = ${courseOfferingId}
      AND q."institutionId" = ${institutionId}
      AND q."status" = 'PUBLISHED'
  `);

  const totalLessons = rows[0]?.totalLessons ?? 0;
  const completedLessons = rows[0]?.completedLessons ?? 0;

  return {
    studentId,
    courseOfferingId,
    totalLessons,
    completedLessons,
    lessonCompletionPercentage:
      totalLessons > 0 ? round2((completedLessons / totalLessons) * 100) : null,
    totalQuizzes: quizRows[0]?.totalQuizzes ?? 0,
    attemptedQuizzes: quizRows[0]?.attemptedQuizzes ?? 0,
    averageQuizScore:
      quizRows[0]?.averageScore !== null && quizRows[0]?.averageScore !== undefined
        ? round2(quizRows[0].averageScore)
        : null,
  };
}

/** Class-wide completion, for the faculty running the offering. */
export async function getOfferingProgress(
  institutionId: string,
  actor: AuthenticatedUser,
  courseOfferingId: string
) {
  await assertCanTeach(institutionId, actor, courseOfferingId);
  const roster = await getCourseOfferingRoster(institutionId, courseOfferingId);

  const progress = await prisma.$queryRaw<
    Array<{ studentId: string; completedLessons: number }>
  >(Prisma.sql`
    SELECT p."studentId", COUNT(*)::int AS "completedLessons"
    FROM "lesson_progresses" p
    JOIN "course_lessons" l ON l."id" = p."courseLessonId"
    JOIN "course_modules" m ON m."id" = l."courseModuleId"
    WHERE m."courseOfferingId" = ${courseOfferingId}
      AND p."institutionId" = ${institutionId}
      AND p."status" = 'COMPLETED'
    GROUP BY p."studentId"
  `);
  const byStudent = new Map(
    progress.map((row) => [row.studentId, row.completedLessons])
  );

  const totalLessons = await countRows(
    prisma,
    "course_lessons",
    Prisma.sql`WHERE "institutionId" = ${institutionId}
      AND "isPublished" = TRUE
      AND "courseModuleId" IN (
        SELECT "id" FROM "course_modules"
        WHERE "courseOfferingId" = ${courseOfferingId} AND "isPublished" = TRUE
      )`
  );

  return {
    courseOfferingId,
    totalLessons,
    students: roster.map((student) => {
      const completed = byStudent.get(student.studentId) ?? 0;
      return {
        ...student,
        completedLessons: completed,
        completionPercentage:
          totalLessons > 0 ? round2((completed / totalLessons) * 100) : null,
      };
    }),
  };
}
