import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";
import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";
import { AuthenticatedUser } from "../types/auth";
import { PaginationParams } from "../utils/pagination";
import { assertCanViewStudent, assertCourseOfferingInScope, isInstitutionWide } from "./accessScope.service";
import { assertOwnsCourseOffering, loadCourseOfferingOrThrow } from "../utils/courseOfferingAccess";
import { getCourseOfferingRoster, assertStudentEnrolledInCourseOffering } from "../utils/academicRoster";
import { recordAuditLog } from "./audit.service";
import { publishDomainEvent } from "./domainEvent.service";

const LEADERSHIP = ["HOD", "DEAN", "DIRECTOR"];

async function q<T = any>(sql: string, ...values: unknown[]): Promise<T[]> {
  return prisma.$queryRawUnsafe<T[]>(sql, ...values);
}
async function x(sql: string, ...values: unknown[]): Promise<number> {
  return prisma.$executeRawUnsafe(sql, ...values);
}
function institutionWide(actor: AuthenticatedUser) {
  return isInstitutionWide(actor);
}
async function teach(institutionId: string, actor: AuthenticatedUser, offeringId: string) {
  const offering = await loadCourseOfferingOrThrow(institutionId, offeringId);
  if (institutionWide(actor)) return offering;
  if (LEADERSHIP.some(r => actor.roles.includes(r))) {
    await assertCourseOfferingInScope(institutionId, actor, offeringId);
    return offering;
  }
  assertOwnsCourseOffering(actor, offering.facultyId);
  return offering;
}
async function settings(institutionId: string) {
  const existing = await q<any>('SELECT * FROM "lms_settings" WHERE "institutionId"=$1', institutionId);
  if (existing[0]) return existing[0];
  await x('INSERT INTO "lms_settings" ("institutionId") VALUES ($1) ON CONFLICT ("institutionId") DO NOTHING', institutionId);
  return (await q<any>('SELECT * FROM "lms_settings" WHERE "institutionId"=$1', institutionId))[0];
}
async function workflow(institutionId: string, offeringId: string) {
  const existing = await q<any>('SELECT * FROM "lms_course_workflows" WHERE "institutionId"=$1 AND "courseOfferingId"=$2', institutionId, offeringId);
  if (existing[0]) return existing[0];
  await x('INSERT INTO "lms_course_workflows" ("id","institutionId","courseOfferingId") VALUES ($1,$2,$3) ON CONFLICT ("courseOfferingId") DO NOTHING', randomUUID(), institutionId, offeringId);
  return (await q<any>('SELECT * FROM "lms_course_workflows" WHERE "institutionId"=$1 AND "courseOfferingId"=$2', institutionId, offeringId))[0];
}
async function learn(institutionId: string, actor: AuthenticatedUser, offeringId: string) {
  if (actor.roles.includes("PARENT")) {
    const s = await settings(institutionId);
    if (!s.allowParentVisibility) throw new AppError("Parent LMS visibility is disabled", 403);
    const link = await prisma.parentStudentLink.findFirst({ where: { institutionId, parentId: actor.id }, select: { studentId: true } });
    if (!link) throw new AppError("No linked student is available", 403);
    await assertStudentEnrolledInCourseOffering(institutionId, link.studentId, offeringId);
    return link.studentId;
  }
  if (actor.roles.includes("STUDENT")) {
    await assertStudentEnrolledInCourseOffering(institutionId, actor.id, offeringId);
    return actor.id;
  }
  await teach(institutionId, actor, offeringId);
  return null;
}

