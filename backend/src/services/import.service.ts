import * as XLSX from "xlsx";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";
import { AuthenticatedUser } from "../types/auth";
import { hashPassword } from "../utils/password";

export const IMPORT_TYPES = ["students", "faculty", "departments", "programs", "courses", "sections", "marks", "attendance", "fees", "notices", "timetable"] as const;
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

async function upsertUser(tx: Prisma.TransactionClient, institutionId: string, row: Row, roleName: "STUDENT" | "FACULTY") {
  const email = text(row.email).toLowerCase();
  if (!email) throw new AppError("Every user row needs an email", 400);
  const role = await findOrCreateRole(tx, institutionId, roleName);
  const existing = await tx.user.findUnique({ where: { email } });
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
        if (type === "students") {
          const user = await upsertUser(tx, institutionId, row, "STUDENT");
          const program = await resolveProgram(tx, institutionId, row);
          const yearName = text(row.academicyear) || "2026-2027";
          const year = await tx.academicYear.findFirst({ where: { institutionId, name: yearName } });
          if (!year) throw new AppError(`Academic year not found: ${yearName}`, 400);
          let sectionId: string | null = null;
          const sectionName = text(row.section);
          if (sectionName) {
            const section = await tx.section.findFirst({ where: { institutionId, name: sectionName, semester: { programId: program.id, academicYearId: year.id } } });
            if (!section) throw new AppError(`Section not found: ${sectionName}`, 400);
            sectionId = section.id;
          }
          await tx.studentEnrollment.upsert({ where: { userId_academicYearId: { userId: user.id, academicYearId: year.id } }, update: { programId: program.id, sectionId, rollNumber: text(row.rollnumber) || null, status: text(row.status) || "ACTIVE" }, create: { institutionId, userId: user.id, programId: program.id, academicYearId: year.id, sectionId, rollNumber: text(row.rollnumber) || null, status: text(row.status) || "ACTIVE" } });
        } else if (type === "faculty") {
          await upsertUser(tx, institutionId, row, "FACULTY");
        } else if (type === "departments") {
          await tx.department.upsert({ where: { institutionId_code: { institutionId, code: text(row.code) } }, update: { name: text(row.name), isActive: row.active === "" ? true : bool(row.active) }, create: { institutionId, code: text(row.code), name: text(row.name), isActive: row.active === "" ? true : bool(row.active) } });
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
