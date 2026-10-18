import * as XLSX from "xlsx";
import { Prisma } from "@prisma/client";
import { createCsv, createDocx, createPdf } from "./exportDocuments.service";
import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";
import { AuthenticatedUser } from "../types/auth";
import {
  getAuthorizedDepartmentIds,
  getDirectorCampusIds,
  isDirectorScoped,
  isInstitutionWide,
  isInstitutionWideFinance,
  getStudentWhereScope,
  getEffectiveWorkspaceRole,
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
  "fee-heads",
  "fee-receipts",
  "fee-transactions",
  "fee-refunds",
  "fee-concessions",
  "fee-audit",
  "assignments",
  "assignment-submissions",
  "library-books",
  "library-copies",
  "library-issues",
  "library-fines",
  "admission-applications",
  "employees",
  "leave-requests",
  "calendar-events",
  "institutional-events",
  "event-media",
  "placement-companies",
  "placement-drives",
  "placement-openings",
  "placement-applications",
  "placement-offers",
  "placement-visits",
  "placement-tests",
  "placement-interviews",
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
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
  "fee-heads": "fees.read",
  "fee-receipts": "fees.read",
  "fee-transactions": "fees.read",
  "fee-refunds": "fees.read",
  "fee-concessions": "fees.read",
  "fee-audit": "audit.read",
  assignments: "assignments.read",
  "assignment-submissions": "assignments.read",
  "library-books": "library.read",
  "library-copies": "library.read",
  "library-issues": "library.read",
  "library-fines": "library.read",
  "admission-applications": "admissions.read",
  employees: "hr.read",
  "leave-requests": "hr.read",
  "calendar-events": "calendar.read",
  "institutional-events": "events.read",
  "event-media": "events.read",
  "placement-companies": "placements.read",
  "placement-drives": "placements.read",
  "placement-openings": "placements.read",
  "placement-applications": "placements.read",
  "placement-offers": "placements.read",
  "placement-visits": "placements.read",
  "placement-tests": "placements.read",
  "placement-interviews": "placements.read",
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
  "marks", "attendance", "notices", "timetable", "parent-links", "assignments",
  "assignment-submissions",  
    
     
    
    
  
]);
const FINANCE_EXPORT_TYPES = new Set<ExportType>([
  "fees", "fee-payments", "fee-structures", "paid-fees", "outstanding-dues",
  "fee-heads", "fee-receipts", "fee-transactions", "fee-refunds", "fee-concessions", "fee-audit",
]);
const DIRECTOR_SCOPED_FINANCE_EXPORT_TYPES = new Set<ExportType>([
  "fees", "fee-payments", "fee-structures", "paid-fees", "outstanding-dues",
  "fee-receipts", "fee-transactions", "fee-refunds", "fee-concessions",
]);

const MODULE_EXPORT_ROLES: Partial<Record<ExportType, readonly string[]>> = {
  // Examination has institution-wide authority within the examination domain,
  // but not generic institution-wide access to student/user records.
  exams: ["EXAMINATION"],
  marks: ["EXAMINATION"],
  "library-books": ["LIBRARIAN"],
  "library-copies": ["LIBRARIAN"],
  "library-issues": ["LIBRARIAN"],
  "library-fines": ["LIBRARIAN"],
  "admission-applications": ["ADMISSIONS"],
  employees: ["HR"],
  "leave-requests": ["HR"],
  "calendar-events": ["INSTITUTION_ADMIN", "REGISTRAR", "DIRECTOR", "DEAN", "HOD", "FACULTY", "ADMISSIONS", "EXAMINATION", "HR", "LIBRARIAN", "PLACEMENT", "IT"],
  "institutional-events": ["INSTITUTION_ADMIN", "REGISTRAR", "DIRECTOR", "DEAN", "HOD", "PLACEMENT", "IT"],
  "event-media": ["INSTITUTION_ADMIN", "REGISTRAR", "DIRECTOR", "DEAN", "HOD", "PLACEMENT", "IT"],
  "placement-companies": ["PLACEMENT"],
  "placement-drives": ["PLACEMENT"],
  "placement-openings": ["PLACEMENT"],
  "placement-applications": ["PLACEMENT"],
  "placement-offers": ["PLACEMENT"],
  "placement-visits": ["PLACEMENT"],
  "placement-tests": ["PLACEMENT"],
  "placement-interviews": ["PLACEMENT"],
};