export async function getWorkspace(institutionId: string, actor: AuthenticatedUser, offeringId: string) {
  const studentId = await learn(institutionId, actor, offeringId);
  const wf = await workflow(institutionId, offeringId);
  if (studentId && wf.status !== "PUBLISHED") throw new AppError("This course is not published", 404);
  const [offering, modules, assignments, quizzes, liveClasses, announcements, discussion] = await Promise.all([
    loadCourseOfferingOrThrow(institutionId, offeringId),
    listContent(institutionId, actor, offeringId),
    prisma.assignment.findMany({ where: { institutionId, courseOfferingId: offeringId, ...(studentId ? { status: "PUBLISHED" } : {}) }, orderBy: { dueDate: "asc" }, take: 100 }),
    q<any>('SELECT * FROM "quizzes" WHERE "institutionId"=$1 AND "courseOfferingId"=$2 ORDER BY "createdAt" DESC LIMIT 100', institutionId, offeringId),
    q<any>('SELECT * FROM "lms_live_classes" WHERE "institutionId"=$1 AND "courseOfferingId"=$2 ORDER BY "startsAt" DESC LIMIT 100', institutionId, offeringId),
    q<any>('SELECT id,title,body,audience,"departmentId","courseOfferingId","publishedAt","expiresAt" FROM "notices" WHERE "institutionId"=$1 AND ("courseOfferingId"=$2 OR ("courseOfferingId" IS NULL AND "audience" IN (\'ALL\',\'INSTITUTION\',\'COURSE\'))) ORDER BY "publishedAt" DESC LIMIT 100', institutionId, offeringId),
    listDiscussions(institutionId, actor, offeringId, { skip: 0, take: 50 }),
  ]);
  return { offering, workflow: wf, modules, assignments, quizzes, liveClasses, announcements, discussion };
}

async function listContent(institutionId: string, actor: AuthenticatedUser, offeringId: string) {
  const studentView = actor.roles.includes("STUDENT") || actor.roles.includes("PARENT");
  const modules = await q<any>('SELECT * FROM "course_modules" WHERE "institutionId"=$1 AND "courseOfferingId"=$2 ' + (studentView ? 'AND "isPublished"=TRUE ' : '') + 'ORDER BY "sequence"', institutionId, offeringId);
  const out: any[] = [];
  for (const module of modules) {
    const lessons = await q<any>('SELECT l.*, (SELECT COUNT(*)::int FROM "lesson_resources" r WHERE r."courseLessonId"=l.id) AS "resourceCount" FROM "course_lessons" l WHERE l."institutionId"=$1 AND l."courseModuleId"=$2 ' + (studentView ? 'AND l."isPublished"=TRUE ' : '') + 'ORDER BY l."sequence"', institutionId, module.id);
    for (const lesson of lessons) {
      lesson.resources = await q<any>('SELECT r.*, a."mimeType",a."size",a.url AS "fileUrl",a."id" AS "fileAssetId" FROM "lesson_resources" r LEFT JOIN "lms_lesson_files" lf ON lf."lessonResourceId"=r.id LEFT JOIN "file_assets" a ON a.id=lf."fileAssetId" WHERE r."institutionId"=$1 AND r."courseLessonId"=$2 ORDER BY r."createdAt"', institutionId, lesson.id);
    }
    out.push({ ...module, lessons });
  }
  return out;
}

