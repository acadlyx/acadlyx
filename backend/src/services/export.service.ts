import * as XLSX from "xlsx";
import type { Prisma } from "@prisma/client";
import { getCanonicalRoleNames } from "../config/rbac";
import { createCsv, createDocx, createPdf } from "./exportDocuments.service";
import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";
import { AuthenticatedUser } from "../types/auth";
import {
  getAuthorizedDepartmentIds,
  getDirectorCampusIds,
  getStudentWhereScope,
  INSTITUTION_WIDE_ROLES,
} from "./accessScope.service";

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
  "campuses",
  "paid-fees",
  "outstanding-dues",
] as const;

export type ExportType = typeof EXPORT_TYPES[number];
export type ExportFormat = "xlsx" | "csv" | "docx" | "pdf" | "json";

type Row = Record<string, string | number | boolean | null>;

const EXPORT_PERMISSION_BY_TYPE: Record<ExportType, string> = {
  users: "users.read",
  students: "students.read",
  faculty: "users.read",
  departments: "departments.read",
  programs: "programs.read",
  "academic-years": "academic-years.read",
  semesters: "semesters.read",
  sections: "sections.read",
  courses: "courses.read",
  "course-offerings": "course-offerings.read",
  exams: "exams.read",
  marks: "marks.read",
  attendance: "attendance.read",
  fees: "fees.read",
  "fee-payments": "fees.read",
  "fee-structures": "fees.read",
  notices: "notices.read",
  timetable: "timetable.read",
  "parent-links": "parent-links.read",
  campuses: "campuses.read",
  "paid-fees": "fees.read",
  "outstanding-dues": "fees.read",
};

export interface ExportRequestOptions {
  selection?: "all-filtered" | "current-page" | "selected";
  ids?: string[];
  page?: number;
  pageSize?: number;
  filters?: Record<string, string>;
}

interface ExportActorScope {
  institutionWide: boolean;
  roles: Set<string>;
  departmentIds: string[];
  campusIds: string[];
  studentWhere: Prisma.UserWhereInput;
}

const SCOPED_EXPORT_TYPES = new Set<ExportType>([
  "students", "faculty", "departments", "programs", "academic-years",
  "semesters", "sections", "courses", "course-offerings", "exams",
  "marks", "notices", "timetable", "parent-links",
]);
const FINANCE_EXPORT_TYPES = new Set<ExportType>([
  "fees", "fee-payments", "fee-structures", "paid-fees", "outstanding-dues",
]);

async function assertExportAccess(
  institutionId: string,
  actor: AuthenticatedUser,
  type: ExportType,
): Promise<ExportActorScope> {
  const roles = new Set<string>(getCanonicalRoleNames(actor.roles));
  const permission = EXPORT_PERMISSION_BY_TYPE[type];
  if (!permission || !actor.permissions.includes(permission)) {
    throw new AppError("You do not have permission to export this dataset", 403);
  }
  const institutionWide = INSTITUTION_WIDE_ROLES.some((role) => roles.has(role));
  if (institutionWide) {
    return { institutionWide: true, roles, departmentIds: [], campusIds: [], studentWhere: {} };
  }
  const scopedAcademicRole = ["DIRECTOR", "DEAN", "HOD", "FACULTY"].some((role) => roles.has(role));
  if (!scopedAcademicRole) {
    throw new AppError("Export is not available for this role", 403);
  }
  if (FINANCE_EXPORT_TYPES.has(type) || type === "users") {
    throw new AppError("This export requires institution-wide finance or user-directory authority", 403);
  }
  if (type === "campuses" && !roles.has("DIRECTOR")) {
    throw new AppError("Campus export requires an assigned Director campus scope", 403);
  }
  if (!SCOPED_EXPORT_TYPES.has(type) && type !== "campuses") {
    throw new AppError("This dataset does not support scoped export for this role", 403);
  }
  const departmentIds = await getAuthorizedDepartmentIds(institutionId, actor);
  const campusIds = roles.has("DIRECTOR")
    ? await getDirectorCampusIds(institutionId, actor.id)
    : [];
  const studentWhere = type === "students" || type === "parent-links"
    ? await getStudentWhereScope(institutionId, actor)
    : {};
  return { institutionWide: false, roles, departmentIds, campusIds, studentWhere };
}

