import * as XLSX from "xlsx";
import * as crypto from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";
import { AuthenticatedUser } from "../types/auth";
import { hashPassword } from "../utils/password";

export const IMPORT_TYPES = ["users", "students", "faculty", "campuses", "departments", "programs", "academic-years", "semesters", "sections", "courses", "course-offerings", "exams", "marks", "attendance", "fees", "fee-payments", "fee-structures", "notices", "timetable", "parent-links"] as const;
export type ImportType = typeof IMPORT_TYPES[number];

type Row = Record<string, any>;

function text(v: any): string { return String(v ?? "").trim(); }
function number(v: any): number { const n = Number(v); return Number.isFinite(n) ? n : 0; }
function bool(v: any): boolean { return [true, 1, "1", "true", "yes", "y"].includes(typeof v === "string" ? v.toLowerCase() : v); }
function date(v: any): Date { if (v instanceof Date) return v; if (typeof v === "number") return XLSX.SSF.parse_date_code(v) ? new Date(Date.UTC(XLSX.SSF.parse_date_code(v).y, XLSX.SSF.parse_date_code(v).m - 1, XLSX.SSF.parse_date_code(v).d)) : new Date(v); const d = new Date(v); if (Number.isNaN(d.getTime())) throw new AppError(`Invalid date: ${v}`, 400); return d; }
function normalizeRow(row: Row): Row { return Object.fromEntries(Object.entries(row).map(([k,v]) => [k.toLowerCase().replace(/[\s_-]+/g, ""), v])); }

export function parseWorkbook(buffer: Buffer) {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new AppError("Workbook has no sheets", 400);
  const rows = XLSX.utils.sheet_to_json<Row>(workbook.Sheets[sheetName], { defval: "" });
  return { sheetName, rows: rows.map(normalizeRow), totalRows: rows.length };
}

export function preview(buffer: Buffer, type: ImportType) {
  const parsed = parseWorkbook(buffer);
  if (!IMPORT_TYPES.includes(type)) throw new AppError("Unsupported import type", 400);
  return { ...parsed, type, sample: parsed.rows.slice(0, 10) };
}

function assertImportRole(actor: AuthenticatedUser) {
  if (!actor.permissions.includes("imports.manage")) throw new AppError("Spreadsheet import permission required", 403);
}

async function findOrCreateRole(tx: Prisma.TransactionClient, institutionId: string, name: string) {
  const role = await tx.role.findFirst({ where: { institutionId, name } });
  if (!role) throw new AppError(`Role ${name} is not configured for this institution`, 400);
  return role;
}

async function upsertUser(tx: Prisma.TransactionClient, institutionId: string, row: Row, roleName: string) {
  const email = text(row.email).toLowerCase();
  if (!email) throw new AppError("Every user row needs an email", 400);
  const role = await findOrCreateRole(tx, institutionId, roleName);
  const existing = await tx.user.findUnique({ where: { email } });
  if (existing && existing.institutionId !== institutionId) {
    throw new AppError(`Email ${email} already belongs to another institution`, 409);
  }
  const password = text(row.password) || `${roleName.toLowerCase()}@123`;
  const user = existing
    ? await tx.user.update({ where: { id: existing.id }, data: { firstName: text(row.firstname) || existing.firstName, lastName: text(row.lastname) || existing.lastName, phone: text(row.phone) || existing.phone, isActive: row.active === "" ? existing.isActive : bool(row.active) } })
    : await tx.user.create({ data: { institutionId, email, passwordHash: await hashPassword(password), firstName: text(row.firstname) || "User", lastName: text(row.lastname), phone: text(row.phone) || null } });
  await tx.userRole.upsert({ where: { userId_roleId: { userId: user.id, roleId: role.id } }, update: {}, create: { userId: user.id, roleId: role.id } });
  return user;
}