export async function transitionCourse(institutionId: string, actor: AuthenticatedUser, offeringId: string, action: string, reason?: string) {
  await loadCourseOfferingOrThrow(institutionId, offeringId);
  const wf = await workflow(institutionId, offeringId);
  const now = new Date();
  let next = wf.status;
  if (action === "SUBMIT") {
    await teach(institutionId, actor, offeringId);
    if (!["DRAFT", "REJECTED"].includes(wf.status)) throw new AppError("Course cannot be submitted from its current state", 409);
    next = "PENDING_APPROVAL";
  } else if (action === "APPROVE" || action === "REJECT") {
    if (!LEADERSHIP.some(r => actor.roles.includes(r)) && !institutionWide(actor)) throw new AppError("Approval authority required", 403);
    if (wf.status !== "PENDING_APPROVAL") throw new AppError("Only pending courses can be changed", 409);
    if (!institutionWide(actor)) await assertCourseOfferingInScope(institutionId, actor, offeringId);
    next = action === "APPROVE" ? "APPROVED" : "REJECTED";
  } else if (action === "PUBLISH") {
    await teach(institutionId, actor, offeringId);
    if (wf.status !== "APPROVED" && !institutionWide(actor)) throw new AppError("Course must be approved before publishing", 409);
    next = "PUBLISHED";
  } else if (action === "ARCHIVE") {
    await teach(institutionId, actor, offeringId);
    if (wf.status !== "PUBLISHED") throw new AppError("Only published courses can be archived", 409);
    next = "ARCHIVED";
  } else if (action === "REOPEN") {
    await teach(institutionId, actor, offeringId);
    if (wf.status !== "ARCHIVED") throw new AppError("Only archived courses can be reopened", 409);
    next = "DRAFT";
  } else throw new AppError("Unsupported course workflow action", 400);

  await x('UPDATE "lms_course_workflows" SET "status"=$1,"submittedById"=CASE WHEN $2=\'SUBMIT\' THEN $3 ELSE "submittedById" END,"submittedAt"=CASE WHEN $2=\'SUBMIT\' THEN $4 ELSE "submittedAt" END,"approvedById"=CASE WHEN $2=\'APPROVE\' THEN $3 ELSE "approvedById" END,"approvedAt"=CASE WHEN $2=\'APPROVE\' THEN $4 ELSE "approvedAt" END,"rejectedById"=CASE WHEN $2=\'REJECT\' THEN $3 ELSE NULL END,"rejectedAt"=CASE WHEN $2=\'REJECT\' THEN $4 ELSE NULL END,"rejectionReason"=CASE WHEN $2=\'REJECT\' THEN $5 ELSE NULL END,"publishedAt"=CASE WHEN $1=\'PUBLISHED\' THEN $4 ELSE "publishedAt" END,"archivedAt"=CASE WHEN $1=\'ARCHIVED\' THEN $4 ELSE NULL END,"updatedAt"=$4 WHERE "institutionId"=$6 AND "courseOfferingId"=$7', next, action, actor.id, now, reason || null, institutionId, offeringId);
  publishDomainEvent('lms.course.' + next.toLowerCase(), { institutionId, actorId: actor.id, payload: { courseOfferingId: offeringId } });
  await recordAuditLog({ institutionId, userId: actor.id, action: 'lms.course_' + next.toLowerCase(), entityType: 'CourseOffering', entityId: offeringId, metadata: { previous: wf.status, next, reason } });
  return workflow(institutionId, offeringId);
}

export async function listCatalog(institutionId: string, actor: AuthenticatedUser, p: PaginationParams, filters: { departmentId?: string; programId?: string; academicYearId?: string; semesterId?: string; sectionId?: string; search?: string }) {
  const where: string[] = ['o."institutionId"=$1', 'o."isActive"=TRUE'];
  const values: unknown[] = [institutionId];
  const add = (sql: string, value: unknown) => { values.push(value); where.push(sql.replace('?', '$' + values.length)); };
  if (filters.departmentId) add('c."departmentId"=?', filters.departmentId);
  if (filters.programId) add('s."programId"=?', filters.programId);
  if (filters.academicYearId) add('s."academicYearId"=?', filters.academicYearId);
  if (filters.semesterId) add('o."semesterId"=?', filters.semesterId);
  if (filters.sectionId) add('o."sectionId"=?', filters.sectionId);
  if (filters.search) { values.push('%' + filters.search + '%'); where.push('(c."name" ILIKE $' + values.length + ' OR c."code" ILIKE $' + values.length + ')'); }
  if (actor.roles.includes("STUDENT")) {
    const ids = await prisma.courseRegistration.findMany({ where: { institutionId, studentId: actor.id, status: "APPROVED" }, select: { courseOfferingId: true } });
    if (!ids.length) where.push('FALSE');
    else { const placeholders = ids.map((_, i) => '$' + (values.length + i + 1)).join(','); values.push(...ids.map(x => x.courseOfferingId)); where.push('o.id IN (' + placeholders + ')'); }
  }
  const base = ' FROM "course_offerings" o JOIN courses c ON c.id=o."courseId" JOIN semesters s ON s.id=o."semesterId" JOIN programs p ON p.id=s."programId" JOIN departments d ON d.id=c."departmentId" JOIN academic_years ay ON ay.id=s."academicYearId" JOIN sections sec ON sec.id=o."sectionId" LEFT JOIN "lms_course_workflows" w ON w."courseOfferingId"=o.id WHERE ' + where.join(' AND ');
  const dataValues = [...values, p.take, p.skip];
  const items = await q<any>('SELECT o.id,o."courseId",o."semesterId",o."sectionId",o."facultyId",c.code,c.name,d.id AS "departmentId",d.name AS "departmentName",p.name AS "programName",ay.name AS "academicYearName",s.name AS "semesterName",sec.name AS "sectionName",COALESCE(w.status,\'DRAFT\') AS "lmsStatus"' + base + ' ORDER BY c.code LIMIT $' + (dataValues.length - 1) + ' OFFSET $' + dataValues.length, ...dataValues);
  const totalRows = await q<any>('SELECT COUNT(*)::int AS count' + base, ...values);
  return { items, total: Number(totalRows[0]?.count || 0) };
}