function clean(value: unknown): string | number | boolean | null {
  if (value === undefined || value === null) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  return String(value);
}

export function makeFile(rows: Row[], type: ExportType, format: ExportFormat) {
  const date = new Date().toISOString().slice(0, 10);
  if (format === "json") {
    const buffer = Buffer.from(JSON.stringify(rows, null, 2), "utf8");
    return { buffer, rowCount: rows.length, contentType: "application/json; charset=utf-8", filename: "acadlyx-" + type + "-" + date + ".json" };
  }
  if (format === "csv") {
    const buffer = createCsv(rows);
    return { buffer, rowCount: rows.length, contentType: "text/csv; charset=utf-8", filename: "acadlyx-" + type + "-" + date + ".csv" };
  }
  if (format === "docx") {
    const buffer = createDocx(rows, type);
    return { buffer, rowCount: rows.length, contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", filename: "acadlyx-" + type + "-" + date + ".docx" };
  }
  if (format === "pdf") {
    const buffer = createPdf(rows, type);
    return { buffer, rowCount: rows.length, contentType: "application/pdf", filename: "acadlyx-" + type + "-" + date + ".pdf" };
  }

  const workbook = XLSX.utils.book_new();

  if (rows.length > 0) {
    const sheet = XLSX.utils.json_to_sheet(rows);
    const ref = sheet["!ref"] || "A1";
    sheet["!autofilter"] = { ref };
    sheet["!freeze"] = { xSplit: 0, ySplit: 1 };
    const headers = Object.keys(rows[0] || {});
    sheet["!cols"] = headers.map((header) => ({
      wch: Math.min(42, Math.max(12, header.length + 3)),
    }));
    XLSX.utils.book_append_sheet(workbook, sheet, "Data");
  } else {
    const sheet = XLSX.utils.aoa_to_sheet([
      ["ACADLYX Export"],
      ["No records matched the selected filters."],
    ]);
    XLSX.utils.book_append_sheet(workbook, sheet, "Data");
  }

  const output = XLSX.write(workbook, {
    type: "buffer",
    bookType: "xlsx",
    compression: true,
  });
  const buffer = Buffer.from(output);

  if (!buffer.length) {
    throw new AppError("Export generation produced an empty file.", 500);
  }

  return {
    buffer,
    rowCount: rows.length,
    contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    filename: "acadlyx-" + type + "-" + date + ".xlsx",
  };
}

const EXPORT_BATCH_SIZE = 2000;

/**
 * Export endpoints intentionally return all matching rows, but database reads
 * are performed in bounded pages so a large tenant never requires Prisma to
 * materialize the entire export dataset in one query.
 */
async function collectInBatches<T>(
  fetchPage: (skip: number, take: number) => Promise<T[]>,
): Promise<T[]> {
  const all: T[] = [];
  let skip = 0;

  while (true) {
    const page = await fetchPage(skip, EXPORT_BATCH_SIZE);
    all.push(...page);

    if (page.length < EXPORT_BATCH_SIZE) break;
    skip += page.length;
  }

  return all;
}

const EXPORT_FILTER_FIELDS: Record<ExportType, readonly string[]> = {
  users: ["search", "active", "roles"],
  students: ["search", "programCode", "program", "academicYear", "semester", "section", "status"],
  faculty: ["search", "active"],
  departments: ["search", "active", "campusId"],
  programs: ["search", "departmentCode", "level", "active"],
  "academic-years": ["search", "isCurrent", "startDate", "endDate"],
  semesters: ["search", "programCode", "academicYear", "number"],
  sections: ["search", "programCode", "academicYear", "semesterNumber", "active"],
  courses: ["search", "departmentCode", "active"],
  "course-offerings": ["search", "courseCode", "programCode", "academicYear", "semester", "section", "facultyEmail", "active"],
  exams: ["search", "courseCode", "section", "dateFrom", "dateTo"],
  marks: ["search", "studentEmail", "admissionNumber", "courseCode", "section", "component", "dateFrom", "dateTo"],
  attendance: ["search", "studentEmail", "admissionNumber", "courseCode", "section", "status", "dateFrom", "dateTo"],
  fees: ["search", "status", "sourceModule", "sourceType", "dateFrom", "dateTo"],
  "fee-payments": ["search", "reference", "invoiceTitle", "dateFrom", "dateTo"],
  "fee-structures": ["search", "name", "status", "currency"],
  notices: ["search", "audience", "departmentId", "dateFrom", "dateTo"],
  timetable: ["search", "courseCode", "course", "section", "facultyEmail", "dayOfWeek"],
  "parent-links": ["search", "parentEmail", "studentEmail", "relationship", "dateFrom", "dateTo"],
  campuses: ["search", "active"],
  "paid-fees": ["search", "status", "sourceModule", "sourceType", "dateFrom", "dateTo"],
  "outstanding-dues": ["search", "status", "sourceModule", "sourceType", "dateFrom", "dateTo"],
};

const EXPORT_DATE_FIELD: Partial<Record<ExportType, string>> = {
  users: "createdAt",
  campuses: "createdAt",
  departments: "createdAt",
  "academic-years": "startDate",
  exams: "examDate",
  marks: "updatedAt",
  attendance: "date",
  fees: "dueDate",
  "fee-payments": "paidAt",
  notices: "publishedAt",
  "parent-links": "createdAt",
  "paid-fees": "dueDate",
  "outstanding-dues": "dueDate",
};

function applyExportOptions(rows: Row[], type: ExportType, options: ExportRequestOptions): Row[] {
  const selection = options.selection ?? "all-filtered";
  if (!["all-filtered", "current-page", "selected"].includes(selection)) {
    throw new AppError("Selection must be all-filtered, current-page, or selected", 400);
  }

  const filters = options.filters ?? {};
  const allowedFields = EXPORT_FILTER_FIELDS[type];
  for (const [key, value] of Object.entries(filters)) {
    if (!allowedFields.includes(key)) throw new AppError("Unsupported " + type + " export filter: " + key, 400);
    if (typeof value !== "string" || value.length > 200) throw new AppError("Export filter values must be text with at most 200 characters", 400);
  }
  if ((filters.dateFrom || filters.dateTo) && !EXPORT_DATE_FIELD[type]) {
    throw new AppError("Date filtering is not supported for this export", 400);
  }
  for (const key of ["dateFrom", "dateTo"]) {
    if (filters[key] && !Number.isFinite(Date.parse(filters[key]))) {
      throw new AppError("Invalid export date filter: " + key, 400);
    }
  }

  const dateField = EXPORT_DATE_FIELD[type];
  const filtered = rows.filter((row) => {
    for (const [key, expected] of Object.entries(filters)) {
      if (key === "search") {
        const haystack = Object.values(row).map((value) => String(value ?? "")).join(" ").toLocaleLowerCase();
        if (!haystack.includes(expected.toLocaleLowerCase())) return false;
      } else if (key === "dateFrom" || key === "dateTo") {
        const value = row[dateField!];
        if (value === null || value === undefined) return false;
        const actual = Date.parse(String(value));
        const target = Date.parse(expected);
        if (!Number.isFinite(actual)) return false;
        if (key === "dateFrom" && actual < target) return false;
        if (key === "dateTo" && actual > target) return false;
      } else {
        const actualKey = Object.keys(row).find((candidate) => candidate.toLowerCase() === key.toLowerCase());
        if (!actualKey || String(row[actualKey] ?? "").toLocaleLowerCase() !== expected.toLocaleLowerCase()) return false;
      }
    }
    return true;
  });

  if (selection === "selected") {
    const ids = [...new Set(options.ids ?? [])].filter((id) => typeof id === "string" && id.length > 0 && id.length <= 128);
    if (ids.length === 0) throw new AppError("Choose at least one row to export", 400);
    if (ids.length > 500) throw new AppError("A selected-row export is limited to 500 selected IDs per request", 400);
    const selected = new Set(ids);
    return filtered.filter((row) => row.id !== null && row.id !== undefined && selected.has(String(row.id)));
  }
  if (options.ids?.length) throw new AppError("Row IDs are only accepted for selected-row exports", 400);
  if (selection === "current-page") {
    const page = options.page ?? 1;
    const pageSize = options.pageSize ?? 25;
    if (!Number.isSafeInteger(page) || page < 1) throw new AppError("Page must be a positive integer", 400);
    if (!Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 1000) throw new AppError("Page size must be between 1 and 1000", 400);
    return filtered.slice((page - 1) * pageSize, page * pageSize);
  }
  return filtered;
}

export async function exportData(
  institutionId: string,
  actor: AuthenticatedUser,
  type: ExportType,
  format: ExportFormat,
  options: ExportRequestOptions = {},
) {
  if (!EXPORT_TYPES.includes(type)) throw new AppError("Unsupported export type: " + type, 400);
  if (!["xlsx", "csv", "docx", "pdf", "json"].includes(format)) throw new AppError("Format must be xlsx, csv, docx, pdf, or json", 400);
  const scope = await assertExportAccess(institutionId, actor, type);
  const noScopeSentinel = "__NO_AUTHORIZED_SCOPE__";
  const scopedDepartmentFilter = { in: scope.departmentIds.length ? scope.departmentIds : [noScopeSentinel] };
  const rows: Row[] = [];

  if (type === "users") {
    const users = await collectInBatches((skip, take) => prisma.user.findMany({ skip, take,
      where: { institutionId },
      include: { userRoles: { include: { role: true } } },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
     }));
    for (const u of users) rows.push({ id: u.id, email: u.email, firstName: u.firstName, lastName: u.lastName, phone: u.phone, active: u.isActive, roles: u.userRoles.map(r => r.role.name).join(", "), createdAt: clean(u.createdAt) });
  }

  if (type === "students") {
    const students = await collectInBatches((skip, take) => prisma.user.findMany({ skip, take,
      where: { institutionId, userRoles: { some: { role: { name: "STUDENT" } } }, ...(scope.institutionWide ? {} : { AND: [scope.studentWhere] }) },
      include: { profile: true, studentEnrollments: { include: { program: true, academicYear: true, section: { include: { semester: true } } }, orderBy: { academicYear: { startDate: "desc" } }, take: 1 } },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
     }));
    for (const s of students) {
      const e = s.studentEnrollments[0];
      rows.push({ id: s.id, email: s.email, firstName: s.firstName, lastName: s.lastName, phone: s.phone, admissionNumber: s.profile?.admissionNumber ?? null, dateOfBirth: clean(s.profile?.dateOfBirth), gender: s.profile?.gender ?? null, guardianName: s.profile?.guardianName ?? null, guardianPhone: s.profile?.guardianPhone ?? null, programCode: e?.program.code ?? null, program: e?.program.name ?? null, academicYear: e?.academicYear.name ?? null, semester: e?.section?.semester.name ?? null, section: e?.section?.name ?? null, rollNumber: e?.rollNumber ?? null, status: e?.status ?? s.profile?.status ?? "ACTIVE" });
    }
  }

  if (type === "faculty") {
    const faculty = await collectInBatches((skip, take) => prisma.user.findMany({ skip, take, where: {
      institutionId,
      userRoles: { some: { role: { name: "FACULTY" } } },
      ...(scope.institutionWide ? {} : scope.roles.has("FACULTY")
        ? { id: actor.id }
        : { OR: [
            { facultyCourseOfferings: { some: { course: { departmentId: scopedDepartmentFilter } } } },
            { employeeProfile: { departmentId: scopedDepartmentFilter } },
          ] }),
    }, include: { facultyCourseOfferings: { include: { course: true, section: true } } }, orderBy: [{ firstName: "asc" }, { lastName: "asc" }]  }));
    for (const f of faculty) rows.push({ id: f.id, email: f.email, firstName: f.firstName, lastName: f.lastName, phone: f.phone, active: f.isActive, assignedOfferings: f.facultyCourseOfferings.length });
  }

  if (type === "campuses") {
    const campuses = await collectInBatches((skip, take) => prisma.campus.findMany({
      skip, take, where: { institutionId, ...(scope.institutionWide ? {} : { id: { in: scope.campusIds.length ? scope.campusIds : [noScopeSentinel] } }) }, orderBy: { name: "asc" },
    }));
    for (const c of campuses) rows.push({
      id: c.id, code: c.code, name: c.name, address: c.address,
      active: c.isActive, createdAt: clean(c.createdAt),
    });
  }

  if (type === "departments") {
    const data = await collectInBatches((skip, take) => prisma.department.findMany({ skip, take, where: { institutionId, ...(scope.institutionWide ? {} : { id: { in: scope.departmentIds } }) }, orderBy: { name: "asc" }  }));
    for (const d of data) rows.push({ id: d.id, code: d.code, name: d.name, campusId: d.campusId, active: d.isActive, createdAt: clean(d.createdAt) });
  }

  if (type === "programs") {
    const data = await collectInBatches((skip, take) => prisma.program.findMany({ skip, take, where: { institutionId, ...(scope.institutionWide ? {} : { departmentId: scopedDepartmentFilter }) }, include: { department: true }, orderBy: { name: "asc" }  }));
    for (const p of data) rows.push({ id: p.id, code: p.code, name: p.name, departmentCode: p.department.code, department: p.department.name, level: p.level, durationYears: p.durationYears, active: p.isActive });
  }

  if (type === "academic-years") {
    const data = await collectInBatches((skip, take) => prisma.academicYear.findMany({ skip, take, where: { institutionId }, orderBy: { startDate: "desc" }  }));
    for (const y of data) rows.push({ id: y.id, name: y.name, startDate: clean(y.startDate), endDate: clean(y.endDate), isCurrent: y.isCurrent });
  }

  if (type === "semesters") {
    const data = await collectInBatches((skip, take) => prisma.semester.findMany({ skip, take, where: { institutionId, ...(scope.institutionWide ? {} : { program: { departmentId: scopedDepartmentFilter } }) }, include: { program: true, academicYear: true }, orderBy: [{ academicYear: { startDate: "desc" } }, { number: "asc" }]  }));
    for (const s of data) rows.push({ id: s.id, name: s.name, number: s.number, programCode: s.program.code, academicYear: s.academicYear.name, startDate: clean(s.startDate), endDate: clean(s.endDate), active: s.isActive });
  }

  if (type === "sections") {
    const data = await collectInBatches((skip, take) => prisma.section.findMany({ skip, take, where: { institutionId, ...(scope.institutionWide ? {} : { semester: { program: { departmentId: scopedDepartmentFilter } } }) }, include: { semester: { include: { program: true, academicYear: true } } }, orderBy: { name: "asc" }  }));
    for (const s of data) rows.push({ id: s.id, name: s.name, capacity: s.capacity, active: s.isActive, programCode: s.semester.program.code, academicYear: s.semester.academicYear.name, semesterNumber: s.semester.number });
  }

  if (type === "courses") {
    const data = await collectInBatches((skip, take) => prisma.course.findMany({ skip, take, where: { institutionId, ...(scope.institutionWide ? {} : { departmentId: scopedDepartmentFilter }) }, include: { department: true }, orderBy: { code: "asc" }  }));
    for (const c of data) rows.push({ id: c.id, code: c.code, name: c.name, departmentCode: c.department.code, credits: c.credits, description: c.description, active: c.isActive });
  }

  if (type === "course-offerings") {
    const data = await collectInBatches((skip, take) => prisma.courseOffering.findMany({ skip, take, where: { institutionId, ...(scope.institutionWide ? {} : { semester: { program: { departmentId: scopedDepartmentFilter } }, ...(scope.roles.has("FACULTY") ? { facultyId: actor.id } : {}) }) }, include: { course: true, semester: { include: { program: true, academicYear: true } }, section: true, faculty: true }, orderBy: { createdAt: "desc" }  }));
    for (const o of data) rows.push({ id: o.id, courseCode: o.course.code, course: o.course.name, programCode: o.semester.program.code, academicYear: o.semester.academicYear.name, semester: o.semester.name, section: o.section.name, facultyEmail: o.faculty?.email ?? null, active: o.isActive });
  }

  if (type === "exams") {
    const data = await collectInBatches((skip, take) => prisma.exam.findMany({ skip, take, where: { institutionId, ...(scope.institutionWide ? {} : { courseOffering: { semester: { program: { departmentId: scopedDepartmentFilter } }, ...(scope.roles.has("FACULTY") ? { facultyId: actor.id } : {}) } }) }, include: { courseOffering: { include: { course: true, section: true } }, results: { include: { student: { include: { profile: true } } } } }, orderBy: { examDate: "desc" }  }));
    for (const e of data) {
      if (!e.results.length) rows.push({ id: e.id, courseCode: e.courseOffering.course.code, section: e.courseOffering.section.name, title: e.title, examDate: clean(e.examDate), maxMarks: e.maxMarks, studentEmail: null, admissionNumber: null, marks: null, remarks: null });
      for (const r of e.results) rows.push({ id: e.id, courseCode: e.courseOffering.course.code, section: e.courseOffering.section.name, title: e.title, examDate: clean(e.examDate), maxMarks: e.maxMarks, studentEmail: r.student.email, admissionNumber: r.student.profile?.admissionNumber ?? null, marks: r.marks, remarks: r.remarks });
    }
  }

  if (type === "marks") {
    const data = await collectInBatches((skip, take) => prisma.internalMark.findMany({ skip, take, where: { institutionId, ...(scope.institutionWide ? {} : { courseOffering: { semester: { program: { departmentId: scopedDepartmentFilter } }, ...(scope.roles.has("FACULTY") ? { facultyId: actor.id } : {}) } }) }, include: { student: { include: { profile: true } }, courseOffering: { include: { course: true, section: true } } }, orderBy: { updatedAt: "desc" }  }));
    for (const m of data) rows.push({ id: m.id, studentEmail: m.student.email, admissionNumber: m.student.profile?.admissionNumber ?? null, courseCode: m.courseOffering.course.code, section: m.courseOffering.section.name, component: m.component, marksObtained: m.marksObtained, maxMarks: m.maxMarks, updatedAt: clean(m.updatedAt) });
  }

  if (type === "attendance") {
    const data = await collectInBatches((skip, take) => prisma.attendanceRecord.findMany({ skip, take, where: { attendanceSession: { institutionId } }, include: { student: { include: { profile: true } }, attendanceSession: { include: { courseOffering: { include: { course: true, section: true } } } } }, orderBy: { attendanceSession: { sessionDate: "desc" } }  }));
    for (const a of data) rows.push({ id: a.id, studentEmail: a.student.email, admissionNumber: a.student.profile?.admissionNumber ?? null, courseCode: a.attendanceSession.courseOffering.course.code, section: a.attendanceSession.courseOffering.section.name, date: clean(a.attendanceSession.sessionDate), status: a.status });
  }

  if (type === "fee-structures") {
    const data = await prisma.$queryRaw<Array<any>>`SELECT fs."id", fs."name", fs."status", fs."currency", fs."notes", fs."academicYearId", fs."programId", fs."semesterId", fh."code" AS "feeHeadCode", fh."name" AS "feeHeadName", fsi."amount", fsi."dueDays", fsi."installmentNumber" FROM "fee_structures" fs JOIN "fee_structure_items" fsi ON fsi."feeStructureId" = fs."id" JOIN "fee_heads" fh ON fh."id" = fsi."feeHeadId" WHERE fs."institutionId" = ${institutionId} ORDER BY fs."name", fsi."installmentNumber", fh."code"`;
    for (const r of data) rows.push({ id: r.id, name: r.name, status: r.status, currency: r.currency, notes: r.notes, academicYearId: r.academicYearId, programId: r.programId, semesterId: r.semesterId, feeHeadCode: r.feeHeadCode, feeHeadName: r.feeHeadName, amount: r.amount, dueDays: r.dueDays, installmentNumber: r.installmentNumber });
  }

  if (type === "fees" || type === "fee-payments" || type === "paid-fees" || type === "outstanding-dues") {
    const data = await collectInBatches((skip, take) => prisma.feeInvoice.findMany({
      skip, take, where: { institutionId },
      include: { student: { include: { profile: true } }, payments: true },
      orderBy: { createdAt: "desc" },
    }));
    for (const i of data) {
      const paid = i.payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
      const amount = Number(i.amount);
      const balance = Math.max(0, amount - paid);
      if (type === "fees" || (type === "paid-fees" && paid > 0 && balance === 0) || (type === "outstanding-dues" && balance > 0)) {
        rows.push({
          id: i.id, studentEmail: i.student.email,
          admissionNumber: i.student.profile?.admissionNumber ?? null,
          title: i.title, amount, paid, balance, status: i.status,
          sourceModule: i.sourceModule ?? "FEES", sourceType: i.sourceType ?? "FEE",
          sourceEntityId: i.sourceEntityId ?? null, feeStructureId: i.feeStructureId ?? null,
          dueDate: clean(i.dueDate), createdAt: clean(i.createdAt),
        });
      }
      if (type === "fee-payments") {
        for (const p of i.payments) rows.push({
          id: p.id, invoiceId: i.id, studentEmail: i.student.email,
          admissionNumber: i.student.profile?.admissionNumber ?? null,
          invoiceTitle: i.title, amount: Number(p.amount), reference: p.reference,
          paidAt: clean(p.paidAt), createdAt: clean(p.createdAt),
        });
      }
    }
  }

  if (type === "notices") {
    const data = await collectInBatches((skip, take) => prisma.notice.findMany({ skip, take, where: { institutionId, ...(scope.institutionWide ? {} : { OR: [{ departmentId: null }, { departmentId: scopedDepartmentFilter }] }) }, orderBy: { publishedAt: "desc" }  }));
    for (const n of data) rows.push({ id: n.id, title: n.title, body: n.body, audience: n.audience, departmentId: n.departmentId, publishedAt: clean(n.publishedAt), expiresAt: clean(n.expiresAt) });
  }

  if (type === "timetable") {
    const data = await collectInBatches((skip, take) => prisma.timetableEntry.findMany({ skip, take, where: { institutionId, ...(scope.institutionWide ? {} : { courseOffering: { semester: { program: { departmentId: scopedDepartmentFilter } }, ...(scope.roles.has("FACULTY") ? { facultyId: actor.id } : {}) } }) }, include: { courseOffering: { include: { course: true, section: true, faculty: true } } }, orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }]  }));
    for (const t of data) rows.push({ id: t.id, courseCode: t.courseOffering.course.code, course: t.courseOffering.course.name, section: t.courseOffering.section.name, facultyEmail: t.courseOffering.faculty?.email ?? null, dayOfWeek: t.dayOfWeek, startTime: t.startTime, endTime: t.endTime, room: t.room });
  }

  if (type === "parent-links") {
    const data = await collectInBatches((skip, take) => prisma.parentStudentLink.findMany({ skip, take, where: { institutionId, ...(scope.institutionWide ? {} : { student: { AND: [scope.studentWhere] } }) }, include: { parent: true, student: { include: { profile: true } } }, orderBy: { createdAt: "desc" }  }));
    for (const l of data) rows.push({ id: l.id, parentEmail: l.parent.email, parentName: `${l.parent.firstName} ${l.parent.lastName}`.trim(), studentEmail: l.student.email, admissionNumber: l.student.profile?.admissionNumber ?? null, studentName: `${l.student.firstName} ${l.student.lastName}`.trim(), relationship: l.relationship, createdAt: clean(l.createdAt) });
  }

  const finalRows = applyExportOptions(rows, type, options);
  return makeFile(finalRows, type, format);
}
