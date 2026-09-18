import * as XLSX from "xlsx";
import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";
import { AuthenticatedUser } from "../types/auth";

export const EXPORT_TYPES = [
  "students",
  "faculty",
  "departments",
  "programs",
  "academic-years",
  "semesters",
  "sections",
  "courses",
  "course-offerings",
  "exams",
  "marks",
  "attendance",
  "fees",
  "fee-payments",
  "fee-structures",
  "notices",
  "timetable",
  "parent-links",
  "users",
] as const;

export type ExportType = typeof EXPORT_TYPES[number];
export type ExportFormat = "xlsx" | "csv";

type Row = Record<string, string | number | boolean | null>;

function assertExportAccess(actor: AuthenticatedUser) {
  if (
    actor.roles.includes("SUPER_ADMIN") ||
    actor.permissions.includes("imports.manage") ||
    actor.permissions.includes("reports.read")
  ) return;
  throw new AppError("Export permission required", 403);
}

function clean(value: unknown): string | number | boolean | null {
  if (value === undefined || value === null) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  return String(value);
}

function makeFile(rows: Row[], type: ExportType, format: ExportFormat) {
  const sheet = XLSX.utils.json_to_sheet(rows.length ? rows : [{}]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Data");
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: format === "csv" ? "csv" : "xlsx" });
  return {
    buffer: Buffer.from(buffer),
    contentType: format === "csv"
      ? "text/csv; charset=utf-8"
      : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    filename: `acadlyx-${type}-${new Date().toISOString().slice(0, 10)}.${format}`,
  };
}