export async function getAnalytics(institutionId: string, actor: AuthenticatedUser, offeringId: string) {
  await learn(institutionId, actor, offeringId);
  const roster = await getCourseOfferingRoster(institutionId, offeringId);
  const [content, assignments, quiz, progress, marks, exams] = await Promise.all([
    q<any>('SELECT COUNT(*)::int AS modules,COALESCE(SUM((SELECT COUNT(*) FROM course_lessons l WHERE l."courseModuleId"=m.id)),0)::int AS lessons,COALESCE(SUM(CASE WHEN "isPublished" THEN 1 ELSE 0 END),0)::int AS "publishedModules" FROM course_modules m WHERE m."institutionId"=$1 AND m."courseOfferingId"=$2', institutionId, offeringId),
    prisma.assignment.count({ where: { institutionId, courseOfferingId: offeringId } }),
    q<any>('SELECT COUNT(DISTINCT q.id)::int AS quizzes,COALESCE(AVG(a.score),0)::float AS "avgScore" FROM quizzes q LEFT JOIN quiz_attempts a ON a."quizId"=q.id AND a.status=\'GRADED\' WHERE q."institutionId"=$1 AND q."courseOfferingId"=$2', institutionId, offeringId),
    q<any>('SELECT COUNT(*)::int AS completed FROM lesson_progresses lp JOIN course_lessons l ON l.id=lp."courseLessonId" JOIN course_modules m ON m.id=l."courseModuleId" WHERE lp."institutionId"=$1 AND m."courseOfferingId"=$2 AND lp.status=\'COMPLETED\'', institutionId, offeringId),
    q<any>('SELECT COALESCE(AVG("marksObtained"/NULLIF("maxMarks",0)*100),0)::float AS avg FROM internal_marks WHERE "institutionId"=$1 AND "courseOfferingId"=$2', institutionId, offeringId),
    q<any>('SELECT COUNT(*)::int AS exams,COALESCE(AVG(er.marks/NULLIF(e."maxMarks",0)*100),0)::float AS avg FROM exams e LEFT JOIN exam_results er ON er."examId"=e.id WHERE e."institutionId"=$1 AND e."courseOfferingId"=$2', institutionId, offeringId),
  ]);
  return { rosterSize: roster.length, content: content[0], assignments, quizzes: quiz[0], progress: progress[0], internalMarks: marks[0], examinations: exams[0] };
}

export async function listReport(institutionId: string, actor: AuthenticatedUser, p: PaginationParams, filters: any) {
  const catalog = await listCatalog(institutionId, actor, p, filters);
  const items = [];
  for (const offering of catalog.items) items.push({ ...offering, analytics: await getAnalytics(institutionId, actor, offering.id) });
  return { items, total: catalog.total };
}

export async function listDiscussions(institutionId: string, actor: AuthenticatedUser, offeringId: string, p: PaginationParams) {
  const viewerStudentId = await learn(institutionId, actor, offeringId);
  const items = await q<any>('SELECT d.*,u."firstName",u."lastName" FROM lms_discussions d JOIN users u ON u.id=d."authorId" WHERE d."institutionId"=$1 AND d."courseOfferingId"=$2 ORDER BY d."createdAt" DESC LIMIT $3 OFFSET $4', institutionId, offeringId, p.take, p.skip);
  const total = await q<any>('SELECT COUNT(*)::int AS count FROM lms_discussions WHERE "institutionId"=$1 AND "courseOfferingId"=$2', institutionId, offeringId);
  return { items, total: Number(total[0]?.count || 0), viewerStudentId };
}