async function resolveDepartment(tx: Prisma.TransactionClient, institutionId: string, row: Row) {
  const code = text(row.departmentcode);
  const name = text(row.department);
  if (!code && !name) throw new AppError("Department code/name is required", 400);
  const department = await tx.department.findFirst({ where: { institutionId, ...(code ? { code } : { name }) } });
  if (!department) throw new AppError(`Department not found: ${code || name}`, 400);
  return department;
}

async function resolveProgram(tx: Prisma.TransactionClient, institutionId: string, row: Row) {
  const code = text(row.programcode);
  const name = text(row.program);
  const program = await tx.program.findFirst({ where: { institutionId, ...(code ? { code } : { name }) } });
  if (!program) throw new AppError(`Program not found: ${code || name}`, 400);
  return program;
}

async function resolveStudent(tx: Prisma.TransactionClient, institutionId: string, row: Row) {
  const email = text(row.email).toLowerCase();
  const roll = text(row.rollnumber);
  const student = await tx.user.findFirst({ where: { institutionId, userRoles: { some: { role: { name: "STUDENT" } } }, OR: [{ email }, ...(roll ? [{ studentEnrollments: { some: { rollNumber: roll } } }] : [])] }, orderBy: { createdAt: "asc" } });
  if (!student) throw new AppError(`Student not found: ${email || roll}`, 400);
  return student;
}

async function resolveOffering(tx: Prisma.TransactionClient, institutionId: string, row: Row) {
  const code = text(row.coursecode);
  const section = text(row.section);
  const offering = await tx.courseOffering.findFirst({ where: { institutionId, course: { code }, ...(section ? { section: { name: section } } : {}) }, include: { course: true, section: true } });
  if (!offering) throw new AppError(`Course offering not found: ${code}/${section}`, 400);
  return offering;
}

