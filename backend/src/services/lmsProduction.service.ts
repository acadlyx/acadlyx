import { randomUUID } from "crypto";
import { prisma as db } from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";
import { AuthenticatedUser } from "../types/auth";
import { PaginationParams } from "../utils/pagination";
import { assertCanViewStudent, assertCourseOfferingInScope, getAuthorizedDepartmentIds, isInstitutionWide } from "./accessScope.service";
import { assertOwnsCourseOffering, loadCourseOfferingOrThrow } from "../utils/courseOfferingAccess";
import { getCourseOfferingRoster, assertStudentEnrolledInCourseOffering } from "../utils/academicRoster";
import { recordAuditLog } from "./audit.service";
import { publishDomainEvent } from "./domainEvent.service";
import { requestCertificate } from "./certificate.service";
import { logger } from "../utils/logger";

async function query<T = any>(sql: string, ...params: unknown[]): Promise<T[]> {
  return db.$queryRawUnsafe<T[]>(sql, ...params);
}
async function exec(sql: string, ...params: unknown[]) {
  return db.$executeRawUnsafe(sql, ...params);
}
const leadership = ["HOD", "DEAN", "DIRECTOR"];

async function teach(institutionId: string, actor: AuthenticatedUser, offeringId: string) {
  const offering = await loadCourseOfferingOrThrow(institutionId, offeringId);
  if (isInstitutionWide(actor)) return offering;
  if (leadership.some(r => actor.roles.includes(r))) {
    await assertCourseOfferingInScope(institutionId, actor, offeringId);
    return offering;
  }
  assertOwnsCourseOffering(actor, offering.facultyId);
  return offering;
}

async function getSettingsRow(institutionId: string) {
  const rows = await query<any>('SELECT * FROM lms_settings WHERE "institutionId"=$1', institutionId);
  if (rows[0]) return rows[0];
  await exec('INSERT INTO lms_settings ("institutionId") VALUES ($1) ON CONFLICT ("institutionId") DO NOTHING', institutionId);
  return (await query<any>('SELECT * FROM lms_settings WHERE "institutionId"=$1', institutionId))[0];
}

async function getWorkflow(institutionId: string, offeringId: string) {
  const rows = await query<any>('SELECT * FROM lms_course_workflows WHERE "institutionId"=$1 AND "courseOfferingId"=$2', institutionId, offeringId);
  if (rows[0]) return rows[0];
  await exec('INSERT INTO lms_course_workflows ("id","institutionId","courseOfferingId") VALUES ($1,$2,$3) ON CONFLICT ("courseOfferingId") DO NOTHING', randomUUID(), institutionId, offeringId);
  return (await query<any>('SELECT * FROM lms_course_workflows WHERE "institutionId"=$1 AND "courseOfferingId"=$2', institutionId, offeringId))[0];
}