export async function postDiscussion(institutionId: string, actor: AuthenticatedUser, offeringId: string, body: string, parentId?: string) {
  await learn(institutionId, actor, offeringId);
  if (actor.roles.includes("PARENT")) throw new AppError("Parents have read-only LMS discussion access", 403);
  if (!body?.trim()) throw new AppError("Discussion message is required", 400);
  if (parentId) {
    const parent = await q<any>('SELECT * FROM lms_discussions WHERE id=$1 AND "institutionId"=$2 AND "courseOfferingId"=$3', parentId, institutionId, offeringId);
    if (!parent[0]) throw new AppError("Parent discussion not found", 404);
    if (parent[0].isLocked) throw new AppError("Discussion is locked", 409);
  }
  const id = randomUUID();
  await x('INSERT INTO lms_discussions ("id","institutionId","courseOfferingId","authorId","parentId","body") VALUES ($1,$2,$3,$4,$5,$6)', id, institutionId, offeringId, actor.id, parentId || null, body.trim());
  publishDomainEvent("lms.discussion.created", { institutionId, actorId: actor.id, payload: { courseOfferingId: offeringId, discussionId: id } });
  return { id };
}

export async function manageDiscussion(institutionId: string, actor: AuthenticatedUser, id: string, patch: any) {
  const row = await q<any>('SELECT * FROM lms_discussions WHERE id=$1 AND "institutionId"=$2', id, institutionId);
  if (!row[0]) throw new AppError("Discussion not found", 404);
  await teach(institutionId, actor, row[0].courseOfferingId);
  await x('UPDATE lms_discussions SET "isPinned"=COALESCE($1,"isPinned"),"isLocked"=COALESCE($2,"isLocked"),"updatedAt"=CURRENT_TIMESTAMP WHERE id=$3 AND "institutionId"=$4', patch.isPinned ?? null, patch.isLocked ?? null, id, institutionId);
  return { updated: true };
}

export async function scheduleLive(institutionId: string, actor: AuthenticatedUser, input: any) {
  await teach(institutionId, actor, input.courseOfferingId);
  const starts = new Date(input.startsAt), ends = new Date(input.endsAt);
  if (!(ends > starts)) throw new AppError("End time must be after start time", 400);
  const id = randomUUID();
  await x('INSERT INTO lms_live_classes ("id","institutionId","courseOfferingId","title","description","startsAt","endsAt","meetingUrl","provider","createdById") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)', id, institutionId, input.courseOfferingId, input.title.trim(), input.description || null, starts, ends, input.meetingUrl || null, input.provider || null, actor.id);
  publishDomainEvent("lms.live_class.scheduled", { institutionId, actorId: actor.id, payload: { courseOfferingId: input.courseOfferingId, liveClassId: id } });
  return { id };
}

export async function updateLive(institutionId: string, actor: AuthenticatedUser, id: string, patch: any) {
  const row = await q<any>('SELECT * FROM lms_live_classes WHERE id=$1 AND "institutionId"=$2', id, institutionId);
  if (!row[0]) throw new AppError("Live class not found", 404);
  await teach(institutionId, actor, row[0].courseOfferingId);
  if (patch.status && !["SCHEDULED","LIVE","ENDED","CANCELLED"].includes(patch.status)) throw new AppError("Invalid live class status", 400);
  await x('UPDATE lms_live_classes SET "title"=COALESCE($1,"title"),"description"=COALESCE($2,"description"),"meetingUrl"=COALESCE($3,"meetingUrl"),"provider"=COALESCE($4,"provider"),"status"=COALESCE($5,"status"),"recordingFileAssetId"=COALESCE($6,"recordingFileAssetId"),"updatedAt"=CURRENT_TIMESTAMP WHERE id=$7 AND "institutionId"=$8', patch.title ?? null, patch.description ?? null, patch.meetingUrl ?? null, patch.provider ?? null, patch.status ?? null, patch.recordingFileAssetId ?? null, id, institutionId);
  return { updated: true };
}