export async function exportData(
  institutionId: string,
  actor: AuthenticatedUser,
  type: ExportType,
  format: ExportFormat,
) {
  assertExportAccess(actor);
  if (!EXPORT_TYPES.includes(type)) throw new AppError(`Unsupported export type: ${type}`, 400);
  if (!['xlsx', 'csv'].includes(format)) throw new AppError("Format must be xlsx or csv", 400);

  const rows: Row[] = [];

  if (type === "users") {
    const users = await prisma.user.findMany({
      where: { institutionId },
      include: { userRoles: { include: { role: true } } },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    });
    for (const u of users) rows.push({ id: u.id, email: u.email, firstName: u.firstName, lastName: u.lastName, phone: u.phone, active: u.isActive, roles: u.userRoles.map(r => r.role.name).join(", "), createdAt: clean(u.createdAt) });
  }

  if (type === "students") {
    const students = await prisma.user.findMany({
      where: { institutionId, userRoles: { some: { role: { name: "STUDENT" } } } },
      include: { profile: true, studentEnrollments: { include: { program: true, academicYear: true, section: { include: { semester: true } } }, orderBy: { academicYear: { startDate: "desc" } }, take: 1 } },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    });
    for (const s of students) {
      const e = s.studentEnrollments[0];
      rows.push({ id: s.id, email: s.email, firstName: s.firstName, lastName: s.lastName, phone: s.phone, admissionNumber: s.profile?.admissionNumber ?? null, dateOfBirth: clean(s.profile?.dateOfBirth), gender: s.profile?.gender ?? null, guardianName: s.profile?.guardianName ?? null, guardianPhone: s.profile?.guardianPhone ?? null, programCode: e?.program.code ?? null, program: e?.program.name ?? null, academicYear: e?.academicYear.name ?? null, semester: e?.section?.semester.name ?? null, section: e?.section?.name ?? null, rollNumber: e?.rollNumber ?? null, status: e?.status ?? s.profile?.status ?? "ACTIVE" });
    }
  }

  if (type === "faculty") {
    const faculty = await prisma.user.findMany({ where: { institutionId, userRoles: { some: { role: { name: "FACULTY" } } } }, include: { facultyCourseOfferings: { include: { course: true, section: true } } }, orderBy: [{ firstName: "asc" }, { lastName: "asc" }] });
    for (const f of faculty) rows.push({ id: f.id, email: f.email, firstName: f.firstName, lastName: f.lastName, phone: f.phone, active: f.isActive, assignedOfferings: f.facultyCourseOfferings.length });
  }

  if (type === "departments") {
    const data = await prisma.department.findMany({ where: { institutionId }, orderBy: { name: "asc" } });
    for (const d of data) rows.push({ id: d.id, code: d.code, name: d.name, active: d.isActive, createdAt: clean(d.createdAt) });
  }

  if (type === "programs") {
    const data = await prisma.program.findMany({ where: { institutionId }, include: { department: true }, orderBy: { name: "asc" } });
    for (const p of data) rows.push({ id: p.id, code: p.code, name: p.name, departmentCode: p.department.code, department: p.department.name, level: p.level, durationYears: p.durationYears, active: p.isActive });
  }

  if (type === "academic-years") {
    const data = await prisma.academicYear.findMany({ where: { institutionId }, orderBy: { startDate: "desc" } });
    for (const y of data) rows.push({ id: y.id, name: y.name, startDate: clean(y.startDate), endDate: clean(y.endDate), isCurrent: y.isCurrent });
  }

  if (type === "semesters") {
    const data = await prisma.semester.findMany({ where: { institutionId }, include: { program: true, academicYear: true }, orderBy: [{ academicYear: { startDate: "desc" } }, { number: "asc" }] });
    for (const s of data) rows.push({ id: s.id, name: s.name, number: s.number, programCode: s.program.code, academicYear: s.academicYear.name, startDate: clean(s.startDate), endDate: clean(s.endDate), active: s.isActive });
  }

  if (type === "sections") {
    const data = await prisma.section.findMany({ where: { institutionId }, include: { semester: { include: { program: true, academicYear: true } } }, orderBy: { name: "asc" } });
    for (const s of data) rows.push({ id: s.id, name: s.name, capacity: s.capacity, active: s.isActive, programCode: s.semester.program.code, academicYear: s.semester.academicYear.name, semesterNumber: s.semester.number });
  }

  if (type === "courses") {
    const data = await prisma.course.findMany({ where: { institutionId }, include: { department: true }, orderBy: { code: "asc" } });
    for (const c of data) rows.push({ id: c.id, code: c.code, name: c.name, departmentCode: c.department.code, credits: c.credits, description: c.description, active: c.isActive });
  }

  if (type === "course-offerings") {
    const data = await prisma.courseOffering.findMany({ where: { institutionId }, include: { course: true, semester: { include: { program: true, academicYear: true } }, section: true, faculty: true }, orderBy: { createdAt: "desc" } });
    for (const o of data) rows.push({ id: o.id, courseCode: o.course.code, course: o.course.name, programCode: o.semester.program.code, academicYear: o.semester.academicYear.name, semester: o.semester.name, section: o.section.name, facultyEmail: o.faculty?.email ?? null, active: o.isActive });
  }

  if (type === "exams") {
    const data = await prisma.exam.findMany({ where: { institutionId }, include: { courseOffering: { include: { course: true, section: true } }, results: { include: { student: { include: { profile: true } } } } }, orderBy: { examDate: "desc" } });
    for (const e of data) {
      if (!e.results.length) rows.push({ id: e.id, courseCode: e.courseOffering.course.code, section: e.courseOffering.section.name, title: e.title, examDate: clean(e.examDate), maxMarks: e.maxMarks, studentEmail: null, admissionNumber: null, marks: null, remarks: null });
      for (const r of e.results) rows.push({ id: e.id, courseCode: e.courseOffering.course.code, section: e.courseOffering.section.name, title: e.title, examDate: clean(e.examDate), maxMarks: e.maxMarks, studentEmail: r.student.email, admissionNumber: r.student.profile?.admissionNumber ?? null, marks: r.marks, remarks: r.remarks });
    }
  }

  if (type === "marks") {
    const data = await prisma.internalMark.findMany({ where: { institutionId }, include: { student: { include: { profile: true } }, courseOffering: { include: { course: true, section: true } } }, orderBy: { updatedAt: "desc" } });
    for (const m of data) rows.push({ id: m.id, studentEmail: m.student.email, admissionNumber: m.student.profile?.admissionNumber ?? null, courseCode: m.courseOffering.course.code, section: m.courseOffering.section.name, component: m.component, marksObtained: m.marksObtained, maxMarks: m.maxMarks, updatedAt: clean(m.updatedAt) });
  }

  if (type === "attendance") {
    const data = await prisma.attendanceRecord.findMany({ where: { attendanceSession: { institutionId } }, include: { student: { include: { profile: true } }, attendanceSession: { include: { courseOffering: { include: { course: true, section: true } } } } }, orderBy: { attendanceSession: { sessionDate: "desc" } } });
    for (const a of data) rows.push({ id: a.id, studentEmail: a.student.email, admissionNumber: a.student.profile?.admissionNumber ?? null, courseCode: a.attendanceSession.courseOffering.course.code, section: a.attendanceSession.courseOffering.section.name, date: clean(a.attendanceSession.sessionDate), status: a.status });
  }

  if (type === "fee-structures") {
    const data = await prisma.$queryRaw<Array<any>>`SELECT fs."id", fs."name", fs."status", fs."currency", fs."notes", fs."academicYearId", fs."programId", fs."semesterId", fh."code" AS "feeHeadCode", fh."name" AS "feeHeadName", fsi."amount", fsi."dueDays", fsi."installmentNumber" FROM "fee_structures" fs JOIN "fee_structure_items" fsi ON fsi."feeStructureId" = fs."id" JOIN "fee_heads" fh ON fh."id" = fsi."feeHeadId" WHERE fs."institutionId" = ${institutionId} ORDER BY fs."name", fsi."installmentNumber", fh."code"`;
    for (const r of data) rows.push({ id: r.id, name: r.name, status: r.status, currency: r.currency, notes: r.notes, academicYearId: r.academicYearId, programId: r.programId, semesterId: r.semesterId, feeHeadCode: r.feeHeadCode, feeHeadName: r.feeHeadName, amount: r.amount, dueDays: r.dueDays, installmentNumber: r.installmentNumber });
  }

  if (type === "fees" || type === "fee-payments") {
    const data = await prisma.feeInvoice.findMany({ where: { institutionId }, include: { student: { include: { profile: true } }, payments: true }, orderBy: { createdAt: "desc" } });
    for (const i of data) {
      if (type === "fees") rows.push({ id: i.id, studentEmail: i.student.email, admissionNumber: i.student.profile?.admissionNumber ?? null, title: i.title, amount: i.amount, paid: i.payments.reduce((sum, p) => sum + p.amount, 0), balance: Math.max(0, i.amount - i.payments.reduce((sum, p) => sum + p.amount, 0)), status: i.status, dueDate: clean(i.dueDate), createdAt: clean(i.createdAt) });
      else for (const p of i.payments) rows.push({ id: p.id, invoiceId: i.id, studentEmail: i.student.email, admissionNumber: i.student.profile?.admissionNumber ?? null, invoiceTitle: i.title, amount: p.amount, reference: p.reference, paidAt: clean(p.paidAt), createdAt: clean(p.createdAt) });
    }
  }

  if (type === "notices") {
    const data = await prisma.notice.findMany({ where: { institutionId }, orderBy: { publishedAt: "desc" } });
    for (const n of data) rows.push({ id: n.id, title: n.title, body: n.body, audience: n.audience, departmentId: n.departmentId, publishedAt: clean(n.publishedAt), expiresAt: clean(n.expiresAt) });
  }

  if (type === "timetable") {
    const data = await prisma.timetableEntry.findMany({ where: { institutionId }, include: { courseOffering: { include: { course: true, section: true, faculty: true } } }, orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }] });
    for (const t of data) rows.push({ id: t.id, courseCode: t.courseOffering.course.code, course: t.courseOffering.course.name, section: t.courseOffering.section.name, facultyEmail: t.courseOffering.faculty?.email ?? null, dayOfWeek: t.dayOfWeek, startTime: t.startTime, endTime: t.endTime, room: t.room });
  }

  if (type === "parent-links") {
    const data = await prisma.parentStudentLink.findMany({ where: { institutionId }, include: { parent: true, student: { include: { profile: true } } }, orderBy: { createdAt: "desc" } });
    for (const l of data) rows.push({ parentEmail: l.parent.email, parentName: `${l.parent.firstName} ${l.parent.lastName}`.trim(), studentEmail: l.student.email, admissionNumber: l.student.profile?.admissionNumber ?? null, studentName: `${l.student.firstName} ${l.student.lastName}`.trim(), relationship: l.relationship, createdAt: clean(l.createdAt) });
  }

  return makeFile(rows, type, format);
}