export async function assertExportAccess(
  institutionId: string,
  actor: AuthenticatedUser,
  type: ExportType,
): Promise<ExportActorScope> {
  const activeRole = getEffectiveWorkspaceRole(actor);
  // Scope-specific query branches consume only the active workspace role,
  // never the union of secondary bindings.
  const roles = new Set<string>([activeRole]);
  const permission = EXPORT_PERMISSION_BY_TYPE[type];
  const hasScopedFinanceExportPermission =
    activeRole === "DIRECTOR" &&
    DIRECTOR_SCOPED_FINANCE_EXPORT_TYPES.has(type) &&
    actor.permissions.includes("fees.reports.export");
  if (!permission || (!actor.permissions.includes(permission) && !hasScopedFinanceExportPermission)) {
    throw new AppError("You do not have permission to export this dataset", 403);
  }
  // Institution Admin deliberately does not own Fees, Assignments or Exams.
  // Do this before the generic institution-wide shortcut and before module
  // role checks so secondary Accounts/Examination bindings cannot unlock them.
  if (activeRole === "INSTITUTION_ADMIN" &&
      (FINANCE_EXPORT_TYPES.has(type) || ["assignments","assignment-submissions","exams","marks"].includes(type))) {
    throw new AppError("This export is not available in the Institution Admin workspace",403);
  }

  const institutionWide = isInstitutionWide(actor);
  if (FINANCE_EXPORT_TYPES.has(type)) {
    if (isInstitutionWideFinance(actor)) {
      return { institutionWide: true, roles, departmentIds: [], campusIds: [], studentWhere: {} };
    }
    if (!hasScopedFinanceExportPermission) {
      throw new AppError("This finance export requires Accounts or an explicitly scoped Director permission",403);
    }
  }
  if (institutionWide) {
    return { institutionWide: true, roles, departmentIds: [], campusIds: [], studentWhere: {} };
  }
  const moduleRoles = MODULE_EXPORT_ROLES[type];
  if (moduleRoles) {
    if (!moduleRoles.includes(activeRole)) {
      throw new AppError("Export requires the corresponding active module workspace",403);
    }
    // These module exports do not yet apply department/campus predicates.
    // Only the active Placement workspace may export its own dataset here.
    const scopedWorkspaceRoles = ["DIRECTOR", "DEAN", "HOD", "FACULTY", "STUDENT", "PARENT", "PLACEMENT"];
    const hasScopedWorkspace = scopedWorkspaceRoles.includes(activeRole);
    const placementDataset = [
      "placement-companies", "placement-drives", "placement-openings",
      "placement-applications", "placement-offers", "placement-visits", "placement-tests", "placement-interviews",
    ].includes(type);
    const placementOnly = placementDataset && activeRole === "PLACEMENT";
    if (!institutionWide && hasScopedWorkspace && !placementOnly) {
      throw new AppError("This export does not yet support your assigned department/campus scope",403);
    }
    return { institutionWide: true, roles, departmentIds: [], campusIds: [], studentWhere: {} };
  }
  const scopedAcademicRole = ["DIRECTOR", "DEAN", "HOD", "FACULTY"].includes(activeRole);
  if (!scopedAcademicRole) {
    throw new AppError("Export is not available for this role", 403);
  }
  const directorScopedFinance = activeRole === "DIRECTOR" && DIRECTOR_SCOPED_FINANCE_EXPORT_TYPES.has(type);
  if ((FINANCE_EXPORT_TYPES.has(type) && !directorScopedFinance) || type === "users") {
    throw new AppError("This export requires institution-wide finance or user-directory authority", 403);
  }
  if (type === "campuses" && activeRole !== "DIRECTOR") {
    throw new AppError("Campus export requires an assigned Director campus scope", 403);
  }
  if (!SCOPED_EXPORT_TYPES.has(type) && type !== "campuses" && !directorScopedFinance) {
    throw new AppError("This dataset does not support scoped export for this role", 403);
  }
  const departmentIds = await getAuthorizedDepartmentIds(institutionId, actor);
  const campusIds = isDirectorScoped(actor)
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

export function computeExportInvoiceBalance(amount: number, netPaidAmount: number): number {
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  const safePaid = Number.isFinite(netPaidAmount) ? netPaidAmount : 0;
  return Math.max(0, safeAmount - safePaid);
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
  students: ["search", "departmentId", "programId", "semesterId", "sectionId", "programCode", "program", "academicYear", "semester", "section", "status"],
  faculty: ["search", "active"],
  departments: ["search", "active", "campusId"],
  programs: ["search", "departmentId", "departmentCode", "level", "active"],
  "academic-years": ["search", "isCurrent", "startDate", "endDate"],
  semesters: ["search", "departmentId", "programId", "programCode", "academicYear", "number"],
  sections: ["search", "departmentId", "semesterId", "programCode", "academicYear", "semesterNumber", "active"],
  courses: ["search", "departmentId", "departmentCode", "active"],
  "course-offerings": ["search", "departmentId", "programId", "semesterId", "courseCode", "programCode", "academicYear", "semester", "section", "facultyEmail", "active"],
  exams: ["search", "courseCode", "section", "dateFrom", "dateTo"],
  marks: ["search", "studentEmail", "admissionNumber", "courseCode", "section", "component", "dateFrom", "dateTo"],
  attendance: ["search", "studentEmail", "admissionNumber", "courseCode", "section", "status", "dateFrom", "dateTo"],
  fees: ["search", "status", "sourceModule", "sourceType", "dateFrom", "dateTo"],
  "fee-payments": ["search", "reference", "invoiceTitle", "dateFrom", "dateTo"],
  "fee-structures": ["search", "name", "status", "currency"],
  notices: ["search", "audience", "departmentId", "dateFrom", "dateTo"],
  timetable: ["search", "courseCode", "course", "programId", "semesterId", "sectionId", "departmentId", "section", "facultyEmail", "dayOfWeek"],
  "parent-links": ["search", "parentEmail", "studentEmail", "relationship", "dateFrom", "dateTo"],
  campuses: ["search", "active"],
  "paid-fees": ["search", "status", "sourceModule", "sourceType", "dateFrom", "dateTo"],
  "outstanding-dues": ["search", "status", "sourceModule", "sourceType", "dateFrom", "dateTo"],
  "fee-heads": ["search", "active"],
  "fee-receipts": ["search", "receiptNumber", "invoiceNumber", "studentEmail", "dateFrom", "dateTo"],
  "fee-transactions": ["search", "type", "reference", "dateFrom", "dateTo"],
  "fee-refunds": ["search", "status", "reason", "dateFrom", "dateTo"],
  "fee-concessions": ["search", "status", "type", "reason", "dateFrom", "dateTo"],
  "fee-audit": ["search", "action", "entityType", "dateFrom", "dateTo"],
  assignments: ["search", "courseCode", "section", "status", "dateFrom", "dateTo"],
  "assignment-submissions": ["search", "courseCode", "section", "status", "dateFrom", "dateTo"],
  "library-books": ["search", "author", "category", "isActive"],
  "library-copies": ["search", "accessionNumber", "barcode", "status", "condition"],
  "library-issues": ["search", "borrowerEmail", "bookTitle", "status", "dateFrom", "dateTo"],
  "library-fines": ["search", "status", "type", "dateFrom", "dateTo"],
  "admission-applications": ["search", "status", "programId", "academicYearId", "program", "academicYear", "dateFrom", "dateTo"],
  employees: ["search", "employeeCode", "department", "departmentId", "designation", "status", "employmentType"],
  "leave-requests": ["search", "status", "leaveType", "dateFrom", "dateTo"],
  "calendar-events": ["search", "eventType", "audience", "dateFrom", "dateTo"],
  "institutional-events": ["search", "status", "publicationStatus", "department", "dateFrom", "dateTo"],
  "event-media": ["search", "eventTitle", "mediaType", "dateFrom", "dateTo"],
  "placement-companies": ["search", "industry", "relationshipStatus"],
  "placement-drives": ["search", "status", "company", "campusId", "dateFrom", "dateTo"],
  "placement-openings": ["search", "role", "employmentType", "location", "dateFrom", "dateTo"],
  "placement-applications": ["search", "status", "company", "admissionNumber", "dateFrom", "dateTo"],
  "placement-offers": ["search", "status", "company", "joiningStatus", "dateFrom", "dateTo"],
  "placement-visits": ["search", "status", "company", "dateFrom", "dateTo"],
  "placement-tests": ["search", "status", "company", "dateFrom", "dateTo"],
  "placement-interviews": ["search", "status", "company", "dateFrom", "dateTo"],
};

const EXPORT_SEARCH_FIELDS: Partial<Record<ExportType, readonly string[]>> = {
  users: ["firstName", "lastName", "email", "phone", "roles"],
  students: ["firstName", "lastName", "email", "admissionNumber"],
  faculty: ["firstName", "lastName", "email", "assignedOfferings"],
  "library-books": ["title", "author", "isbn", "category", "publisher", "shelfLocation"],
  "library-copies": ["accessionNumber", "barcode", "title", "author"],
  "library-issues": ["borrowerEmail", "borrowerName", "bookTitle", "accessionNumber"],
  "library-fines": ["studentEmail", "admissionNumber", "type", "reason", "status"],
  "admission-applications": ["applicationNumber", "firstName", "lastName", "email", "phone"],
  employees: ["employeeCode", "firstName", "lastName", "email", "designation", "department"],
  "leave-requests": ["applicantName", "applicantEmail", "leaveType", "reason", "status"],
  "calendar-events": ["title", "description", "eventType", "audience"],
  "institutional-events": ["title", "slug", "shortDescription", "department", "category", "tags"],
  "event-media": ["eventTitle", "title", "altText", "url"],
  "placement-companies": ["name", "industry", "companyType", "relationshipStatus", "headquarters"],
  "placement-drives": ["title", "company", "status", "venue"],
  "placement-openings": ["role", "description", "employmentType", "location"],
  "placement-applications": ["studentEmail", "studentName", "admissionNumber", "company", "role", "status"],
  "placement-offers": ["studentEmail", "studentName", "admissionNumber", "company", "role", "status"],
  "placement-visits": ["title", "type", "company", "status", "venue", "purpose"],
  "placement-tests": ["title", "company", "status", "mode", "venue"],
  "placement-interviews": ["title", "roundType", "company", "status", "venue", "interviewer"],
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
  "fee-heads": "createdAt",
  "fee-receipts": "issuedAt",
  "fee-transactions": "createdAt",
  "fee-refunds": "createdAt",
  "fee-concessions": "createdAt",
  "fee-audit": "createdAt",
  assignments: "dueDate",
  "assignment-submissions": "submittedAt",
  "library-books": "createdAt",
  "library-copies": "createdAt",
  "library-issues": "issuedAt",
  "library-fines": "createdAt",
  "admission-applications": "createdAt",
  employees: "joiningDate",
  "leave-requests": "fromDate",
  "calendar-events": "startDate",
  "institutional-events": "eventDate",
  "event-media": "createdAt",
  "placement-companies": "createdAt",
  "placement-drives": "driveDate",
  "placement-openings": "deadline",
  "placement-applications": "appliedAt",
  "placement-offers": "offerDate",
  "placement-visits": "startsAt",
  "placement-tests": "scheduledAt",
  "placement-interviews": "startsAt",
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
        const fields = EXPORT_SEARCH_FIELDS[type] ?? Object.keys(row);
        const haystack = fields.map((field) => String(row[field] ?? "")).join(" ").toLocaleLowerCase();
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
        if (!actualKey) return false;
        if (expected === "__NULL__") {
          if (row[actualKey] !== null && row[actualKey] !== undefined && row[actualKey] !== "") return false;
        } else if (key === "roles") {
          const actualRoles = String(row[actualKey] ?? "").split(",").map((role) => role.trim().toLocaleUpperCase());
          const requestedRoles = expected.split("|").map((role) => role.trim().toLocaleUpperCase()).filter(Boolean);
          if (!requestedRoles.some((role) => actualRoles.includes(role))) return false;
        } else if (String(row[actualKey] ?? "").toLocaleLowerCase() !== expected.toLocaleLowerCase()) return false;
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
  allowLarge = false,
) {
  if (!EXPORT_TYPES.includes(type)) throw new AppError("Unsupported export type: " + type, 400);
  if (!["xlsx", "csv", "docx", "pdf", "json"].includes(format)) throw new AppError("Format must be xlsx, csv, docx, pdf, or json", 400);
  const scope = await assertExportAccess(institutionId, actor, type);
  const noScopeSentinel = "__NO_AUTHORIZED_SCOPE__";
  const scopedDepartmentFilter = { in: scope.departmentIds.length ? scope.departmentIds : [noScopeSentinel] };
  const scopedStudentFilter = {
    student: {
      AND: [
        {
          studentEnrollments: {
            some: {
              institutionId,
              program: { departmentId: scopedDepartmentFilter },
            },
          },
        },
        {
          NOT: {
            studentEnrollments: {
              some: {
                institutionId,
                program: { departmentId: { notIn: scope.departmentIds } },
              },
            },
          },
        },
      ],
    },
  };
  if (!scope.institutionWide) {
    const filters = options.filters ?? {};
    if (filters.departmentId && !scope.departmentIds.includes(filters.departmentId)) {
      throw new AppError("Department filter is outside the authorized export scope", 404);
    }
    if (filters.programId) {
      const program = await prisma.program.findFirst({
        where: { id: filters.programId, institutionId, departmentId: { in: scope.departmentIds.length ? scope.departmentIds : [noScopeSentinel] } },
        select: { id: true },
      });
      if (!program) throw new AppError("Program filter is outside the authorized export scope", 404);
    }
    if (filters.semesterId) {
      const semester = await prisma.semester.findFirst({
        where: { id: filters.semesterId, institutionId, program: { departmentId: { in: scope.departmentIds.length ? scope.departmentIds : [noScopeSentinel] } } },
        select: { id: true },
      });
      if (!semester) throw new AppError("Semester filter is outside the authorized export scope", 404);
    }
    if (filters.sectionId) {
      const section = await prisma.section.findFirst({
        where: { id: filters.sectionId, institutionId, semester: { program: { departmentId: { in: scope.departmentIds.length ? scope.departmentIds : [noScopeSentinel] } } } },
        select: { id: true },
      });
      if (!section) throw new AppError("Section filter is outside the authorized export scope", 404);
    }
  }
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
      where: {
        institutionId,
        userRoles: { some: { role: { name: "STUDENT" } } },
        ...(scope.institutionWide ? {} : { AND: [scope.studentWhere] }),
        ...(options.filters?.programId || options.filters?.sectionId || options.filters?.semesterId || options.filters?.departmentId ? {
          studentEnrollments: { some: {
            ...(options.filters?.programId ? { programId: options.filters.programId } : {}),
            ...(options.filters?.sectionId ? { sectionId: options.filters.sectionId } : {}),
            ...(options.filters?.semesterId ? { section: { semesterId: options.filters.semesterId } } : {}),
            ...(options.filters?.departmentId ? { program: { departmentId: options.filters.departmentId } } : {}),
          } },
        } : {}),
      },
      include: {
        profile: true,
        studentEnrollments: {
          where: {
            ...(scope.institutionWide ? {} : { program: { departmentId: scopedDepartmentFilter } }),
            ...(options.filters?.programId ? { programId: options.filters.programId } : {}),
            ...(options.filters?.sectionId ? { sectionId: options.filters.sectionId } : {}),
            ...(options.filters?.semesterId ? { section: { semesterId: options.filters.semesterId } } : {}),
            ...(options.filters?.departmentId ? { program: { departmentId: options.filters.departmentId } } : {}),
          },
          include: { program: true, academicYear: true, section: { include: { semester: true } } },
          orderBy: { academicYear: { startDate: "desc" } },
          take: 1,
        },
      },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
     }));
    for (const s of students) {
      const e = s.studentEnrollments[0];
      rows.push({ id: s.id, email: s.email, firstName: s.firstName, lastName: s.lastName, phone: s.phone, admissionNumber: s.profile?.admissionNumber ?? null, dateOfBirth: clean(s.profile?.dateOfBirth), gender: s.profile?.gender ?? null, guardianName: s.profile?.guardianName ?? null, guardianPhone: s.profile?.guardianPhone ?? null, departmentId: e?.program.departmentId ?? null, programId: e?.programId ?? e?.program.id ?? null, semesterId: e?.semesterId ?? null, sectionId: e?.sectionId ?? null, programCode: e?.program.code ?? null, program: e?.program.name ?? null, academicYear: e?.academicYear.name ?? null, semester: e?.section?.semester.name ?? null, section: e?.section?.name ?? null, rollNumber: e?.rollNumber ?? null, status: s.profile?.status ?? e?.status ?? "ACTIVE" });
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
    for (const p of data) rows.push({ id: p.id, code: p.code, name: p.name, departmentId: p.departmentId, departmentCode: p.department.code, department: p.department.name, level: p.level, durationYears: p.durationYears, active: p.isActive });
  }

  if (type === "academic-years") {
    const data = await collectInBatches((skip, take) => prisma.academicYear.findMany({ skip, take, where: { institutionId }, orderBy: { startDate: "desc" }  }));
    for (const y of data) rows.push({ id: y.id, name: y.name, startDate: clean(y.startDate), endDate: clean(y.endDate), isCurrent: y.isCurrent });
  }

  if (type === "semesters") {
    const data = await collectInBatches((skip, take) => prisma.semester.findMany({ skip, take, where: { institutionId, ...(scope.institutionWide ? {} : { program: { departmentId: scopedDepartmentFilter } }) }, include: { program: true, academicYear: true }, orderBy: [{ academicYear: { startDate: "desc" } }, { number: "asc" }]  }));
    for (const s of data) rows.push({ id: s.id, name: s.name, number: s.number, programId: s.programId, departmentId: s.program.departmentId, programCode: s.program.code, academicYear: s.academicYear.name, startDate: clean(s.startDate), endDate: clean(s.endDate), active: s.isActive });
  }

  if (type === "sections") {
    const data = await collectInBatches((skip, take) => prisma.section.findMany({ skip, take, where: { institutionId, ...(scope.institutionWide ? {} : { semester: { program: { departmentId: scopedDepartmentFilter } } }) }, include: { semester: { include: { program: true, academicYear: true } } }, orderBy: { name: "asc" }  }));
    for (const s of data) rows.push({ id: s.id, name: s.name, capacity: s.capacity, active: s.isActive, semesterId: s.semesterId, programId: s.semester.program.id, departmentId: s.semester.program.departmentId, programCode: s.semester.program.code, academicYear: s.semester.academicYear.name, semesterNumber: s.semester.number });
  }

  if (type === "courses") {
    const data = await collectInBatches((skip, take) => prisma.course.findMany({ skip, take, where: { institutionId, ...(scope.institutionWide ? {} : { departmentId: scopedDepartmentFilter }) }, include: { department: true }, orderBy: { code: "asc" }  }));
    for (const c of data) rows.push({ id: c.id, code: c.code, name: c.name, departmentId: c.departmentId, departmentCode: c.department.code, credits: c.credits, description: c.description, active: c.isActive });
  }

  if (type === "course-offerings") {
    const data = await collectInBatches((skip, take) => prisma.courseOffering.findMany({ skip, take, where: { institutionId, ...(scope.institutionWide ? {} : { semester: { program: { departmentId: scopedDepartmentFilter } }, ...(scope.roles.has("FACULTY") ? { facultyId: actor.id } : {}) }) }, include: { course: true, semester: { include: { program: true, academicYear: true } }, section: true, faculty: true }, orderBy: { createdAt: "desc" }  }));
    for (const o of data) rows.push({ id: o.id, departmentId: o.semester.program.departmentId, programId: o.semester.program.id, semesterId: o.semester.id, courseCode: o.course.code, course: o.course.name, programCode: o.semester.program.code, academicYear: o.semester.academicYear.name, semester: o.semester.name, section: o.section.name, facultyEmail: o.faculty?.email ?? null, active: o.isActive });
  }

  if (type === "exams") {
    const data = await collectInBatches((skip, take) => prisma.exam.findMany({ skip, take, where: { institutionId, ...(scope.institutionWide ? {} : { courseOffering: { semester: { program: { departmentId: scopedDepartmentFilter } }, ...(scope.roles.has("FACULTY") ? { facultyId: actor.id } : {}) } }) }, include: { courseOffering: { include: { course: true, section: true } }, results: { where: scope.institutionWide ? {} : { student: { AND: [scopedStudentFilter.student] } }, include: { student: { include: { profile: true } } } } }, orderBy: { examDate: "desc" }  }));
    for (const e of data) {
      if (!e.results.length) rows.push({ id: e.id, courseCode: e.courseOffering.course.code, section: e.courseOffering.section.name, title: e.title, examDate: clean(e.examDate), maxMarks: e.maxMarks, studentEmail: null, admissionNumber: null, marks: null, remarks: null });
      for (const r of e.results) rows.push({ id: e.id, courseCode: e.courseOffering.course.code, section: e.courseOffering.section.name, title: e.title, examDate: clean(e.examDate), maxMarks: e.maxMarks, studentEmail: r.student.email, admissionNumber: r.student.profile?.admissionNumber ?? null, marks: r.marks, remarks: r.remarks });
    }
  }

  if (type === "marks") {
    const data = await collectInBatches((skip, take) => prisma.internalMark.findMany({ skip, take, where: { institutionId, ...(scope.institutionWide ? {} : { student: { AND: [scopedStudentFilter.student] }, courseOffering: { semester: { program: { departmentId: scopedDepartmentFilter } }, ...(scope.roles.has("FACULTY") ? { facultyId: actor.id } : {}) } }) }, include: { student: { include: { profile: true } }, courseOffering: { include: { course: true, section: true } } }, orderBy: { updatedAt: "desc" }  }));
    for (const m of data) rows.push({ id: m.id, studentEmail: m.student.email, admissionNumber: m.student.profile?.admissionNumber ?? null, courseCode: m.courseOffering.course.code, section: m.courseOffering.section.name, component: m.component, marksObtained: m.marksObtained, maxMarks: m.maxMarks, updatedAt: clean(m.updatedAt) });
  }

  if (type === "attendance") {
    const data = await collectInBatches((skip, take) => prisma.attendanceRecord.findMany({
      skip,
      take,
      where: {
        attendanceSession: {
          institutionId,
          ...(scope.institutionWide ? {} : {
            courseOffering: {
              semester: { program: { departmentId: scopedDepartmentFilter } },
              ...(scope.roles.has("FACULTY") ? { facultyId: actor.id } : {}),
            },
          }),
        },
        ...(scope.institutionWide ? {} : { student: { AND: [scopedStudentFilter.student] } }),
      },
      include: { student: { include: { profile: true } }, attendanceSession: { include: { courseOffering: { include: { course: true, section: true } } } } },
      orderBy: { attendanceSession: { sessionDate: "desc" } },
    }));
    for (const a of data) rows.push({ id: a.id, studentEmail: a.student.email, admissionNumber: a.student.profile?.admissionNumber ?? null, courseCode: a.attendanceSession.courseOffering.course.code, section: a.attendanceSession.courseOffering.section.name, date: clean(a.attendanceSession.sessionDate), status: a.status });
  }

  if (type === "fee-structures") {
    const data = await prisma.$queryRaw<Array<any>>(Prisma.sql`SELECT fs."id", fs."name", fs."status", fs."currency", fs."notes", fs."academicYearId", fs."programId", fs."semesterId", fh."code" AS "feeHeadCode", fh."name" AS "feeHeadName", fsi."amount", fsi."dueDays", fsi."installmentNumber" FROM "fee_structures" fs LEFT JOIN "fee_structure_items" fsi ON fsi."feeStructureId" = fs."id" LEFT JOIN "fee_heads" fh ON fh."id" = fsi."feeHeadId" WHERE fs."institutionId" = ${institutionId} ${scope.institutionWide ? Prisma.empty : Prisma.sql`AND (
  (fs."programId" IS NOT NULL AND fs."programId" IN (
    SELECT p."id" FROM "programs" p WHERE p."institutionId" = ${institutionId}
      AND p."departmentId" IN (${Prisma.join(scope.departmentIds.length ? scope.departmentIds : [noScopeSentinel])})
  ))
  OR (fs."programId" IS NULL AND fs."semesterId" IN (
    SELECT sem."id" FROM "semesters" sem
    JOIN "programs" p ON p."id" = sem."programId" AND p."institutionId" = sem."institutionId"
    WHERE sem."institutionId" = ${institutionId}
      AND p."departmentId" IN (${Prisma.join(scope.departmentIds.length ? scope.departmentIds : [noScopeSentinel])})
  ))
) AND (fs."semesterId" IS NULL OR fs."semesterId" IN (
  SELECT sem."id" FROM "semesters" sem
  JOIN "programs" p ON p."id" = sem."programId" AND p."institutionId" = sem."institutionId"
  WHERE sem."institutionId" = ${institutionId}
    AND p."departmentId" IN (${Prisma.join(scope.departmentIds.length ? scope.departmentIds : [noScopeSentinel])})
))`} ORDER BY fs."name", fsi."installmentNumber", fh."code"`);
    for (const r of data) rows.push({ id: r.id, name: r.name, status: r.status, currency: r.currency, notes: r.notes, academicYearId: r.academicYearId, programId: r.programId, semesterId: r.semesterId, feeHeadCode: r.feeHeadCode, feeHeadName: r.feeHeadName, amount: r.amount, dueDays: r.dueDays, installmentNumber: r.installmentNumber });
  }

  if (type === "fees" || type === "fee-payments" || type === "paid-fees" || type === "outstanding-dues") {
    const data = await collectInBatches((skip, take) => prisma.feeInvoice.findMany({
      skip, take, where: { institutionId, ...(scope.institutionWide ? {} : scopedStudentFilter) },
      include: { student: { include: { profile: true } }, payments: true },
      orderBy: { createdAt: "desc" },
    }));
    for (const i of data) {
      // FeeInvoice aggregate columns are the finance domain's canonical ledger values.
      // Re-summing raw payments here would ignore refund and concession postings.
      const paid = Number(i.paidAmount);
      const refunded = Number(i.refundedAmount);
      const amount = Number(i.amount);
      // Refund processing reduces FeeInvoice.paidAmount and increments refundedAmount.
      // The outstanding balance must not subtract the same refund twice.
      const balance = computeExportInvoiceBalance(amount, paid);
      if (type === "fees" || (type === "paid-fees" && i.status === "PAID" && balance === 0) || (type === "outstanding-dues" && i.status !== "CANCELLED" && i.status !== "PAID" && balance > 0)) {
        rows.push({
          id: i.id, invoiceNumber: i.invoiceNumber, studentEmail: i.student.email,
          admissionNumber: i.student.profile?.admissionNumber ?? null,
          title: i.title, amount, paid, refunded, balance, status: i.status,
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

  if (type === "fee-heads") {
    const data = await collectInBatches((skip, take) => prisma.feeHead.findMany({ skip, take, where: { institutionId }, orderBy: { name: "asc" } }));
    for (const x of data) rows.push({ id: x.id, code: x.code, name: x.name, description: x.description, active: x.isActive, createdAt: clean(x.createdAt) });
  }

  if (type === "fee-receipts") {
    const data = await collectInBatches((skip, take) => prisma.feeReceipt.findMany({
      skip, take, where: { institutionId, ...(scope.institutionWide ? {} : scopedStudentFilter) },
      include: { payment: true, invoice: true, student: { include: { profile: true } } },
      orderBy: { issuedAt: "desc" },
    }));
    for (const x of data) rows.push({ id: x.id, receiptNumber: x.receiptNumber, invoiceNumber: x.invoice.invoiceNumber, studentEmail: x.student.email, admissionNumber: x.student.profile?.admissionNumber ?? null, amount: Number(x.payment.amount), method: x.payment.method, paymentStatus: x.payment.status, issuedAt: clean(x.issuedAt) });
  }

  if (type === "fee-transactions") {
    const data = await collectInBatches((skip, take) => prisma.feeTransaction.findMany({
      skip, take, where: { institutionId, ...(scope.institutionWide ? {} : { student: { AND: [scopedStudentFilter.student] } }) },
      include: { student: { include: { profile: true } }, invoice: true },
      orderBy: { createdAt: "desc" },
    }));
    for (const x of data) rows.push({ id: x.id, type: x.type, amount: Number(x.amount), reference: x.reference, invoiceNumber: x.invoice?.invoiceNumber ?? null, studentEmail: x.student?.email ?? null, admissionNumber: x.student?.profile?.admissionNumber ?? null, createdAt: clean(x.createdAt) });
  }

  if (type === "fee-refunds") {
    const data = await collectInBatches((skip, take) => prisma.feeRefund.findMany({
      skip, take, where: { institutionId, ...(scope.institutionWide ? {} : { student: { AND: [scopedStudentFilter.student] } }) },
      include: { student: { include: { profile: true } }, invoice: true, payment: true },
      orderBy: { createdAt: "desc" },
    }));
    for (const x of data) rows.push({ id: x.id, invoiceNumber: x.invoice.invoiceNumber, receiptNumber: x.payment.receiptNumber, studentEmail: x.student.email, admissionNumber: x.student.profile?.admissionNumber ?? null, amount: Number(x.amount), reason: x.reason, status: x.status, reference: x.reference, approvedAt: clean(x.approvedAt), processedAt: clean(x.processedAt), createdAt: clean(x.createdAt) });
  }

  if (type === "fee-concessions") {
    const data = await collectInBatches((skip, take) => prisma.feeConcession.findMany({
      skip, take, where: { institutionId, ...(scope.institutionWide ? {} : { student: { AND: [scopedStudentFilter.student] } }) },
      include: { student: { include: { profile: true } }, invoice: true, feeStructure: true },
      orderBy: { createdAt: "desc" },
    }));
    for (const x of data) rows.push({ id: x.id, name: x.name, type: x.type, concessionType: x.concessionType, studentEmail: x.student.email, admissionNumber: x.student.profile?.admissionNumber ?? null, invoiceNumber: x.invoice?.invoiceNumber ?? null, feeStructure: x.feeStructure?.name ?? null, amount: Number(x.amount), percentage: x.percentage === null ? null : Number(x.percentage), reason: x.reason, status: x.status, approvedAt: clean(x.approvedAt), createdAt: clean(x.createdAt) });
  }

  if (type === "fee-audit") {
    const data = await collectInBatches((skip, take) => prisma.auditLog.findMany({
      skip, take, where: { institutionId, action: { startsWith: "finance." } },
      orderBy: { createdAt: "desc" },
    }));
    for (const x of data) rows.push({ id: x.id, action: x.action, entityType: x.entityType, entityId: x.entityId, userId: x.userId, createdAt: clean(x.createdAt) });
  }

  if (type === "assignments") {
    const data = await collectInBatches((skip, take) => prisma.assignment.findMany({
      skip, take, where: { institutionId, ...(scope.institutionWide ? {} : { courseOffering: { semester: { program: { departmentId: scopedDepartmentFilter } }, ...(scope.roles.has("FACULTY") ? { facultyId: actor.id } : {}) } }) },
      include: { courseOffering: { include: { course: true, section: true, faculty: true } } },
      orderBy: { dueDate: "desc" },
    }));
    for (const x of data) rows.push({ id: x.id, title: x.title, description: x.description, courseCode: x.courseOffering.course.code, course: x.courseOffering.course.name, section: x.courseOffering.section.name, facultyEmail: x.courseOffering.faculty?.email ?? null, dueDate: clean(x.dueDate), maxMarks: x.maxMarks, status: x.status, createdAt: clean(x.createdAt) });
  }

  if (type === "assignment-submissions") {
    const data = await collectInBatches((skip, take) => prisma.assignmentSubmission.findMany({
      skip, take, where: { institutionId, ...(scope.institutionWide ? {} : { student: { AND: [scopedStudentFilter.student] }, assignment: { courseOffering: { semester: { program: { departmentId: scopedDepartmentFilter } }, ...(scope.roles.has("FACULTY") ? { facultyId: actor.id } : {}) } } }) },
      include: { student: { include: { profile: true } }, assignment: { include: { courseOffering: { include: { course: true, section: true } } } } },
      orderBy: { submittedAt: "desc" },
    }));
    for (const x of data) rows.push({ id: x.id, assignmentId: x.assignmentId, assignmentTitle: x.assignment.title, courseCode: x.assignment.courseOffering.course.code, section: x.assignment.courseOffering.section.name, studentId: x.studentId, studentName: (x.student.firstName + " " + x.student.lastName).trim(), studentEmail: x.student.email, admissionNumber: x.student.profile?.admissionNumber ?? null, status: x.status, submittedAt: clean(x.submittedAt), marksAwarded: x.marksAwarded, feedback: x.feedback, reviewedAt: clean(x.reviewedAt) });
  }

  if (type === "library-books") {
    const data = await collectInBatches((skip, take) => prisma.libraryBook.findMany({ skip, take, where: { institutionId }, orderBy: { title: "asc" } }));
    for (const x of data) rows.push({ id: x.id, title: x.title, author: x.author, isbn: x.isbn, category: x.category, publisher: x.publisher, shelfLocation: x.shelfLocation, totalCopies: x.totalCopies, availableCopies: x.availableCopies, active: x.isActive, defaultAcquisitionCost: x.defaultAcquisitionCost, defaultReplacementValue: x.defaultReplacementValue, defaultCurrentValue: x.defaultCurrentValue, createdAt: clean(x.createdAt) });
  }

  if (type === "library-copies") {
    const data = await collectInBatches((skip, take) => prisma.libraryBookCopy.findMany({ skip, take, where: { institutionId }, include: { book: true }, orderBy: { accessionNumber: "asc" } }));
    for (const x of data) rows.push({ id: x.id, accessionNumber: x.accessionNumber, barcode: x.barcode, bookId: x.bookId, title: x.book.title, author: x.book.author, location: x.location, shelf: x.shelf, acquisitionDate: clean(x.acquisitionDate), acquisitionCost: x.acquisitionCost, replacementValue: x.replacementValue, currentValue: x.currentValue, condition: x.condition, status: x.status, createdAt: clean(x.createdAt) });
  }

  if (type === "library-issues") {
    const data = await collectInBatches((skip, take) => prisma.libraryIssue.findMany({ skip, take, where: { institutionId }, include: { book: true, borrower: { include: { profile: true } }, copy: true }, orderBy: { issuedAt: "desc" } }));
    for (const x of data) rows.push({ id: x.id, bookId: x.bookId, bookTitle: x.book.title, borrowerId: x.borrowerId, borrowerName: (x.borrower.firstName + " " + x.borrower.lastName).trim(), borrowerEmail: x.borrower.email, admissionNumber: x.borrower.profile?.admissionNumber ?? null, accessionNumber: x.copy?.accessionNumber ?? null, issuedAt: clean(x.issuedAt), dueDate: clean(x.dueDate), returnedAt: clean(x.returnedAt), status: x.returnedAt ? "RETURNED" : "ISSUED", fineAmount: x.fineAmount, note: x.note });
  }

  if (type === "library-fines") {
    const data = await collectInBatches((skip, take) => prisma.libraryFine.findMany({ skip, take, where: { institutionId }, include: { student: { include: { profile: true } }, issue: { include: { book: true } } }, orderBy: { createdAt: "desc" } }));
    for (const x of data) rows.push({ id: x.id, issueId: x.issueId, bookTitle: x.issue.book.title, studentId: x.studentId, studentEmail: x.student.email, admissionNumber: x.student.profile?.admissionNumber ?? null, type: x.type, originalAmount: Number(x.originalAmount), waivedAmount: Number(x.waivedAmount), outstandingAmount: Math.max(0, Number(x.originalAmount) - Number(x.waivedAmount)), reason: x.reason, status: x.status, financialInvoiceId: x.financialInvoiceId, approvedAt: clean(x.approvedAt), createdAt: clean(x.createdAt) });
  }

  if (type === "admission-applications") {
    const data = await collectInBatches((skip, take) => prisma.admissionApplication.findMany({ skip, take, where: { institutionId }, include: { program: true, academicYear: true }, orderBy: { createdAt: "desc" } }));
    for (const x of data) rows.push({ id: x.id, applicationNumber: x.applicationNumber, firstName: x.firstName, lastName: x.lastName, email: x.email, phone: x.phone, dateOfBirth: clean(x.dateOfBirth), gender: x.gender, guardianName: x.guardianName, guardianPhone: x.guardianPhone, program: x.program.name, programId: x.programId, academicYear: x.academicYear.name, academicYearId: x.academicYearId, previousInstitution: x.previousInstitution, previousPercentage: x.previousPercentage, status: x.status, remarks: x.remarks, createdAt: clean(x.createdAt), updatedAt: clean(x.updatedAt) });
  }

  if (type === "employees") {
    const data = await collectInBatches((skip, take) => prisma.employeeProfile.findMany({ skip, take, where: { institutionId }, include: { user: true, department: true }, orderBy: { employeeCode: "asc" } }));
    for (const x of data) rows.push({ id: x.id, userId: x.userId, employeeCode: x.employeeCode, firstName: x.user.firstName, lastName: x.user.lastName, email: x.user.email, phone: x.user.phone, department: x.department?.name ?? null, departmentId: x.departmentId, designation: x.designation, employmentType: x.employmentType, joiningDate: clean(x.joiningDate), status: x.status, qualification: x.qualification, createdAt: clean(x.createdAt) });
  }

  if (type === "leave-requests") {
    const data = await collectInBatches((skip, take) => prisma.leaveRequest.findMany({ skip, take, where: { institutionId }, include: { applicant: true, leaveType: true }, orderBy: { fromDate: "desc" } }));
    for (const x of data) rows.push({ id: x.id, applicantId: x.applicantId, applicantName: (x.applicant.firstName + " " + x.applicant.lastName).trim(), applicantEmail: x.applicant.email, leaveType: x.leaveType.name, fromDate: clean(x.fromDate), toDate: clean(x.toDate), days: x.days, reason: x.reason, status: x.status, decidedById: x.decidedById, decidedAt: clean(x.decidedAt), decisionNote: x.decisionNote, createdAt: clean(x.createdAt) });
  }

  if (type === "calendar-events") {
    const data = await collectInBatches((skip, take) => prisma.calendarEvent.findMany({ skip, take, where: { institutionId }, include: { academicYear: true }, orderBy: { startDate: "desc" } }));
    for (const x of data) rows.push({ id: x.id, title: x.title, description: x.description, eventType: x.eventType, startDate: clean(x.startDate), endDate: clean(x.endDate), academicYear: x.academicYear?.name ?? null, audience: x.audience, createdById: x.createdById, createdAt: clean(x.createdAt) });
  }

  if (type === "institutional-events") {
    const data = await collectInBatches((skip, take) => prisma.institutionalEvent.findMany({ skip, take, where: { institutionId }, include: { category: true, department: true }, orderBy: { eventDate: "desc" } }));
    for (const x of data) rows.push({ id: x.id, title: x.title, slug: x.slug, shortDescription: x.shortDescription, description: x.description, eventDate: clean(x.eventDate), startTime: x.startTime, endTime: x.endTime, venue: x.venue, category: x.category?.name ?? null, department: x.department?.name ?? null, departmentId: x.departmentId, status: x.status, publicationStatus: x.publicationStatus, isFeatured: x.isFeatured, tags: x.tags ? JSON.stringify(x.tags) : null, createdAt: clean(x.createdAt) });
  }

  if (type === "event-media") {
    const data = await collectInBatches((skip, take) => prisma.eventMedia.findMany({ skip, take, where: { institutionId }, include: { event: true }, orderBy: [{ eventId: "asc" }, { displayOrder: "asc" }] }));
    for (const x of data) rows.push({ id: x.id, eventId: x.eventId, eventTitle: x.event.title, title: x.title, altText: x.altText, url: x.url, displayOrder: x.displayOrder, createdAt: clean(x.createdAt) });
  }

  if (type === "placement-companies") {
    const data = await collectInBatches((skip, take) => prisma.placementCompany.findMany({ skip, take, where: { institutionId }, orderBy: { name: "asc" } }));
    for (const x of data) rows.push({ id: x.id, name: x.name, industry: x.industry, companyType: x.companyType, website: x.website, description: x.description, headquarters: x.headquarters, relationshipStatus: x.relationshipStatus, createdAt: clean(x.createdAt) });
  }

  if (type === "placement-drives") {
    const data = await collectInBatches((skip, take) => prisma.placementDrive.findMany({ skip, take, where: { institutionId }, include: { company: true, opening: true }, orderBy: { driveDate: "desc" } }));
    for (const x of data) rows.push({ id: x.id, title: x.title, company: x.company.name, companyId: x.companyId, openingRole: x.opening?.role ?? null, campusId: x.campusId, status: x.status, applicationDeadline: clean(x.applicationDeadline), driveDate: clean(x.driveDate), venue: x.venue, cgpaRequirement: x.cgpaRequirement, maxBacklogs: x.maxBacklogs, vacancies: x.vacancies });
  }

  if (type === "placement-openings") {
    const data = await collectInBatches((skip, take) => prisma.placementOpening.findMany({ skip, take, where: { institutionId }, include: { company: true }, orderBy: { deadline: "desc" } }));
    for (const x of data) rows.push({ id: x.id, company: x.company.name, companyId: x.companyId, role: x.role, description: x.description, employmentType: x.employmentType, location: x.location, totalCtc: x.totalCtc === null ? null : Number(x.totalCtc), fixedCtc: x.fixedCtc === null ? null : Number(x.fixedCtc), variableCtc: x.variableCtc === null ? null : Number(x.variableCtc), bonus: x.bonus === null ? null : Number(x.bonus), stipend: x.stipend === null ? null : Number(x.stipend), currency: x.currency, deadline: clean(x.deadline) });
  }

  if (type === "placement-applications") {
    const data = await collectInBatches((skip, take) => prisma.application.findMany({ skip, take, where: { institutionId }, include: { student: { include: { profile: true } }, opportunity: true, placementDrive: { include: { company: true } }, placementOpening: { include: { company: true } } }, orderBy: { appliedAt: "desc" } }));
    for (const x of data) rows.push({ id: x.id, studentId: x.studentId, studentEmail: x.student.email, studentName: (x.student.firstName + " " + x.student.lastName).trim(), admissionNumber: x.student.profile?.admissionNumber ?? null, opportunityTitle: x.opportunity.title, company: x.placementDrive?.company.name ?? x.placementOpening?.company.name ?? x.opportunity.organization ?? null, role: x.placementOpening?.role ?? null, status: x.status, appliedAt: clean(x.appliedAt) });
  }

  if (type === "placement-offers") {
    const data = await collectInBatches((skip, take) => prisma.placementOffer.findMany({ skip, take, where: { institutionId }, include: { student: { include: { profile: true } }, company: true }, orderBy: { offerDate: "desc" } }));
    for (const x of data) rows.push({ id: x.id, studentId: x.studentId, studentEmail: x.student.email, studentName: (x.student.firstName + " " + x.student.lastName).trim(), admissionNumber: x.student.profile?.admissionNumber ?? null, company: x.company.name, role: x.role, status: x.status, totalCtc: x.totalCtc === null ? null : Number(x.totalCtc), fixedCtc: x.fixedCtc === null ? null : Number(x.fixedCtc), variableCtc: x.variableCtc === null ? null : Number(x.variableCtc), currency: x.currency, offerDate: clean(x.offerDate), acceptanceAt: clean(x.acceptanceAt), joiningDate: clean(x.joiningDate), joiningStatus: x.joiningStatus, joiningVerifiedAt: clean(x.joiningVerifiedAt) });
  }

  if (type === "placement-visits") {
    const data = await collectInBatches((skip, take) => prisma.placementVisit.findMany({ skip, take, where: { institutionId }, include: { company: { select: { name: true } }, drive: { select: { title: true } } }, orderBy: { startsAt: "desc" } }));
    for (const x of data) rows.push({ id: x.id, title: x.type, type: x.type, company: x.company.name, drive: x.drive?.title ?? null, status: x.status, startsAt: clean(x.startsAt), endsAt: clean(x.endsAt), venue: x.venue, purpose: x.purpose });
  }

  if (type === "placement-tests") {
    const data = await collectInBatches((skip, take) => prisma.placementTest.findMany({ skip, take, where: { institutionId }, include: { drive: { include: { company: { select: { name: true } } } }, _count: { select: { participants: true } } }, orderBy: { scheduledAt: "desc" } }));
    for (const x of data) rows.push({ id: x.id, title: x.title, company: x.drive.company.name, drive: x.drive.title, status: x.status, mode: x.mode, scheduledAt: clean(x.scheduledAt), durationMinutes: x.durationMinutes, maxScore: x.maxScore, participantCount: x._count.participants });
  }

  if (type === "placement-interviews") {
    const data = await collectInBatches((skip, take) => prisma.placementInterview.findMany({ skip, take, where: { institutionId }, include: { drive: { include: { company: { select: { name: true } } } }, _count: { select: { participants: true } } }, orderBy: { startsAt: "desc" } }));
    for (const x of data) rows.push({ id: x.id, title: x.drive.title + " · Round " + x.roundNumber, roundType: x.roundType, roundNumber: x.roundNumber, company: x.drive.company.name, drive: x.drive.title, status: x.status, startsAt: clean(x.startsAt), endsAt: clean(x.endsAt), venue: x.venue, interviewer: x.interviewer, participantCount: x._count.participants });
  }
  if (type === "notices") {
    const data = await collectInBatches((skip, take) => prisma.notice.findMany({ skip, take, where: { institutionId, ...(scope.institutionWide ? {} : { OR: [{ departmentId: null }, { departmentId: scopedDepartmentFilter }] }) }, orderBy: { publishedAt: "desc" }  }));
    for (const n of data) rows.push({ id: n.id, title: n.title, body: n.body, audience: n.audience, departmentId: n.departmentId, publishedAt: clean(n.publishedAt), expiresAt: clean(n.expiresAt) });
  }

  if (type === "timetable") {
    const data = await collectInBatches((skip, take) => prisma.timetableEntry.findMany({ skip, take, where: { institutionId, ...(scope.institutionWide ? {} : { courseOffering: { semester: { program: { departmentId: scopedDepartmentFilter } }, ...(scope.roles.has("FACULTY") ? { facultyId: actor.id } : {}) } }) }, include: { courseOffering: { include: { course: true, semester: { include: { program: true } }, section: true, faculty: true } } }, orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }]  }));
    for (const t of data) rows.push({ id: t.id, programId: t.courseOffering.semester.program.id, semesterId: t.courseOffering.semester.id, departmentId: t.courseOffering.semester.program.departmentId, sectionId: t.courseOffering.section.id, courseCode: t.courseOffering.course.code, course: t.courseOffering.course.name, section: t.courseOffering.section.name, facultyEmail: t.courseOffering.faculty?.email ?? null, dayOfWeek: t.dayOfWeek, startTime: t.startTime, endTime: t.endTime, room: t.room });
  }

  if (type === "parent-links") {
    const data = await collectInBatches((skip, take) => prisma.parentStudentLink.findMany({ skip, take, where: { institutionId, ...(scope.institutionWide ? {} : { student: { AND: [scope.studentWhere] } }) }, include: { parent: true, student: { include: { profile: true } } }, orderBy: { createdAt: "desc" }  }));
    for (const l of data) rows.push({ id: l.parentId + ":" + l.studentId, parentEmail: l.parent.email, parentName: `${l.parent.firstName} ${l.parent.lastName}`.trim(), studentEmail: l.student.email, admissionNumber: l.student.profile?.admissionNumber ?? null, studentName: `${l.student.firstName} ${l.student.lastName}`.trim(), relationship: l.relationship, createdAt: clean(l.createdAt) });
  }

  if (!scope.institutionWide) {
    // Academic reporting scope does not automatically grant guardian or private-profile data access.
    const hiddenFields: Partial<Record<ExportType, readonly string[]>> = {
      students: ["phone", "dateOfBirth", "gender", "guardianName", "guardianPhone"],
      faculty: ["phone"],
    };
    for (const row of rows) {
      for (const field of hiddenFields[type] ?? []) delete row[field];
    }
  }

  const finalRows = applyExportOptions(rows, type, options);
  const inlineLimit = format === "pdf" || format === "docx" ? 10000 : 50000;
  if (!allowLarge && finalRows.length > inlineLimit) {
    throw new AppError(
      "This export matches " + finalRows.length.toLocaleString() +
      " rows, above the synchronous " + inlineLimit.toLocaleString() +
      "-row limit for " + format.toUpperCase() +
      ". Narrow the filters before downloading. Background export jobs are not yet enabled for this dataset.",
      413,
    );
  }
  return makeFile(finalRows, type, format);
}