export async function announce(institutionId: string, actor: AuthenticatedUser, input: any) {
  if (!actor.permissions.includes("notices.manage") && !institutionWide(actor)) throw new AppError("Announcement permission required", 403);
  if (input.courseOfferingId) await teach(institutionId, actor, input.courseOfferingId);
  if (input.audience === "DEPARTMENT" && !input.departmentId) throw new AppError("Department is required", 400);
  const id = randomUUID();
  await x('INSERT INTO notices ("id","institutionId","title","body","audience","departmentId","courseOfferingId","publishedAt","expiresAt","createdById") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)', id, institutionId, input.title.trim(), input.body.trim(), input.audience || "INSTITUTION", input.departmentId || null, input.courseOfferingId || null, input.publishedAt ? new Date(input.publishedAt) : new Date(), input.expiresAt ? new Date(input.expiresAt) : null, actor.id);
  publishDomainEvent("lms.announcement.published", { institutionId, actorId: actor.id, payload: { announcementId: id, courseOfferingId: input.courseOfferingId || null } });
  return { id };
}

export async function getGradebook(institutionId: string, actor: AuthenticatedUser, offeringId: string, p: PaginationParams) {
  await teach(institutionId, actor, offeringId);
  const roster = await getCourseOfferingRoster(institutionId, offeringId);
  const page = roster.slice(p.skip, p.skip + p.take);
  const rows: any[] = [];
  for (const student of page) {
    const [assignments, marks, quizzes, exams] = await Promise.all([
      prisma.assignmentSubmission.findMany({ where: { institutionId, studentId: student.studentId, assignment: { courseOfferingId: offeringId } }, include: { assignment: { select: { id: true, title: true, maxMarks: true } } } }),
      prisma.internalMark.findMany({ where: { institutionId, studentId: student.studentId, courseOfferingId: offeringId } }),
      q<any>('SELECT COALESCE(SUM(score),0)::float AS score,COALESCE(SUM("maxScore"),0)::float AS max FROM quiz_attempts qa JOIN quizzes qz ON qz.id=qa."quizId" WHERE qa."institutionId"=$1 AND qa."studentId"=$2 AND qz."courseOfferingId"=$3 AND qa.status=\'GRADED\'', institutionId, student.studentId, offeringId),
      prisma.examResult.findMany({ where: { institutionId, studentId: student.studentId, exam: { courseOfferingId: offeringId } }, include: { exam: { select: { title: true, maxMarks: true } } } }),
    ]);
    rows.push({ ...student, assignments, internalMarks: marks, quizzes: quizzes[0], examinations: exams });
  }
  return { items: rows, total: roster.length };
}

export async function linkedStudents(institutionId: string, actor: AuthenticatedUser) {
  if (!actor.roles.includes("PARENT")) throw new AppError("Parent role required", 403);
  const links = await prisma.parentStudentLink.findMany({ where: { institutionId, parentId: actor.id }, select: { studentId: true, relationship: true } });
  const result: any[] = [];
  for (const link of links) {
    const user = await prisma.user.findFirst({ where: { id: link.studentId, institutionId }, select: { id: true, firstName: true, lastName: true } });
    if (user) result.push({ ...user, relationship: link.relationship });
  }
  return result;
}

export async function getStudentOverview(institutionId: string, actor: AuthenticatedUser, studentId: string) {
  await assertCanViewStudent(institutionId, actor, studentId);
  const registrations = await prisma.courseRegistration.findMany({ where: { institutionId, studentId, status: "APPROVED" }, select: { courseOfferingId: true } });
  const rows = [];
  for (const r of registrations) rows.push({ courseOfferingId: r.courseOfferingId, analytics: await getAnalytics(institutionId, actor, r.courseOfferingId) });
  return { studentId, offerings: rows };
}

export async function getSettings(institutionId: string, actor: AuthenticatedUser) {
  if (!institutionWide(actor)) throw new AppError("Institution LMS settings require institution administration authority", 403);
  return settings(institutionId);
}
export async function updateSettings(institutionId: string, actor: AuthenticatedUser, input: any) {
  if (!institutionWide(actor)) throw new AppError("Institution LMS settings require institution administration authority", 403);
  const allowed = ["approvalRequired","allowStudentDiscussions","allowParentVisibility","completionThreshold","certificateEnabled","allowExternalLinks","maxResourceSizeMb","defaultLiveProvider"];
  const sets: string[] = [];
  const values: unknown[] = [];
  for (const key of allowed) if (input[key] !== undefined) { values.push(input[key]); sets.push('"' + key + '"=$' + values.length); }
  if (sets.length) { values.push(actor.id, institutionId); await x('UPDATE "lms_settings" SET ' + sets.join(',') + ',"updatedById"=$' + (values.length - 1) + ',"updatedAt"=CURRENT_TIMESTAMP WHERE "institutionId"=$' + values.length, ...values); }
  return settings(institutionId);
}