export async function commit(buffer: Buffer, type: ImportType, institutionId: string, actor: AuthenticatedUser) {
  assertImportRole(actor);
  const rows = parseWorkbook(buffer).rows;
  if (!rows.length) throw new AppError("The first sheet contains no data rows", 400);
  let imported = 0;
  const errors: { row: number; message: string }[] = [];

  await prisma.$transaction(async (tx) => {
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        if (type === "users") {
          const roleName = text(row.role) || "STAFF";
          await upsertUser(tx, institutionId, row, roleName);
        } else if (type === "campuses") {
          await tx.campus.upsert({ where: { institutionId_code: { institutionId, code: text(row.code) } }, update: { name: text(row.name), address: text(row.address) || null, isActive: row.active === "" ? true : bool(row.active) }, create: { institutionId, code: text(row.code), name: text(row.name), address: text(row.address) || null, isActive: row.active === "" ? true : bool(row.active) } });
        } else if (type === "academic-years") {
          const name = text(row.name);
          if (!name) throw new AppError("Academic year name is required", 400);
          await tx.academicYear.upsert({ where: { institutionId_name: { institutionId, name } }, update: { startDate: date(row.startdate), endDate: date(row.enddate), isCurrent: bool(row.iscurrent) }, create: { institutionId, name, startDate: date(row.startdate), endDate: date(row.enddate), isCurrent: bool(row.iscurrent) } });
        } else if (type === "semesters") {
          const program = await resolveProgram(tx, institutionId, row);
          const year = await tx.academicYear.findFirst({ where: { institutionId, name: text(row.academicyear) } });
          if (!year) throw new AppError(`Academic year not found: ${text(row.academicyear)}`, 400);
          const semesterNumber = number(row.number || row.semesternumber);
          if (!semesterNumber) throw new AppError("Semester number is required", 400);
          await tx.semester.upsert({ where: { programId_academicYearId_number: { programId: program.id, academicYearId: year.id, number: semesterNumber } }, update: { name: text(row.name) || `Semester ${semesterNumber}`, startDate: text(row.startdate) ? date(row.startdate) : null, endDate: text(row.enddate) ? date(row.enddate) : null, isActive: row.active === "" ? true : bool(row.active) }, create: { institutionId, programId: program.id, academicYearId: year.id, number: semesterNumber, name: text(row.name) || `Semester ${semesterNumber}`, startDate: text(row.startdate) ? date(row.startdate) : null, endDate: text(row.enddate) ? date(row.enddate) : null, isActive: row.active === "" ? true : bool(row.active) } });
        } else if (type === "course-offerings") {
          const course = await tx.course.findFirst({ where: { institutionId, code: text(row.coursecode) } });
          if (!course) throw new AppError(`Course not found: ${text(row.coursecode)}`, 400);
          const semester = await tx.semester.findFirst({ where: { institutionId, program: { code: text(row.programcode) }, academicYear: { name: text(row.academicyear) }, number: number(row.semesternumber) } });
          if (!semester) throw new AppError("Semester not found for course offering", 400);
          const section = await tx.section.findFirst({ where: { institutionId, semesterId: semester.id, name: text(row.section) } });
          if (!section) throw new AppError(`Section not found: ${text(row.section)}`, 400);
          let facultyId: string | null = null;
          if (text(row.facultyemail)) {
            const faculty = await tx.user.findFirst({ where: { institutionId, email: text(row.facultyemail).toLowerCase(), userRoles: { some: { role: { name: "FACULTY" } } } } });
            if (!faculty) throw new AppError(`Faculty not found: ${text(row.facultyemail)}`, 400);
            facultyId = faculty.id;
          }
          await tx.courseOffering.upsert({ where: { courseId_semesterId_sectionId: { courseId: course.id, semesterId: semester.id, sectionId: section.id } }, update: { facultyId, isActive: row.active === "" ? true : bool(row.active) }, create: { institutionId, courseId: course.id, semesterId: semester.id, sectionId: section.id, facultyId, isActive: row.active === "" ? true : bool(row.active) } });
        } else if (type === "parent-links") {
          const parent = await tx.user.findFirst({ where: { institutionId, email: text(row.parentemail).toLowerCase(), userRoles: { some: { role: { name: "PARENT" } } } } });
          const student = await tx.user.findFirst({ where: { institutionId, email: text(row.studentemail).toLowerCase(), userRoles: { some: { role: { name: "STUDENT" } } } } });
          if (!parent || !student) throw new AppError("Parent and student emails must belong to this institution", 400);
          await tx.parentStudentLink.upsert({ where: { parentId_studentId: { parentId: parent.id, studentId: student.id } }, update: { relationship: text(row.relationship) || null }, create: { institutionId, parentId: parent.id, studentId: student.id, relationship: text(row.relationship) || null } });
        } else if (type === "students") {
          const user = await upsertUser(tx, institutionId, row, "STUDENT");
          const program = await resolveProgram(tx, institutionId, row);
          const yearName = text(row.academicyear) || "2026-2027";
          const year = await tx.academicYear.findFirst({ where: { institutionId, name: yearName } });
          if (!year) throw new AppError(`Academic year not found: ${yearName}`, 400);
          let sectionId: string | null = null;
          let semesterId: string | null = null;
          const sectionName = text(row.section);
          if (sectionName) {
            const section = await tx.section.findFirst({ where: { institutionId, name: sectionName, semester: { programId: program.id, academicYearId: year.id } } });
            if (!section) throw new AppError(`Section not found: ${sectionName}`, 400);
            sectionId = section.id;
            semesterId = section.semesterId;
          }
          const admissionNumber = text(row.admissionnumber) || text(row.rollnumber);
          if (!admissionNumber) throw new AppError("admissionNumber (or rollNumber) is required for students", 400);
          await tx.studentProfile.upsert({ where: { userId: user.id }, update: { admissionNumber, dateOfBirth: text(row.dateofbirth) ? date(row.dateofbirth) : undefined, gender: text(row.gender) || null, bloodGroup: text(row.bloodgroup) || null, nationality: text(row.nationality) || null, address: text(row.address) || null, city: text(row.city) || null, state: text(row.state) || null, postalCode: text(row.postalcode) || null, guardianName: text(row.guardianname) || null, guardianPhone: text(row.guardianphone) || null, guardianEmail: text(row.guardianemail) || null, admissionDate: text(row.admissiondate) ? date(row.admissiondate) : undefined, status: text(row.status) || "ACTIVE" }, create: { institutionId, userId: user.id, admissionNumber, dateOfBirth: text(row.dateofbirth) ? date(row.dateofbirth) : null, gender: text(row.gender) || null, bloodGroup: text(row.bloodgroup) || null, nationality: text(row.nationality) || null, address: text(row.address) || null, city: text(row.city) || null, state: text(row.state) || null, postalCode: text(row.postalcode) || null, guardianName: text(row.guardianname) || null, guardianPhone: text(row.guardianphone) || null, guardianEmail: text(row.guardianemail) || null, admissionDate: text(row.admissiondate) ? date(row.admissiondate) : null, status: text(row.status) || "ACTIVE" } });
          await tx.studentEnrollment.upsert({ where: { userId_academicYearId: { userId: user.id, academicYearId: year.id } }, update: { programId: program.id, semesterId, sectionId, rollNumber: text(row.rollnumber) || null, status: text(row.status) || "ACTIVE" }, create: { institutionId, userId: user.id, programId: program.id, academicYearId: year.id, semesterId, sectionId, rollNumber: text(row.rollnumber) || null, status: text(row.status) || "ACTIVE" } });
        } else if (type === "faculty") {
          await upsertUser(tx, institutionId, row, "FACULTY");
        } else if (type === "departments") {
          const campusId = text(row.campusid) || null;
          if (campusId) { const campus = await tx.campus.findFirst({ where: { id: campusId, institutionId } }); if (!campus) throw new AppError(`Campus not found: ${campusId}`, 400); }
          await tx.department.upsert({ where: { institutionId_code: { institutionId, code: text(row.code) } }, update: { name: text(row.name), campusId, isActive: row.active === "" ? true : bool(row.active) }, create: { institutionId, code: text(row.code), name: text(row.name), campusId, isActive: row.active === "" ? true : bool(row.active) } });
        } else if (type === "programs") {
          const department = await resolveDepartment(tx, institutionId, row);
          await tx.program.upsert({ where: { institutionId_code: { institutionId, code: text(row.code) } }, update: { name: text(row.name), departmentId: department.id, level: text(row.level) || "UG", durationYears: number(row.durationyears) || 4 }, create: { institutionId, code: text(row.code), name: text(row.name), departmentId: department.id, level: text(row.level) || "UG", durationYears: number(row.durationyears) || 4 } });
        } else if (type === "courses") {
          const department = await resolveDepartment(tx, institutionId, row);
          await tx.course.upsert({ where: { institutionId_code: { institutionId, code: text(row.code) } }, update: { name: text(row.name), departmentId: department.id, credits: number(row.credits) || 4, description: text(row.description) || null }, create: { institutionId, code: text(row.code), name: text(row.name), departmentId: department.id, credits: number(row.credits) || 4, description: text(row.description) || null } });
        } else if (type === "sections") {
          const program = await resolveProgram(tx, institutionId, row);
          const yearName = text(row.academicyear);
          const year = await tx.academicYear.findFirst({ where: { institutionId, name: yearName } });
          if (!year) throw new AppError(`Academic year not found: ${yearName}`, 400);
          const semester = await tx.semester.findFirst({ where: { institutionId, programId: program.id, academicYearId: year.id, number: number(row.semesternumber) } });
          if (!semester) throw new AppError(`Semester not found for ${program.code}`, 400);
          await tx.section.upsert({ where: { semesterId_name: { semesterId: semester.id, name: text(row.name) } }, update: { capacity: number(row.capacity) || null, isActive: row.active === "" ? true : bool(row.active) }, create: { institutionId, semesterId: semester.id, name: text(row.name), capacity: number(row.capacity) || null } });
        } else if (type === "exams") {
          const offering = await resolveOffering(tx, institutionId, row);
          const title = text(row.title);
          if (!title) throw new AppError("Exam title is required", 400);
          await tx.exam.create({ data: { institutionId, courseOfferingId: offering.id, title, examDate: date(row.examdate || row.date), maxMarks: number(row.maxmarks) || 100, createdById: actor.id } });
        } else if (type === "marks") {
          const student = await resolveStudent(tx, institutionId, row);
          const offering = await resolveOffering(tx, institutionId, row);
          const component = text(row.component) || "Internal 1";
          await tx.internalMark.upsert({ where: { courseOfferingId_studentId_component: { courseOfferingId: offering.id, studentId: student.id, component } }, update: { marksObtained: number(row.marksobtained), maxMarks: number(row.maxmarks) || 100, enteredById: actor.id }, create: { institutionId, courseOfferingId: offering.id, studentId: student.id, component, marksObtained: number(row.marksobtained), maxMarks: number(row.maxmarks) || 100, enteredById: actor.id } });
        } else if (type === "attendance") {
          const student = await resolveStudent(tx, institutionId, row);
          const offering = await resolveOffering(tx, institutionId, row);
          const sessionDate = date(row.date);
          const session = await tx.attendanceSession.upsert({ where: { courseOfferingId_sessionDate: { courseOfferingId: offering.id, sessionDate } }, update: {}, create: { institutionId, courseOfferingId: offering.id, facultyId: actor.id, sessionDate } });
          await tx.attendanceRecord.upsert({ where: { attendanceSessionId_studentId: { attendanceSessionId: session.id, studentId: student.id } }, update: { status: text(row.status).toUpperCase() || "ABSENT" }, create: { attendanceSessionId: session.id, studentId: student.id, status: text(row.status).toUpperCase() || "ABSENT" } });
        } else if (type === "fees") {
          const student = await resolveStudent(tx, institutionId, row);
          await tx.feeInvoice.create({ data: { institutionId, studentId: student.id, title: text(row.title) || "Fee Invoice", amount: number(row.amount), dueDate: text(row.duedate) ? date(row.duedate) : null, status: text(row.status) || "PENDING" } });
        } else if (type === "fee-structures") {
          const name = text(row.name) || text(row.structurename);
          const feeHeadCode = text(row.feeheadcode);
          if (!name || !feeHeadCode) throw new AppError("name and feeHeadCode are required for fee structure import", 400);
          const feeHead = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`SELECT "id" FROM "fee_heads" WHERE "institutionId" = ${institutionId} AND "code" = ${feeHeadCode.toUpperCase()} LIMIT 1`);
          if (!feeHead[0]) throw new AppError(`Fee head not found: ${feeHeadCode}`, 400);
          const year = text(row.academicyear) ? await tx.academicYear.findFirst({ where: { institutionId, name: text(row.academicyear) } }) : null;
          const program = text(row.programcode) ? await tx.program.findFirst({ where: { institutionId, code: text(row.programcode) } }) : null;
          const semester = text(row.semesterid) ? await tx.semester.findFirst({ where: { institutionId, id: text(row.semesterid) } }) : null;
          const existing = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`SELECT "id" FROM "fee_structures" WHERE "institutionId" = ${institutionId} AND "name" = ${name} AND COALESCE("academicYearId", '') = COALESCE(${year?.id ?? null}, '') AND COALESCE("programId", '') = COALESCE(${program?.id ?? null}, '') LIMIT 1`);
          const structureId = existing[0]?.id || crypto.randomUUID();
          if (existing[0]) await tx.$executeRaw(Prisma.sql`UPDATE "fee_structures" SET "status" = ${text(row.status) || "DRAFT"}, "currency" = ${text(row.currency) || "INR"}, "notes" = ${text(row.notes) || null}, "semesterId" = ${semester?.id ?? null}, "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = ${structureId} AND "institutionId" = ${institutionId}`);
          else await tx.$executeRaw(Prisma.sql`INSERT INTO "fee_structures" ("id","institutionId","name","academicYearId","programId","semesterId","status","currency","notes","createdById") VALUES (${structureId},${institutionId},${name},${year?.id ?? null},${program?.id ?? null},${semester?.id ?? null},${text(row.status) || "DRAFT"},${text(row.currency) || "INR"},${text(row.notes) || null},${actor.id})`);
          const installment = number(row.installmentnumber) || 1;
          const amount = number(row.amount);
          if (amount <= 0) throw new AppError("Fee structure amount must be greater than zero", 400);
          const item = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`SELECT "id" FROM "fee_structure_items" WHERE "feeStructureId" = ${structureId} AND "feeHeadId" = ${feeHead[0].id} AND "installmentNumber" = ${installment} LIMIT 1`);
          if (item[0]) await tx.$executeRaw(Prisma.sql`UPDATE "fee_structure_items" SET "amount" = ${amount}, "dueDays" = ${text(row.duedays) ? number(row.duedays) : null}, "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = ${item[0].id}`);
          else await tx.$executeRaw(Prisma.sql`INSERT INTO "fee_structure_items" ("id","feeStructureId","feeHeadId","amount","dueDays","installmentNumber") VALUES (${crypto.randomUUID()},${structureId},${feeHead[0].id},${amount},${text(row.duedays) ? number(row.duedays) : null},${installment})`);
        } else if (type === "fee-payments") {
          const invoiceId = text(row.invoiceid);
          if (!invoiceId) throw new AppError("invoiceId is required for fee-payments import", 400);
          const invoice = await tx.feeInvoice.findFirst({ where: { id: invoiceId, institutionId } });
          if (!invoice) throw new AppError(`Invoice not found: ${invoiceId}`, 400);
          const amount = number(row.amount);
          if (amount <= 0) throw new AppError("Payment amount must be greater than zero", 400);
          const paid = (await tx.feePayment.aggregate({ where: { invoiceId }, _sum: { amount: true } }))._sum.amount || 0;
          if (paid + amount > invoice.amount) throw new AppError("Payment would exceed invoice balance", 400);
          await tx.feePayment.create({ data: { institutionId, invoiceId, amount, reference: text(row.reference) || null, paidAt: text(row.paidat) ? date(row.paidat) : undefined } });
          const totalPaid = paid + amount;
          await tx.feeInvoice.update({ where: { id: invoice.id }, data: { status: totalPaid >= invoice.amount ? "PAID" : "PARTIAL" } });
        } else if (type === "notices") {
          await tx.notice.create({ data: { institutionId, title: text(row.title), body: text(row.body), audience: text(row.audience) || "ALL", publishedAt: text(row.publishedat) ? date(row.publishedat) : new Date(), expiresAt: text(row.expiresat) ? date(row.expiresat) : null, createdById: actor.id } });
        } else if (type === "timetable") {
          const offering = await resolveOffering(tx, institutionId, row);
          await tx.timetableEntry.upsert({ where: { courseOfferingId_dayOfWeek_startTime: { courseOfferingId: offering.id, dayOfWeek: number(row.dayofweek), startTime: text(row.starttime) } }, update: { endTime: text(row.endtime), room: text(row.room) || null }, create: { institutionId, courseOfferingId: offering.id, dayOfWeek: number(row.dayofweek), startTime: text(row.starttime), endTime: text(row.endtime), room: text(row.room) || null } });
        }
        imported++;
      } catch (e) {
        errors.push({ row: i + 2, message: e instanceof Error ? e.message : "Unknown row error" });
      }
    }
    if (errors.length) throw new AppError(`Import stopped because ${errors.length} row(s) failed. Fix the spreadsheet and retry. First error: ${errors[0].message}`, 400);
  }, { timeout: 120000 });
  return { imported, failed: errors.length };
}