async function studentContext(institutionId: string, actor: AuthenticatedUser, offeringId: string) {
  if (actor.roles.includes("PARENT")) {
    const setting = await getSettingsRow(institutionId);
    if (!setting.allowParentVisibility) throw new AppError("Parent LMS visibility is disabled", 403);
    const link = await db.parentStudentLink.findFirst({ where: { institutionId, parentId: actor.id }, select: { studentId: true } });
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
  const studentId = await studentContext(institutionId, actor, offeringId);
  const wf = await getWorkflow(institutionId, offeringId);
  if (studentId && wf.status !== "PUBLISHED") throw new AppError("This course is not published", 404);
  const [offering, modules, assignments, quizzes, liveClasses, announcements, discussions] = await Promise.all([
    loadCourseOfferingOrThrow(institutionId, offeringId),
    getContent(institutionId, actor, offeringId),
    db.assignment.findMany({ where: { institutionId, courseOfferingId: offeringId, ...(studentId ? { status: "PUBLISHED" } : {}) }, orderBy: { dueDate: "asc" }, take: 100 }),
    query<any>('SELECT * FROM quizzes WHERE "institutionId"=$1 AND "courseOfferingId"=$2 ORDER BY "createdAt" DESC LIMIT 100', institutionId, offeringId),
    query<any>('SELECT * FROM lms_live_classes WHERE "institutionId"=$1 AND "courseOfferingId"=$2 ORDER BY "startsAt" DESC LIMIT 100', institutionId, offeringId),
    query<any>('SELECT id,title,body,audience,"departmentId","courseOfferingId","publishedAt","expiresAt" FROM notices WHERE "institutionId"=$1 AND ("courseOfferingId"=$2 OR ("courseOfferingId" IS NULL AND "audience" IN (\'ALL\',\'INSTITUTION\',\'COURSE\'))) ORDER BY "publishedAt" DESC LIMIT 100', institutionId, offeringId),
    listDiscussions(institutionId, actor, offeringId, { page: 1, pageSize: 50, skip: 0, take: 50 })
  ]);
  return { offering, workflow: wf, modules, assignments, quizzes, liveClasses, announcements, discussions };
}

async function getContent(institutionId: string, actor: AuthenticatedUser, offeringId: string) {
  const student = actor.roles.includes("STUDENT") || actor.roles.includes("PARENT");
  const modules = await query<any>('SELECT * FROM course_modules WHERE "institutionId"=$1 AND "courseOfferingId"=$2 ' + (student ? 'AND "isPublished"=TRUE ' : '') + 'ORDER BY "sequence"', institutionId, offeringId);
  const result: any[] = [];
  for (const module of modules) {
    const lessons = await query<any>('SELECT l.*, (SELECT COUNT(*)::int FROM lesson_resources r WHERE r."courseLessonId"=l.id) AS "resourceCount" FROM course_lessons l WHERE l."institutionId"=$1 AND l."courseModuleId"=$2 ' + (student ? 'AND l."isPublished"=TRUE ' : '') + 'ORDER BY l."sequence"', institutionId, module.id);
    for (const lesson of lessons) {
      lesson.resources = await query<any>('SELECT r.*,a.id AS "fileAssetId",a.url AS "fileUrl",a."mimeType",a."size" FROM lesson_resources r LEFT JOIN lms_lesson_files lf ON lf."lessonResourceId"=r.id LEFT JOIN file_assets a ON a.id=lf."fileAssetId" WHERE r."institutionId"=$1 AND r."courseLessonId"=$2 ORDER BY r."createdAt"', institutionId, lesson.id);
    }
    result.push({ ...module, lessons });
  }
  return result;
}

export async function transitionCourse(institutionId: string, actor: AuthenticatedUser, offeringId: string, action: string, reason?: string) {
  await loadCourseOfferingOrThrow(institutionId, offeringId);
  const wf = await getWorkflow(institutionId, offeringId);
  const now = new Date();
  let next = wf.status;
  if (action === "SUBMIT") {
    await teach(institutionId, actor, offeringId);
    if (!["DRAFT", "REJECTED"].includes(wf.status)) throw new AppError("Course cannot be submitted from its current state", 409);
    next = (await getSettingsRow(institutionId)).approvalRequired ? "PENDING_APPROVAL" : "APPROVED";
  } else if (action === "APPROVE" || action === "REJECT") {
    if (!leadership.some(r => actor.roles.includes(r)) && !isInstitutionWide(actor)) throw new AppError("Approval authority required", 403);
    if (wf.status !== "PENDING_APPROVAL") throw new AppError("Only pending courses can be changed", 409);
    if (!isInstitutionWide(actor)) await assertCourseOfferingInScope(institutionId, actor, offeringId);
    next = action === "APPROVE" ? "APPROVED" : "REJECTED";
  } else if (action === "PUBLISH") {
    await teach(institutionId, actor, offeringId);
    if (wf.status !== "APPROVED") throw new AppError("Course must be approved before publishing", 409);
    next = "PUBLISHED";
  } else if (action === "ARCHIVE") {
    await teach(institutionId, actor, offeringId);
    if (wf.status !== "PUBLISHED") throw new AppError("Only published courses can be archived", 409);
    next = "ARCHIVED";
  } else if (action === "REOPEN") {
    await teach(institutionId, actor, offeringId);
    if (wf.status !== "ARCHIVED") throw new AppError("Only archived courses can be reopened", 409);
    next = "DRAFT";
  } else {
    throw new AppError("Unsupported course workflow action", 400);
  }
  await exec('UPDATE lms_course_workflows SET "status"=$1,"submittedById"=CASE WHEN $2=\'SUBMIT\' THEN $3 ELSE "submittedById" END,"submittedAt"=CASE WHEN $2=\'SUBMIT\' THEN $4 ELSE "submittedAt" END,"approvedById"=CASE WHEN $2=\'APPROVE\' THEN $3 ELSE "approvedById" END,"approvedAt"=CASE WHEN $2=\'APPROVE\' THEN $4 ELSE "approvedAt" END,"rejectedById"=CASE WHEN $2=\'REJECT\' THEN $3 ELSE NULL END,"rejectedAt"=CASE WHEN $2=\'REJECT\' THEN $4 ELSE NULL END,"rejectionReason"=CASE WHEN $2=\'REJECT\' THEN $5 ELSE NULL END,"publishedAt"=CASE WHEN $1=\'PUBLISHED\' THEN $4 ELSE "publishedAt" END,"archivedAt"=CASE WHEN $1=\'ARCHIVED\' THEN $4 ELSE NULL END,"updatedAt"=$4 WHERE "institutionId"=$6 AND "courseOfferingId"=$7', next, action, actor.id, now, reason || null, institutionId, offeringId);
  publishDomainEvent("lms.course." + next.toLowerCase(), { institutionId, actorId: actor.id, payload: { courseOfferingId: offeringId } });
  await recordAuditLog({ institutionId, userId: actor.id, action: "lms.course_" + next.toLowerCase(), entityType: "CourseOffering", entityId: offeringId, metadata: { previous: wf.status, next, reason } });
  return getWorkflow(institutionId, offeringId);
}

export async function listCatalog(institutionId: string, actor: AuthenticatedUser, p: PaginationParams, filters: any) {
  const where: string[] = ['o."institutionId"=$1', 'o."isActive"=TRUE'];
  const values: unknown[] = [institutionId];
  const add = (clause: string, value: unknown) => { values.push(value); where.push(clause.replace("?", "$" + values.length)); };
  if (filters.departmentId) add('c."departmentId"=?', filters.departmentId);
  if (filters.programId) add('s."programId"=?', filters.programId);
  if (filters.academicYearId) add('s."academicYearId"=?', filters.academicYearId);
  if (filters.semesterId) add('o."semesterId"=?', filters.semesterId);
  if (filters.sectionId) add('o."sectionId"=?', filters.sectionId);
  if (filters.search) { values.push("%" + filters.search + "%"); where.push('(c."name" ILIKE $' + values.length + ' OR c."code" ILIKE $' + values.length + ')'); }
  if (actor.roles.includes("STUDENT") || actor.roles.includes("PARENT")) {
    const students = actor.roles.includes("STUDENT") ? [actor.id] : (await db.parentStudentLink.findMany({ where: { institutionId, parentId: actor.id }, select: { studentId: true } })).map(x => x.studentId);
    const regs = students.length ? await db.courseRegistration.findMany({ where: { institutionId, studentId: { in: students }, status: "APPROVED" }, select: { courseOfferingId: true } }) : [];
    if (!regs.length) where.push("FALSE"); else { const ph=regs.map((_,i)=>"$"+(values.length+i+1)).join(","); values.push(...regs.map(x=>x.courseOfferingId)); where.push("o.id IN ("+ph+")"); where.push("COALESCE(w.status,'DRAFT')='PUBLISHED'"); }
  } else if (actor.roles.includes("FACULTY")) {
    values.push(actor.id); where.push('o."facultyId"=$'+values.length);
  } else if (!isInstitutionWide(actor)) {
    const departments = await getAuthorizedDepartmentIds(institutionId,actor);
    if(!departments.length) where.push("FALSE"); else { const ph=departments.map((_,i)=>"$"+(values.length+i+1)).join(","); values.push(...departments); where.push('c."departmentId" IN ('+ph+')'); }
  }
  const base=' FROM course_offerings o JOIN courses c ON c.id=o."courseId" JOIN semesters s ON s.id=o."semesterId" JOIN programs p ON p.id=s."programId" JOIN departments d ON d.id=c."departmentId" JOIN academic_years ay ON ay.id=s."academicYearId" JOIN sections sec ON sec.id=o."sectionId" LEFT JOIN lms_course_workflows w ON w."courseOfferingId"=o.id WHERE '+where.join(" AND ");
  const dataValues=[...values,p.take,p.skip];
  const items=await query<any>('SELECT o.id,o."courseId",o."semesterId",o."sectionId",o."facultyId",c.code,c.name,d.id AS "departmentId",d.name AS "departmentName",p.name AS "programName",ay.name AS "academicYearName",s.name AS "semesterName",sec.name AS "sectionName",COALESCE(w.status,\'DRAFT\') AS "lmsStatus"'+base+' ORDER BY c.code LIMIT $'+(dataValues.length-1)+' OFFSET $'+dataValues.length,...dataValues);
  const total=await query<any>('SELECT COUNT(*)::int AS count'+base,...values);
  return {items,total:Number(total[0]?.count||0)};
}

export async function getAnalytics(institutionId:string,actor:AuthenticatedUser,offeringId:string){
  await studentContext(institutionId,actor,offeringId);
  const roster=await getCourseOfferingRoster(institutionId,offeringId);
  const [content,assignments,quizzes,progress,marks,exams]=await Promise.all([
    query<any>('SELECT COUNT(*)::int AS modules,COALESCE(SUM((SELECT COUNT(*) FROM course_lessons l WHERE l."courseModuleId"=m.id)),0)::int AS lessons,COALESCE(SUM(CASE WHEN "isPublished" THEN 1 ELSE 0 END),0)::int AS "publishedModules" FROM course_modules m WHERE m."institutionId"=$1 AND m."courseOfferingId"=$2',institutionId,offeringId),
    db.assignment.count({where:{institutionId,courseOfferingId:offeringId}}),
    query<any>('SELECT COUNT(DISTINCT q.id)::int AS quizzes,COALESCE(AVG(a.score),0)::float AS "avgScore" FROM quizzes q LEFT JOIN quiz_attempts a ON a."quizId"=q.id AND a.status=\'GRADED\' WHERE q."institutionId"=$1 AND q."courseOfferingId"=$2',institutionId,offeringId),
    query<any>('SELECT COUNT(*)::int AS completed FROM lesson_progresses lp JOIN course_lessons l ON l.id=lp."courseLessonId" JOIN course_modules m ON m.id=l."courseModuleId" WHERE lp."institutionId"=$1 AND m."courseOfferingId"=$2 AND lp.status=\'COMPLETED\'',institutionId,offeringId),
    query<any>('SELECT COALESCE(AVG("marksObtained"/NULLIF("maxMarks",0)*100),0)::float AS avg FROM internal_marks WHERE "institutionId"=$1 AND "courseOfferingId"=$2',institutionId,offeringId),
    query<any>('SELECT COUNT(*)::int AS exams,COALESCE(AVG(er.marks/NULLIF(e."maxMarks",0)*100),0)::float AS avg FROM exams e LEFT JOIN exam_results er ON er."examId"=e.id WHERE e."institutionId"=$1 AND e."courseOfferingId"=$2',institutionId,offeringId)
  ]);
  return {rosterSize:roster.length,content:content[0],assignments,quizzes:quizzes[0],progress:progress[0],internalMarks:marks[0],examinations:exams[0]};
}

export async function listReport(institutionId:string,actor:AuthenticatedUser,p:PaginationParams,filters:any){
  const result=await listCatalog(institutionId,actor,p,filters); const items=[]; for(const row of result.items) items.push({...row,analytics:await getAnalytics(institutionId,actor,row.id)}); return {items,total:result.total};
}

export async function listDiscussions(institutionId:string,actor:AuthenticatedUser,offeringId:string,p:PaginationParams){
  const viewerStudentId=await studentContext(institutionId,actor,offeringId);
  const items=await query<any>('SELECT d.*,u."firstName",u."lastName" FROM lms_discussions d JOIN users u ON u.id=d."authorId" WHERE d."institutionId"=$1 AND d."courseOfferingId"=$2 ORDER BY d."createdAt" DESC LIMIT $3 OFFSET $4',institutionId,offeringId,p.take,p.skip);
  const total=await query<any>('SELECT COUNT(*)::int AS count FROM lms_discussions WHERE "institutionId"=$1 AND "courseOfferingId"=$2',institutionId,offeringId);
  return {items,total:Number(total[0]?.count||0),viewerStudentId};
}

export async function postDiscussion(institutionId:string,actor:AuthenticatedUser,offeringId:string,body:string,parentId?:string){
  await studentContext(institutionId,actor,offeringId); if(actor.roles.includes("PARENT")) throw new AppError("Parents have read-only LMS discussion access",403); if(!body.trim()) throw new AppError("Discussion message is required",400);
  if(parentId){const parent=await query<any>('SELECT id,"isLocked" FROM lms_discussions WHERE id=$1 AND "institutionId"=$2 AND "courseOfferingId"=$3',parentId,institutionId,offeringId);if(!parent[0])throw new AppError("Discussion not found",404);if(parent[0].isLocked)throw new AppError("Discussion is locked",409);}
  const id=randomUUID();await exec('INSERT INTO lms_discussions ("id","institutionId","courseOfferingId","authorId","parentId","body") VALUES ($1,$2,$3,$4,$5,$6)',id,institutionId,offeringId,actor.id,parentId||null,body.trim());
  publishDomainEvent("lms.discussion.created",{institutionId,actorId:actor.id,payload:{courseOfferingId:offeringId,discussionId:id}});return {id};
}

export async function manageDiscussion(institutionId:string,actor:AuthenticatedUser,id:string,patch:any){
  const rows=await query<any>('SELECT * FROM lms_discussions WHERE id=$1 AND "institutionId"=$2',id,institutionId);if(!rows[0])throw new AppError("Discussion not found",404);await teach(institutionId,actor,rows[0].courseOfferingId);
  await exec('UPDATE lms_discussions SET "isPinned"=COALESCE($1,"isPinned"),"isLocked"=COALESCE($2,"isLocked"),"updatedAt"=CURRENT_TIMESTAMP WHERE id=$3 AND "institutionId"=$4',patch.isPinned??null,patch.isLocked??null,id,institutionId);return {updated:true};
}

export async function scheduleLive(institutionId:string,actor:AuthenticatedUser,input:any){
  await teach(institutionId,actor,input.courseOfferingId);const starts=new Date(input.startsAt),ends=new Date(input.endsAt);if(!(ends>starts))throw new AppError("End time must be after start time",400);
  const id=randomUUID();await exec('INSERT INTO lms_live_classes ("id","institutionId","courseOfferingId","title","description","startsAt","endsAt","meetingUrl","provider","createdById") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',id,institutionId,input.courseOfferingId,input.title.trim(),input.description||null,starts,ends,input.meetingUrl||null,input.provider||null,actor.id);
  publishDomainEvent("lms.live_class.scheduled",{institutionId,actorId:actor.id,payload:{courseOfferingId:input.courseOfferingId,liveClassId:id}});return {id};
}

export async function updateLive(institutionId:string,actor:AuthenticatedUser,id:string,patch:any){
  const rows=await query<any>('SELECT * FROM lms_live_classes WHERE id=$1 AND "institutionId"=$2',id,institutionId);if(!rows[0])throw new AppError("Live class not found",404);await teach(institutionId,actor,rows[0].courseOfferingId);
  if(patch.status&&!["SCHEDULED","LIVE","ENDED","CANCELLED"].includes(patch.status))throw new AppError("Invalid live class status",400);
  await exec('UPDATE lms_live_classes SET "title"=COALESCE($1,"title"),"description"=COALESCE($2,"description"),"meetingUrl"=COALESCE($3,"meetingUrl"),"provider"=COALESCE($4,"provider"),"status"=COALESCE($5,"status"),"recordingFileAssetId"=COALESCE($6,"recordingFileAssetId"),"updatedAt"=CURRENT_TIMESTAMP WHERE id=$7 AND "institutionId"=$8',patch.title??null,patch.description??null,patch.meetingUrl??null,patch.provider??null,patch.status??null,patch.recordingFileAssetId??null,id,institutionId);return {updated:true};
}

export async function announce(institutionId:string,actor:AuthenticatedUser,input:any){
  if(!actor.permissions.includes("notices.manage")&&!isInstitutionWide(actor))throw new AppError("Announcement permission required",403);if(input.courseOfferingId)await teach(institutionId,actor,input.courseOfferingId);
  if(input.audience==="DEPARTMENT"&&!input.departmentId)throw new AppError("Department is required",400);const id=randomUUID();
  await exec('INSERT INTO notices ("id","institutionId","title","body","audience","departmentId","courseOfferingId","publishedAt","expiresAt","createdById") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',id,institutionId,input.title.trim(),input.body.trim(),input.audience||"INSTITUTION",input.departmentId||null,input.courseOfferingId||null,input.publishedAt?new Date(input.publishedAt):new Date(),input.expiresAt?new Date(input.expiresAt):null,actor.id);
  publishDomainEvent("lms.announcement.published",{institutionId,actorId:actor.id,payload:{courseOfferingId:input.courseOfferingId||null,announcementId:id}});return {id};
}

export async function getGradebook(institutionId:string,actor:AuthenticatedUser,offeringId:string,p:PaginationParams){
  await teach(institutionId,actor,offeringId);const roster=await getCourseOfferingRoster(institutionId,offeringId);const page=roster.slice(p.skip,p.skip+p.take);const items:any[]=[];
  for(const s of page){
    const [assignments,marks,quizzes,exams]=await Promise.all([
      db.assignmentSubmission.findMany({where:{institutionId,studentId:s.studentId,assignment:{courseOfferingId:offeringId}},include:{assignment:{select:{id:true,title:true,maxMarks:true}}}}),
      db.internalMark.findMany({where:{institutionId,studentId:s.studentId,courseOfferingId:offeringId}}),
      query<any>('SELECT COALESCE(SUM(score),0)::float AS score,COALESCE(SUM("maxScore"),0)::float AS max FROM quiz_attempts qa JOIN quizzes q ON q.id=qa."quizId" WHERE qa."institutionId"=$1 AND qa."studentId"=$2 AND q."courseOfferingId"=$3 AND qa.status=\'GRADED\'',institutionId,s.studentId,offeringId),
      db.examResult.findMany({where:{institutionId,studentId:s.studentId,exam:{courseOfferingId:offeringId}},include:{exam:{select:{title:true,maxMarks:true}}}})
    ]);
    items.push({...s,assignments,internalMarks:marks,quizzes:quizzes[0],examinations:exams});
  }
  return {items,total:roster.length};
}

export async function linkedStudents(institutionId:string,actor:AuthenticatedUser){
  if(!actor.roles.includes("PARENT"))throw new AppError("Parent role required",403);
  return db.parentStudentLink.findMany({where:{institutionId,parentId:actor.id},select:{studentId:true,relationship:true,student:{select:{id:true,firstName:true,lastName:true}}}});
}

export async function getParentStudentOverview(institutionId:string,actor:AuthenticatedUser,studentId:string){
  if(!actor.roles.includes("PARENT"))throw new AppError("Parent role required",403);
  const link=await db.parentStudentLink.findFirst({where:{institutionId,parentId:actor.id,studentId},select:{studentId:true}});if(!link)throw new AppError("Linked student not found",403);
  return getStudentOverview(institutionId,actor,studentId);
}
export async function getStudentOverview(institutionId:string,actor:AuthenticatedUser,studentId:string){
  await assertCanViewStudent(institutionId,actor,studentId);const regs=await db.courseRegistration.findMany({where:{institutionId,studentId,status:"APPROVED"},select:{courseOfferingId:true}});
  const offerings=[]; const failures=[];
  for (const r of regs) {
    try { offerings.push({courseOfferingId:r.courseOfferingId,analytics:await getAnalytics(institutionId,actor,r.courseOfferingId)}); }
    catch (error) { failures.push({ courseOfferingId: r.courseOfferingId, reason: error instanceof Error ? error.message : String(error) }); logger.warn("LMS student analytics failed", { studentId, courseOfferingId: r.courseOfferingId, error: error instanceof Error ? error.message : String(error) }); }
  }
  return {studentId,offerings,failures};
}

export async function getSettings(institutionId:string,actor:AuthenticatedUser){if(!isInstitutionWide(actor))throw new AppError("Institution LMS settings require institution administration authority",403);return getSettingsRow(institutionId);}
export async function updateSettings(institutionId:string,actor:AuthenticatedUser,input:any){
  if(!isInstitutionWide(actor))throw new AppError("Institution LMS settings require institution administration authority",403);const allowed=["approvalRequired","allowStudentDiscussions","allowParentVisibility","completionThreshold","certificateEnabled","allowExternalLinks","maxResourceSizeMb","defaultLiveProvider"];const sets:string[]=[];const values:unknown[]=[];
  for(const key of allowed)if(input[key]!==undefined){values.push(input[key]);sets.push('"'+key+'"=$'+values.length);}
  if(sets.length){values.push(actor.id,institutionId);await exec('UPDATE lms_settings SET '+sets.join(',')+',"updatedById"=$'+(values.length-1)+',"updatedAt"=CURRENT_TIMESTAMP WHERE "institutionId"=$'+values.length,...values);}return getSettingsRow(institutionId);
}

export async function filterOptions(institutionId:string,actor:AuthenticatedUser){
  const allowed=await getAuthorizedDepartmentIds(institutionId,actor);
  const departments=await db.department.findMany({where:{institutionId,isActive:true,...(allowed.length?{id:{in:allowed}}:{})},select:{id:true,name:true,code:true},orderBy:{name:"asc"}});
  const programs=await db.program.findMany({where:{institutionId,isActive:true,...(allowed.length?{departmentId:{in:allowed}}:{})},select:{id:true,name:true,code:true,departmentId:true},orderBy:{name:"asc"}});
  const semesters=await db.semester.findMany({where:{institutionId,isActive:true,...(allowed.length?{program:{departmentId:{in:allowed}}}:{})},select:{id:true,name:true,number:true,programId:true,academicYearId:true},orderBy:[{number:"asc"},{name:"asc"}]});
  const sections=await db.section.findMany({where:{institutionId,isActive:true,...(allowed.length?{semester:{program:{departmentId:{in:allowed}}}}:{})},select:{id:true,name:true,semesterId:true},orderBy:{name:"asc"}});
  const academicYears=await db.academicYear.findMany({where:{institutionId},select:{id:true,name:true,isCurrent:true},orderBy:{startDate:"desc"}});
  return {departments,programs,semesters,sections,academicYears};
}

export async function requestCompletionCertificate(institutionId:string,actor:AuthenticatedUser,offeringId:string){
  const studentId=actor.roles.includes("STUDENT")?actor.id:"";
  if(!studentId)throw new AppError("A student context is required",403);const eligibility=await certificateEligibility(institutionId,actor,studentId,offeringId);
  if(!eligibility.eligible)throw new AppError("Course completion certificate eligibility has not been reached",409);
  return requestCertificate(institutionId,actor,{studentId,certificateType:"COURSE_COMPLETION",purpose:"LMS course completion"},{});
}
export async function certificateEligibility(institutionId:string,actor:AuthenticatedUser,studentId:string,offeringId:string){
  await assertCanViewStudent(institutionId,actor,studentId);const s=await getSettingsRow(institutionId);if(!s.certificateEnabled)return{eligible:false,reason:"Certificates are disabled"};const a=await getAnalytics(institutionId,actor,offeringId);const total=Number(a.content?.lessons||0),done=Number(a.progress?.completed||0),percentage=total?Math.round(done/total*100):0;return{eligible:percentage>=Number(s.completionThreshold),completionPercentage:percentage,threshold:Number(s.completionThreshold),courseOfferingId:offeringId};
}

export async function linkLessonFile(institutionId:string,actor:AuthenticatedUser,resourceId:string,fileAssetId:string){
  const rows=await query<any>('SELECT r.id,m."courseOfferingId" FROM lesson_resources r JOIN course_lessons l ON l.id=r."courseLessonId" JOIN course_modules m ON m.id=l."courseModuleId" WHERE r.id=$1 AND r."institutionId"=$2',resourceId,institutionId);if(!rows[0])throw new AppError("Resource not found",404);await teach(institutionId,actor,rows[0].courseOfferingId);
  const asset=await db.fileAsset.findFirst({where:{id:fileAssetId,institutionId,module:"lms"}});if(!asset)throw new AppError("LMS file asset not found",404);await exec('INSERT INTO lms_lesson_files ("id","institutionId","lessonResourceId","fileAssetId") VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING',randomUUID(),institutionId,resourceId,fileAssetId);return{linked:true,fileAssetId};
}
export async function linkSubmissionFile(institutionId:string,actor:AuthenticatedUser,submissionId:string,fileAssetId:string){
  const s=await db.assignmentSubmission.findFirst({where:{id:submissionId,institutionId},include:{assignment:true}});if(!s)throw new AppError("Submission not found",404);if(s.studentId===actor.id)await assertStudentEnrolledInCourseOffering(institutionId,actor.id,s.assignment.courseOfferingId);else await teach(institutionId,actor,s.assignment.courseOfferingId);
  const asset=await db.fileAsset.findFirst({where:{id:fileAssetId,institutionId,module:"assignments"}});if(!asset)throw new AppError("Assignment file asset not found",404);await exec('INSERT INTO lms_submission_files ("id","institutionId","submissionId","fileAssetId") VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING',randomUUID(),institutionId,submissionId,fileAssetId);return{linked:true,fileAssetId};
}
export async function getSubmissionFiles(institutionId:string,actor:AuthenticatedUser,submissionId:string){
  const s=await db.assignmentSubmission.findFirst({where:{id:submissionId,institutionId},include:{assignment:true}});if(!s)throw new AppError("Submission not found",404);if(s.studentId!==actor.id)await teach(institutionId,actor,s.assignment.courseOfferingId);
  return query<any>('SELECT f.id,f."originalName",f."mimeType",f.size,f.url FROM lms_submission_files sf JOIN file_assets f ON f.id=sf."fileAssetId" WHERE sf."institutionId"=$1 AND sf."submissionId"=$2',institutionId,submissionId);
}