export async function certificateEligibility(institutionId: string, actor: AuthenticatedUser, studentId: string, offeringId: string) {
  await assertCanViewStudent(institutionId, actor, studentId);
  const s = await settings(institutionId);
  if (!s.certificateEnabled) return { eligible: false, reason: "Certificates are disabled" };
  const a = await getAnalytics(institutionId, actor, offeringId);
  const totalLessons = Number(a.content?.lessons || 0), completed = Number(a.progress?.completed || 0);
  const percentage = totalLessons ? Math.round(completed / totalLessons * 100) : 0;
  return { eligible: percentage >= Number(s.completionThreshold), completionPercentage: percentage, threshold: Number(s.completionThreshold), courseOfferingId: offeringId };
}

export async function uploadLink(institutionId: string, actor: AuthenticatedUser, lessonResourceId: string, fileAssetId: string) {
  const rows = await q<any>('SELECT r.id,m."courseOfferingId" FROM lesson_resources r JOIN course_lessons l ON l.id=r."courseLessonId" JOIN course_modules m ON m.id=l."courseModuleId" WHERE r.id=$1 AND r."institutionId"=$2', lessonResourceId, institutionId);
  if (!rows[0]) throw new AppError("Lesson resource not found", 404);
  await teach(institutionId, actor, rows[0].courseOfferingId);
  const asset = await prisma.fileAsset.findFirst({ where: { id: fileAssetId, institutionId, module: "lms" } });
  if (!asset) throw new AppError("LMS file asset not found", 404);
  await x('INSERT INTO lms_lesson_files ("id","institutionId","lessonResourceId","fileAssetId") VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING', randomUUID(), institutionId, lessonResourceId, fileAssetId);
  return { linked: true, fileAssetId };
}

export async function linkSubmissionFile(institutionId: string, actor: AuthenticatedUser, submissionId: string, fileAssetId: string) {
  const submission = await prisma.assignmentSubmission.findFirst({ where: { id: submissionId, institutionId }, include: { assignment: true } });
  if (!submission) throw new AppError("Submission not found", 404);
  if (submission.studentId !== actor.id) { await teach(institutionId, actor, submission.assignment.courseOfferingId); }
  else await assertStudentEnrolledInCourseOffering(institutionId, actor.id, submission.assignment.courseOfferingId);
  const asset = await prisma.fileAsset.findFirst({ where: { id: fileAssetId, institutionId, module: "assignments" } });
  if (!asset) throw new AppError("Assignment file asset not found", 404);
  await x('INSERT INTO lms_submission_files ("id","institutionId","submissionId","fileAssetId") VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING', randomUUID(), institutionId, submissionId, fileAssetId);
  return { linked: true, fileAssetId };
}

export async function getSubmissionFiles(institutionId: string, actor: AuthenticatedUser, submissionId: string) {
  const s = await prisma.assignmentSubmission.findFirst({ where: { id: submissionId, institutionId }, include: { assignment: true } });
  if (!s) throw new AppError("Submission not found",404);
  if (s.studentId !== actor.id) await teach(institutionId,actor,s.assignment.courseOfferingId);
  const rows = await q<any>('SELECT f.* FROM lms_submission_files sf JOIN file_assets f ON f.id=sf."fileAssetId" WHERE sf."institutionId"=$1 AND sf."submissionId"=$2',institutionId,submissionId);
  return rows;
}

export async function getParentStudentOverview(institutionId:string,actor:AuthenticatedUser,studentId:string){
  if(!actor.roles.includes("PARENT")) throw new AppError("Parent role required",403);
  const link=await prisma.parentStudentLink.findFirst({where:{institutionId,parentId:actor.id,studentId},select:{studentId:true}});
  if(!link) throw new AppError("Linked student not found",403);
  return getStudentOverview(institutionId,actor,studentId);
}
