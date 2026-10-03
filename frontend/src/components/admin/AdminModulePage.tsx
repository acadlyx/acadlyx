"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { StudentManagement } from "@/components/dashboard/StudentManagement";
import { PeopleImportPanel } from "@/components/dashboard/PeopleImportPanel";
import DataTransferActions from "@/components/dashboard/DataTransferActions";
import type { DataType } from "@/lib/dataTransferApi";
import { authedFetch, getCurrentUser } from "@/lib/auth";
import { findAdminNavItem, type AdminNavItem } from "@/lib/adminNavigation";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { DetailDrawer, DetailField } from "@/components/ui/DetailDrawer";

type Row = Record<string, any> & { id?: string };
type Lookup = Row;
type FieldType =
  | "text"
  | "email"
  | "password"
  | "number"
  | "date"
  | "datetime-local"
  | "textarea"
  | "select"
  | "checkbox";

type Field = {
  name: string;
  label: string;
  type?: FieldType;
  required?: boolean;
  source?: string;
  options?: string[];
  nullableOnEmpty?: boolean;
  span?: 1 | 2;
};

type Filter = {
  name: string;
  label: string;
  source?: string;
  options?: string[];
};

type Resource = {
  dataType?: DataType;
  title: string;
  description: string;
  endpoint: string;
  createEndpoint?: string;
  updateEndpoint?: (id: string) => string;
  deleteEndpoint?: (row: Row) => string;
  deleteMethod?: "DELETE" | "PATCH";
  deleteBody?: (row: Row) => unknown;
  createFields: Field[];
  updateFields: Field[];
  columns: string[];
  filters?: Filter[];
  detailFields?: string[];
  canCreate?: (permissions: string[]) => boolean;
  canUpdate?: (permissions: string[]) => boolean;
  canDelete?: (permissions: string[]) => boolean;
};

const INPUT =
  "w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-3 text-sm font-medium text-slate-900 caret-slate-900 outline-none placeholder:text-slate-400 transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50 disabled:bg-slate-50 disabled:text-slate-500 [color-scheme:light]";

const BUTTON =
  "rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white transition hover:-translate-y-0.5 hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50";

const SECONDARY =
  "rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 transition hover:border-slate-300 hover:bg-slate-50";

const LOOKUPS: Record<string, string> = {
  campuses: "/campuses?page=1&pageSize=500",
  departments: "/departments?page=1&pageSize=500",
  programs: "/programs?page=1&pageSize=500",
  years: "/academic-years?page=1&pageSize=500",
  semesters: "/semesters?page=1&pageSize=500",
  sections: "/sections?page=1&pageSize=500",
  courses: "/courses?page=1&pageSize=500",
  faculty: "/users?page=1&pageSize=500&role=FACULTY",
  users: "/users?page=1&pageSize=500",
  parents: "/users?page=1&pageSize=500&role=PARENT",
  students: "/students?page=1&pageSize=500",
  facilities: "/operations/facilities?includeInactive=true",
  assets: "/operations/assets?page=1&pageSize=500",
  assetCategories: "/operations/asset-categories",
};

const ROLES = [
  "INSTITUTION_ADMIN",
  "CHAIRMAN",
  "DIRECTOR",
  "DEAN",
  "REGISTRAR",
  "HOD",
  "FACULTY",
  "ACCOUNTS",
  "HR",
  "ADMISSIONS",
  "EXAMINATION",
  "LIBRARIAN",
  "PLACEMENT",
  "IT",
  "PARENT",
];

const AUDIENCES = [
  "ALL",
  "STUDENT",
  "FACULTY",
  "PARENT",
  "STAFF",
  "HOD",
  "MANAGEMENT",
];

const CALENDAR_AUDIENCES = [
  "ALL",
  "STUDENTS",
  "FACULTY",
  "STAFF",
];

const EVENT_TYPES = [
  "HOLIDAY",
  "EXAM",
  "EVENT",
  "DEADLINE",
  "ACADEMIC",
];

const ASSET_STATUSES = [
  "IN_USE",
  "IN_STORE",
  "UNDER_REPAIR",
  "RETIRED",
  "LOST",
];

const CONDITIONS = [
  "NEW",
  "GOOD",
  "FAIR",
  "POOR",
  "DAMAGED",
];

const FACILITY_TYPES = [
  "CLASSROOM",
  "LAB",
  "AUDITORIUM",
  "LIBRARY",
  "HOSTEL",
  "SPORTS",
  "OTHER",
];

const MAINTENANCE_STATUS = [
  "OPEN",
  "ASSIGNED",
  "IN_PROGRESS",
  "RESOLVED",
  "CLOSED",
  "REJECTED",
];

const PRIORITIES = [
  "LOW",
  "MEDIUM",
  "HIGH",
  "URGENT",
];

function rowsOf(data: any): Row[] {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.data)) return data.data;
  return [];
}

function text(value: any): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.map(text).join(", ");
  if (typeof value === "object") {
    return text(
      value.name ??
        value.title ??
        value.code ??
        value.email ??
        value.id,
    );
  }
  return String(value);
}

function isDateOnlyField(field: string): boolean {
  const key = field.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
  return key.endsWith("date") || key === "dob" || key === "dateofbirth";
}

function isTimestampField(field: string): boolean {
  const key = field.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
  return key.endsWith("at") || key.includes("timestamp") || key.includes("datetime") || key === "created" || key === "updated";
}

function dateText(value: any, field = ""): string {
  if (!value) return "—";

  if (isDateOnlyField(field)) {
    const raw = String(value);
    const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      const [year, month, day] = match.slice(1).map(Number);
      return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(
        new Date(year, month - 1, day),
      );
    }
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  if (!isTimestampField(field)) {
    return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(date);
  }

  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function relationId(value: any): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;

  if (typeof value === "object") {
    return String(value.id ?? value.uuid ?? "");
  }

  return "";
}

function labelFor(item: Lookup): string {
  const fullName =
    `${item.firstName ?? ""} ${item.lastName ?? ""}`.trim();

  if (fullName) {
    return item.email
      ? `${fullName} — ${item.email}`
      : fullName;
  }

  if (item.code && item.name) {
    return `${item.code} — ${item.name}`;
  }

  if (
    item.number !== undefined &&
    item.name
  ) {
    return `Semester ${item.number} — ${item.name}`;
  }

  return String(
    item.name ??
      item.title ??
      item.email ??
      item.code ??
      item.id ??
      "Unnamed",
  );
}

function displayColumn(column: string): string {
  return column
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (value) =>
      value.toUpperCase(),
    );
}

function rowValue(
  row: Row,
  key: string,
): any {
  if (row[key] !== undefined) {
    return row[key];
  }

  const aliases: Record<
    string,
    string[]
  > = {
    department: [
      "department",
      "departmentName",
    ],
    program: [
      "program",
      "programName",
    ],
    academicYear: [
      "academicYear",
      "academicYearName",
    ],
    semester: [
      "semester",
      "semesterName",
    ],
    section: [
      "section",
      "sectionName",
    ],
    course: [
      "course",
      "courseName",
    ],
    role: [
      "role",
      "roleName",
      "roles",
    ],
    faculty: [
      "faculty",
      "facultyName",
    ],
    parent: [
      "parent",
      "parentName",
    ],
    student: [
      "student",
      "studentName",
    ],
    campus: [
      "campus",
      "campusName",
    ],
    facility: [
      "facility",
      "facilityName",
    ],
    asset: [
      "asset",
      "assetName",
    ],
  };

  for (
    const alias of aliases[key] ?? []
  ) {
    if (row[alias] !== undefined) {
      return row[alias];
    }
  }

  return undefined;
}

function transferTypeForEndpoint(endpoint: string): DataType | null {
  const value = endpoint.toLowerCase();
  if (value.includes("/users")) return "users";
  if (value.includes("/students")) return "students";
  if (value.includes("faculty")) return "faculty";
  if (value.includes("campus")) return "campuses";
  if (value.includes("department")) return "departments";
  if (value.includes("program")) return "programs";
  if (value.includes("academic-year")) return "academic-years";
  if (value.includes("semester")) return "semesters";
  if (value.includes("section")) return "sections";
  if (value.includes("course-offering")) return "course-offerings";
  if (value.includes("/courses")) return "courses";
  if (value.includes("timetable")) return "timetable";
  if (value.includes("notices")) return "notices";
  if (value.includes("attendance")) return "attendance";
  if (value.includes("marks")) return "marks";
  if (value.includes("fees")) return "fees";
  return null;
}

function permission(
  permissions: string[],
  key: string,
) {
  return permissions.includes(key);
}

function Header({
  item,
}: {
  item: AdminNavItem;
}) {
  return (
    <section className="relative overflow-hidden rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_18px_60px_rgba(15,23,42,0.07)] sm:p-8 [color-scheme:light]">
      <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-blue-100/60 blur-3xl" />

      <div className="relative">
        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-blue-600">
          {item.group}
        </p>

        <h1 className="mt-2 text-3xl font-black tracking-[-0.045em] text-slate-950 sm:text-4xl">
          {item.label}
        </h1>

        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-500">
          {item.description}
        </p>
      </div>
    </section>
  );
}

function R(
  title: string,
  description: string,
  endpoint: string,
  createFields: Field[],
  updateFields: Field[],
  columns: string[],
  filters: Filter[] = [],
  detailFields = columns,
): Resource {
  return {
    title,
    description,
    endpoint,
    createFields,
    updateFields,
    columns,
    filters,
    detailFields,
  };
}

function withCrud(
  resource: Resource,
  base: string,
  key: string,
): Resource {
  return {
    ...resource,

    updateEndpoint: (id) =>
      `${base}/${id}`,

    deleteEndpoint: (row) =>
      `${base}/${row.id}`,

    canCreate: (permissions) =>
      permission(
        permissions,
        `${key}.create`,
      ),

    canUpdate: (permissions) =>
      permission(
        permissions,
        `${key}.update`,
      ),

    canDelete: (permissions) =>
      permission(
        permissions,
        `${key}.delete`,
      ),
  };
}

function resource(
  module: string,
): Resource | null {
  switch (module) {
    case "users":
      return {
        ...R(
          "Institution users",
          "Manage institutional accounts, roles and account status.",
          "/users?page=1&pageSize=500",
          [
            {
              name: "firstName",
              label: "First name",
              required: true,
            },
            {
              name: "lastName",
              label: "Last name",
              required: true,
            },
            {
              name: "email",
              label: "Email",
              type: "email",
              required: true,
            },
            {
              name: "phone",
              label: "Phone",
            },
            {
              name: "password",
              label: "Temporary password",
              type: "password",
              required: true,
            },
            {
              name: "role",
              label: "Role",
              type: "select",
              options: ROLES,
              required: true,
            },
          ],
          [
            {
              name: "firstName",
              label: "First name",
            },
            {
              name: "lastName",
              label: "Last name",
            },
            {
              name: "phone",
              label: "Phone",
            },
            {
              name: "role",
              label: "Role",
              type: "select",
              options: ROLES,
            },
            {
              name: "isActive",
              label: "Active",
              type: "checkbox",
            },
          ],
          [
            "firstName",
            "lastName",
            "email",
            "role",
            "isActive",
          ],
          [
            {
              name: "role",
              label: "Role",
              options: ROLES,
            },
            {
              name: "isActive",
              label: "Status",
              options: [
                "true",
                "false",
              ],
            },
          ],
        ),

        updateEndpoint: (id) =>
          `/users/${id}`,

        deleteEndpoint: (row) =>
          `/users/${row.id}/status`,

        deleteMethod: "PATCH",

        deleteBody: () => ({
          isActive: false,
        }),

        canCreate: (p) =>
          permission(
            p,
            "users.create",
          ),

        canUpdate: (p) =>
          permission(
            p,
            "users.update",
          ),

        canDelete: (p) =>
          permission(
            p,
            "users.delete",
          ),
      };

    case "departments":
      return withCrud(
        R(
          "Departments",
          "Manage departments and optional campus ownership.",
          "/departments?page=1&pageSize=500",
          [
            {
              name: "name",
              label: "Name",
              required: true,
            },
            {
              name: "code",
              label: "Code",
              required: true,
            },
            {
              name: "campusId",
              label: "Campus",
              type: "select",
              source: "campuses",
            },
          ],
          [
            {
              name: "name",
              label: "Name",
            },
            {
              name: "code",
              label: "Code",
            },
            {
              name: "campusId",
              label: "Campus",
              type: "select",
              source: "campuses",
              nullableOnEmpty: true,
            },
            {
              name: "isActive",
              label: "Active",
              type: "checkbox",
            },
          ],
          [
            "name",
            "code",
            "campus",
            "isActive",
          ],
          [
            {
              name: "campusId",
              label: "Campus",
              source: "campuses",
            },
            {
              name: "isActive",
              label: "Status",
              options: [
                "true",
                "false",
              ],
            },
          ],
        ),
        "/departments",
        "departments",
      );

    case "programs":
      return withCrud(
        R(
          "Programs",
          "Manage program identity, level, duration and department ownership.",
          "/programs?page=1&pageSize=500",
          [
            {
              name: "departmentId",
              label: "Department",
              type: "select",
              source: "departments",
              required: true,
            },
            {
              name: "name",
              label: "Name",
              required: true,
            },
            {
              name: "code",
              label: "Code",
              required: true,
            },
            {
              name: "level",
              label: "Level",
              required: true,
            },
            {
              name: "durationYears",
              label: "Duration years",
              type: "number",
              required: true,
            },
          ],
          [
            {
              name: "departmentId",
              label: "Department",
              type: "select",
              source: "departments",
            },
            {
              name: "name",
              label: "Name",
            },
            {
              name: "code",
              label: "Code",
            },
            {
              name: "level",
              label: "Level",
            },
            {
              name: "durationYears",
              label: "Duration years",
              type: "number",
            },
            {
              name: "isActive",
              label: "Active",
              type: "checkbox",
            },
          ],
          [
            "name",
            "code",
            "level",
            "durationYears",
            "department",
            "isActive",
          ],
          [
            {
              name: "departmentId",
              label: "Department",
              source: "departments",
            },
            {
              name: "isActive",
              label: "Status",
              options: [
                "true",
                "false",
              ],
            },
          ],
        ),
        "/programs",
        "programs",
      );

    case "academic-years":
      return withCrud(
        R(
          "Academic years",
          "Manage academic-year windows and the institution's current year.",
          "/academic-years?page=1&pageSize=500",
          [
            {
              name: "name",
              label: "Name",
              required: true,
            },
            {
              name: "startDate",
              label: "Start date",
              type: "date",
              required: true,
            },
            {
              name: "endDate",
              label: "End date",
              type: "date",
              required: true,
            },
            {
              name: "isCurrent",
              label: "Current year",
              type: "checkbox",
            },
          ],
          [
            {
              name: "name",
              label: "Name",
            },
            {
              name: "startDate",
              label: "Start date",
              type: "date",
            },
            {
              name: "endDate",
              label: "End date",
              type: "date",
            },
            {
              name: "isCurrent",
              label: "Current year",
              type: "checkbox",
            },
          ],
          [
            "name",
            "startDate",
            "endDate",
            "isCurrent",
          ],
          [
            {
              name: "isCurrent",
              label: "Current",
              options: [
                "true",
                "false",
              ],
            },
          ],
        ),
        "/academic-years",
        "academic-years",
      );

    case "semesters":
      return withCrud(
        R(
          "Semesters",
          "Create semesters under a program and academic year. Those relationships are create-only because the backend update contract does not permit changing them.",
          "/semesters?page=1&pageSize=500",
          [
            {
              name: "programId",
              label: "Program",
              type: "select",
              source: "programs",
              required: true,
            },
            {
              name: "academicYearId",
              label: "Academic year",
              type: "select",
              source: "years",
              required: true,
            },
            {
              name: "number",
              label: "Number",
              type: "number",
              required: true,
            },
            {
              name: "name",
              label: "Name",
              required: true,
            },
            {
              name: "startDate",
              label: "Start date",
              type: "date",
            },
            {
              name: "endDate",
              label: "End date",
              type: "date",
            },
          ],
          [
            {
              name: "number",
              label: "Number",
              type: "number",
            },
            {
              name: "name",
              label: "Name",
            },
            {
              name: "startDate",
              label: "Start date",
              type: "date",
            },
            {
              name: "endDate",
              label: "End date",
              type: "date",
            },
            {
              name: "isActive",
              label: "Active",
              type: "checkbox",
            },
          ],
          [
            "name",
            "number",
            "program",
            "academicYear",
            "startDate",
            "endDate",
            "isActive",
          ],
          [
            {
              name: "programId",
              label: "Program",
              source: "programs",
            },
            {
              name: "academicYearId",
              label: "Academic year",
              source: "years",
            },
            {
              name: "isActive",
              label: "Status",
              options: [
                "true",
                "false",
              ],
            },
          ],
        ),
        "/semesters",
        "semesters",
      );

    case "sections":
      return withCrud(
        R(
          "Sections",
          "Manage class sections, semester assignment and capacity.",
          "/sections?page=1&pageSize=500",
          [
            {
              name: "semesterId",
              label: "Semester",
              type: "select",
              source: "semesters",
              required: true,
            },
            {
              name: "name",
              label: "Name",
              required: true,
            },
            {
              name: "capacity",
              label: "Capacity",
              type: "number",
            },
          ],
          [
            {
              name: "name",
              label: "Name",
            },
            {
              name: "capacity",
              label: "Capacity",
              type: "number",
            },
            {
              name: "isActive",
              label: "Active",
              type: "checkbox",
            },
          ],
          [
            "name",
            "semester",
            "capacity",
            "isActive",
          ],
          [
            {
              name: "semesterId",
              label: "Semester",
              source: "semesters",
            },
            {
              name: "isActive",
              label: "Status",
              options: [
                "true",
                "false",
              ],
            },
          ],
        ),
        "/sections",
        "sections",
      );

    case "courses":
      return withCrud(
        R(
          "Courses",
          "Manage the institutional course catalogue, credits and department ownership.",
          "/courses?page=1&pageSize=500",
          [
            {
              name: "departmentId",
              label: "Department",
              type: "select",
              source: "departments",
              required: true,
            },
            {
              name: "code",
              label: "Code",
              required: true,
            },
            {
              name: "name",
              label: "Name",
              required: true,
            },
            {
              name: "credits",
              label: "Credits",
              type: "number",
              required: true,
            },
            {
              name: "description",
              label: "Description",
              type: "textarea",
            },
          ],
          [
            {
              name: "departmentId",
              label: "Department",
              type: "select",
              source: "departments",
            },
            {
              name: "code",
              label: "Code",
            },
            {
              name: "name",
              label: "Name",
            },
            {
              name: "credits",
              label: "Credits",
              type: "number",
            },
            {
              name: "description",
              label: "Description",
              type: "textarea",
            },
            {
              name: "isActive",
              label: "Active",
              type: "checkbox",
            },
          ],
          [
            "code",
            "name",
            "credits",
            "department",
            "isActive",
          ],
          [
            {
              name: "departmentId",
              label: "Department",
              source: "departments",
            },
            {
              name: "isActive",
              label: "Status",
              options: [
                "true",
                "false",
              ],
            },
          ],
        ),
        "/courses",
        "courses",
      );

    case "course-offerings":
      return withCrud(
        R(
          "Course offerings",
          "Create an offering from course, semester and section. After creation only faculty assignment and active-state changes are permitted.",
          "/course-offerings?page=1&pageSize=500",
          [
            {
              name: "courseId",
              label: "Course",
              type: "select",
              source: "courses",
              required: true,
            },
            {
              name: "semesterId",
              label: "Semester",
              type: "select",
              source: "semesters",
              required: true,
            },
            {
              name: "sectionId",
              label: "Section",
              type: "select",
              source: "sections",
              required: true,
            },
            {
              name: "facultyId",
              label: "Faculty",
              type: "select",
              source: "faculty",
              nullableOnEmpty: true,
            },
          ],
          [
            {
              name: "facultyId",
              label: "Faculty",
              type: "select",
              source: "faculty",
              nullableOnEmpty: true,
            },
            {
              name: "isActive",
              label: "Active",
              type: "checkbox",
            },
          ],
          [
            "course",
            "semester",
            "section",
            "faculty",
            "isActive",
          ],
          [
            {
              name: "courseId",
              label: "Course",
              source: "courses",
            },
            {
              name: "semesterId",
              label: "Semester",
              source: "semesters",
            },
            {
              name: "sectionId",
              label: "Section",
              source: "sections",
            },
            {
              name: "facultyId",
              label: "Faculty",
              source: "faculty",
            },
            {
              name: "isActive",
              label: "Status",
              options: [
                "true",
                "false",
              ],
            },
          ],
        ),
        "/course-offerings",
        "course-offerings",
      );

    case "campuses":
      return withCrud(
        R(
          "Campuses",
          "Manage campus identity, code and address. Active state is update-only.",
          "/campuses?page=1&pageSize=500",
          [
            {
              name: "name",
              label: "Name",
              required: true,
            },
            {
              name: "code",
              label: "Code",
              required: true,
            },
            {
              name: "address",
              label: "Address",
              type: "textarea",
            },
          ],
          [
            {
              name: "name",
              label: "Name",
            },
            {
              name: "code",
              label: "Code",
            },
            {
              name: "address",
              label: "Address",
              type: "textarea",
              nullableOnEmpty: true,
            },
            {
              name: "isActive",
              label: "Active",
              type: "checkbox",
            },
          ],
          [
            "name",
            "code",
            "address",
            "isActive",
          ],
          [
            {
              name: "isActive",
              label: "Status",
              options: [
                "true",
                "false",
              ],
            },
          ],
        ),
        "/campuses",
        "campuses",
      );

    case "notices":
      return {
        ...R(
          "Notices",
          "Publish institution notices with audience, department targeting and expiry.",
          "/erp/notices?includeExpired=true",
          [
            {
              name: "title",
              label: "Title",
              required: true,
            },
            {
              name: "body",
              label: "Body",
              type: "textarea",
              required: true,
              span: 2,
            },
            {
              name: "audience",
              label: "Audience",
              type: "select",
              options: AUDIENCES,
            },
            {
              name: "departmentId",
              label: "Department",
              type: "select",
              source: "departments",
              nullableOnEmpty: true,
            },
            {
              name: "expiresAt",
              label: "Expires",
              type: "datetime-local",
              nullableOnEmpty: true,
            },
          ],
          [
            {
              name: "title",
              label: "Title",
            },
            {
              name: "body",
              label: "Body",
              type: "textarea",
              span: 2,
            },
            {
              name: "audience",
              label: "Audience",
              type: "select",
              options: AUDIENCES,
            },
            {
              name: "departmentId",
              label: "Department",
              type: "select",
              source: "departments",
              nullableOnEmpty: true,
            },
            {
              name: "expiresAt",
              label: "Expires",
              type: "datetime-local",
              nullableOnEmpty: true,
            },
          ],
          [
            "title",
            "audience",
            "department",
            "expiresAt",
            "createdAt",
          ],
          [
            {
              name: "audience",
              label: "Audience",
              options: AUDIENCES,
            },
          ],
        ),

        updateEndpoint: (id) =>
          `/erp/notices/${id}`,

        deleteEndpoint: (row) =>
          `/erp/notices/${row.id}`,

        canCreate: (p) =>
          permission(
            p,
            "notices.manage",
          ),

        canUpdate: (p) =>
          permission(
            p,
            "notices.manage",
          ),

        canDelete: (p) =>
          permission(
            p,
            "notices.manage",
          ),
      };

    case "calendar":
      return {
        ...R(
          "Calendar",
          "Manage academic and institutional events with audience, dates and academic-year context.",
          "/calendar/events?page=1&pageSize=500",
          [
            {
              name: "title",
              label: "Title",
              required: true,
            },
            {
              name: "description",
              label: "Description",
              type: "textarea",
              span: 2,
            },
            {
              name: "eventType",
              label: "Event type",
              type: "select",
              options: EVENT_TYPES,
            },
            {
              name: "audience",
              label: "Audience",
              type: "select",
              options: CALENDAR_AUDIENCES,
            },
            {
              name: "startDate",
              label: "Start",
              type: "datetime-local",
              required: true,
            },
            {
              name: "endDate",
              label: "End",
              type: "datetime-local",
              required: true,
            },
            {
              name: "academicYearId",
              label: "Academic year",
              type: "select",
              source: "years",
              nullableOnEmpty: true,
            },
          ],
          [
            {
              name: "title",
              label: "Title",
            },
            {
              name: "description",
              label: "Description",
              type: "textarea",
              span: 2,
            },
            {
              name: "eventType",
              label: "Event type",
              type: "select",
              options: EVENT_TYPES,
            },
            {
              name: "audience",
              label: "Audience",
              type: "select",
              options: CALENDAR_AUDIENCES,
            },
            {
              name: "startDate",
              label: "Start",
              type: "datetime-local",
            },
            {
              name: "endDate",
              label: "End",
              type: "datetime-local",
            },
            {
              name: "academicYearId",
              label: "Academic year",
              type: "select",
              source: "years",
              nullableOnEmpty: true,
            },
          ],
          [
            "title",
            "eventType",
            "audience",
            "startDate",
            "endDate",
          ],
          [
            {
              name: "eventType",
              label: "Type",
              options: EVENT_TYPES,
            },
            {
              name: "audience",
              label: "Audience",
              options: CALENDAR_AUDIENCES,
            },
            {
              name: "academicYearId",
              label: "Academic year",
              source: "years",
            },
          ],
        ),

        updateEndpoint: (id) =>
          `/calendar/events/${id}`,

        deleteEndpoint: (row) =>
          `/calendar/events/${row.id}`,

        canCreate: (p) =>
          permission(
            p,
            "calendar.manage",
          ),

        canUpdate: (p) =>
          permission(
            p,
            "calendar.manage",
          ),

        canDelete: (p) =>
          permission(
            p,
            "calendar.manage",
          ),
      };

    case "parent-links":
      return {
        ...R(
          "Parent links",
          "Connect parent accounts to student records and maintain relationship context.",
          "/erp/parent-links",
          [
            {
              name: "parentId",
              label: "Parent",
              type: "select",
              source: "parents",
              required: true,
            },
            {
              name: "studentId",
              label: "Student",
              type: "select",
              source: "students",
              required: true,
            },
            {
              name: "relationship",
              label: "Relationship",
            },
          ],
          [],
          [
            "parent",
            "student",
            "relationship",
            "createdAt",
          ],
          [],
        ),

        createEndpoint:
          "/erp/parent-links",

        deleteEndpoint: (row) =>
          `/erp/parent-links/${row.parentId}/${row.studentId}`,

        canCreate: (p) =>
          permission(
            p,
            "parent-links.manage",
          ),

        canDelete: (p) =>
          permission(
            p,
            "parent-links.manage",
          ),
      };

    default:
      return null;
  }
}

function FieldControl({
  field,
  value,
  setValue,
  lookups,
}: {
  field: Field;
  value: any;
  setValue: (value: any) => void;
  lookups: Record<
    string,
    Lookup[]
  >;
}) {
  if (
    field.type ===
    "textarea"
  ) {
    return (
      <textarea
        value={value ?? ""}
        onChange={(event) =>
          setValue(
            event.target.value,
          )
        }
        className={`${INPUT} min-h-32 resize-y`}
      />
    );
  }

  if (
    field.type ===
    "checkbox"
  ) {
    return (
      <label className="flex min-h-[50px] items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-800">
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(event) =>
            setValue(
              event.target.checked,
            )
          }
          className="h-5 w-5 accent-blue-600"
        />

        {field.label}
      </label>
    );
  }

  if (
    field.type ===
    "select"
  ) {
    return (
      <select
        value={value ?? ""}
        onChange={(event) =>
          setValue(
            event.target.value,
          )
        }
        className={INPUT}
      >
        <option value="">
          Select{" "}
          {field.label.toLowerCase()}
        </option>

        {field.options?.map(
          (option) => (
            <option
              key={option}
              value={option}
            >
              {option.replaceAll(
                "_",
                " ",
              )}
            </option>
          ),
        )}

        {field.source &&
          lookups[
            field.source
          ]?.map(
            (option) => (
              <option
                key={option.id}
                value={option.id}
              >
                {labelFor(option)}
              </option>
            ),
          )}
      </select>
    );
  }

  return (
    <input
      type={
        field.type ?? "text"
      }
      value={value ?? ""}
      onChange={(event) =>
        setValue(
          event.target.value,
        )
      }
      className={INPUT}
    />
  );
}

function Detail({
  row,
  fields,
  onClose,
  canEdit = false,
  onEdit,
}: {
  row: Row;
  fields: string[];
  onClose: () => void;
  canEdit?: boolean;
  onEdit?: () => void;
}) {
  const title = text(row.name ?? row.title ?? row.email ?? row.code ?? row.id);
  const subtitle = text(row.code ?? row.email ?? row.id);

  return (
    <DetailDrawer
      title={title}
      subtitle={subtitle !== title ? subtitle : undefined}
      onClose={onClose}
      canEdit={canEdit}
      onEdit={onEdit}
    >
      {fields.map((field) => {
        const value = rowValue(row, field);
        const dateOnly = isDateOnlyField(field);
        const timestamp = isTimestampField(field);

        return (
          <DetailField
            key={field}
            label={displayColumn(field)}
            value={dateOnly || timestamp ? dateText(value, field) : text(value)}
            tone={
              field.toLowerCase().includes("status") && String(value).toLowerCase() === "active"
                ? "success"
                : "default"
            }
          />
        );
      })}
    </DetailDrawer>
  );
}

function toInputDate(
  value: any,
  type:
    | "date"
    | "datetime-local",
): string {
  if (!value) return "";

  if (type === "date") {
    const raw = String(value);
    const match = raw.match(/^\d{4}-\d{2}-\d{2}/);
    if (match) return match[0];

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const local = new Date(
    date.getTime() -
      date.getTimezoneOffset() *
        60000,
  );

  return local
    .toISOString()
    .slice(0, 16);
}

function ResourceManager({
  def,
  permissions,
}: {
  def: Resource;
  permissions: string[];
}) {
  const [data, setData] =
    useState<Row[]>([]);

  const [
    lookups,
    setLookups,
  ] = useState<
    Record<string, Lookup[]>
  >({});

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  const [search, setSearch] =
    useState("");

  const [
    filters,
    setFilters,
  ] = useState<
    Record<string, string>
  >({});

  const [
    selected,
    setSelected,
  ] = useState<Row | null>(
    null,
  );

  const [open, setOpen] =
    useState(false);

  const [
    editing,
    setEditing,
  ] = useState<Row | null>(
    null,
  );

  const [form, setForm] =
    useState<Row>({});

  const canCreate =
    def.canCreate?.(
      permissions,
    ) ?? false;

  const canUpdate =
    def.canUpdate?.(
      permissions,
    ) ?? false;

  const canDelete =
    def.canDelete?.(
      permissions,
    ) ?? false;

  const fields = editing
    ? def.updateFields
    : def.createFields;

  const sources = useMemo(
    () =>
      [
        ...new Set(
          [
            ...def.createFields,
            ...def.updateFields,
          ]
            .map(
              (field) =>
                field.source,
            )
            .filter(
              Boolean,
            ) as string[],
        ),
      ],
    [
      def.createFields,
      def.updateFields,
    ],
  );

  async function load() {
    setLoading(true);
    setError("");

    try {
      const response =
        await authedFetch<any>(
          def.endpoint,
        );

      setData(
        rowsOf(
          response.data,
        ),
      );
    } catch (
      reason
    ) {
      setError(
        reason instanceof
          Error
          ? reason.message
          : "Unable to load records.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadLookups() {
    const pairs =
      await Promise.all(
        sources.map(
          async (
            source,
          ) => {
            const endpoint =
              LOOKUPS[
                source
              ];

            if (!endpoint) {
              return [
                source,
                [],
              ] as const;
            }

            try {
              const response =
                await authedFetch<any>(
                  endpoint,
                );

              return [
                source,
                rowsOf(
                  response.data,
                ),
              ] as const;
            } catch {
              return [
                source,
                [],
              ] as const;
            }
          },
        ),
      );

    setLookups(
      Object.fromEntries(
        pairs,
      ),
    );
  }

  useEffect(
    () => {
      void Promise.all([
        load(),
        loadLookups(),
      ]);
    },
    [def.endpoint],
  );

  const filtered =
    useMemo(
      () =>
        data.filter(
          (row) => {
            const query =
              search
                .trim()
                .toLowerCase();

            if (
              query &&
              !Object.values(
                row,
              ).some(
                (value) =>
                  text(
                    value,
                  )
                    .toLowerCase()
                    .includes(
                      query,
                    ),
              )
            ) {
              return false;
            }

            return Object.entries(
              filters,
            ).every(
              ([
                key,
                value,
              ]) => {
                if (!value) {
                  return true;
                }

                const actual =
                  rowValue(
                    row,
                    key,
                  );

                if (
                  value ===
                    "true" ||
                  value ===
                    "false"
                ) {
                  return (
                    String(
                      Boolean(
                        actual,
                      ),
                    ) ===
                    value
                  );
                }

                return (
                  relationId(
                    actual,
                  ) ===
                    value ||
                  text(
                    actual,
                  ) ===
                    value
                );
              },
            );
          },
        ),
      [
        data,
        search,
        filters,
      ],
    );

  function openCreate() {
    setEditing(null);
    setForm({});
    setError("");
    setSuccess("");
    setOpen(true);
  }

  function openEdit(row: Row) {
    const next: Row =
      {};

    for (
      const field of
        def.updateFields
    ) {
      const value =
        rowValue(
          row,
          field.name,
        ) ??
        row[
          field.name
        ];

      next[
        field.name
      ] =
        field.type ===
          "select" &&
        field.source
          ? relationId(
              value,
            )
          : field.type ===
                "date" ||
              field.type ===
                "datetime-local"
            ? toInputDate(
                value,
                field.type,
              )
            : value ??
              "";
    }

    setEditing(row);
    setForm(next);
    setError("");
    setSuccess("");
    setOpen(true);
  }

  function buildPayload() {
    const output: Row =
      {};

    for (
      const field of
        fields
    ) {
      let value =
        form[
          field.name
        ];

      if (
        field.type ===
          "number" &&
        value !== "" &&
        value !== undefined
      ) {
        value =
          Number(value);
      }

      if (
        field.type ===
          "datetime-local" &&
        value
      ) {
        value =
          new Date(
            value,
          ).toISOString();
      }

      if (
        value === "" ||
        value === undefined
      ) {
        if (
          editing &&
          field.nullableOnEmpty
        ) {
          output[
            field.name
          ] = null;
        }

        continue;
      }

      output[
        field.name
      ] = value;
    }

    return output;
  }

  async function save(
    event: FormEvent,
  ) {
    event.preventDefault();
    setError("");

    for (
      const field of
        fields
    ) {
      if (
        field.required &&
        (
          form[
            field.name
          ] ===
            undefined ||
          form[
            field.name
          ] === "" ||
          form[
            field.name
          ] === null
        )
      ) {
        setError(
          `${field.label} is required.`,
        );

        return;
      }
    }

    if (
      form.startDate &&
      form.endDate &&
      new Date(
        form.endDate,
      ) <
        new Date(
          form.startDate,
        )
    ) {
      setError(
        "End date/time cannot be before the start date/time.",
      );

      return;
    }

    setSaving(true);

    try {
      const endpoint =
        editing
          ? def.updateEndpoint?.(
              editing.id as string,
            )
          : def.createEndpoint ||
            def.endpoint.split(
              "?",
            )[0];

      if (!endpoint) {
        throw new Error(
          "This operation is not available.",
        );
      }

      await authedFetch(
        endpoint,
        {
          method:
            editing
              ? "PATCH"
              : "POST",
          body:
            JSON.stringify(
              buildPayload(),
            ),
        },
      );

      setOpen(false);

      setSuccess(
        editing
          ? "Record updated successfully."
          : "Record created successfully.",
      );

      await load();
    } catch (
      reason
    ) {
      setError(
        reason instanceof
          Error
          ? reason.message
          : "Unable to save record.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function remove(
    row: Row,
  ) {
    if (
      !def.deleteEndpoint ||
      !window.confirm(
        `Remove ${text(
          row.name ??
            row.title ??
            row.email ??
            row.code ??
            row.id,
        )}?`,
      )
    ) {
      return;
    }

    setSaving(true);
    setError("");

    try {
      await authedFetch(
        def.deleteEndpoint(
          row,
        ),
        {
          method:
            def.deleteMethod ??
            "DELETE",
          body:
            def.deleteBody
              ? JSON.stringify(
                  def.deleteBody(
                    row,
                  ),
                )
              : undefined,
        },
      );

      setSuccess(
        "Record removed or deactivated.",
      );

      await load();
    } catch (
      reason
    ) {
      setError(
        reason instanceof
          Error
          ? reason.message
          : "Unable to remove record.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="overflow-hidden rounded-[30px] border border-slate-200 bg-white text-slate-900 shadow-[0_14px_45px_rgba(15,23,42,0.06)] [color-scheme:light]">
      <div className="border-b border-slate-100 p-5 sm:p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
              Management workspace
            </p>

            <h2 className="mt-1 text-xl font-black text-slate-950">
              {def.title}
            </h2>

            <p className="mt-1 text-xs text-slate-500">
              {filtered.length}{" "}
              visible of{" "}
              {data.length}{" "}
              records
            </p>
          </div>

          {canCreate && (
            <button
              type="button"
              className={
                BUTTON
              }
              onClick={
                openCreate
              }
            >
              + Create
            </button>
          )}
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(240px,1fr)_repeat(3,minmax(150px,220px))_auto]">
          <input
            value={search}
            onChange={(event) =>
              setSearch(
                event.target.value,
              )
            }
            placeholder={`Search ${def.title.toLowerCase()}…`}
            className={INPUT}
          />

          {def.filters
            ?.slice(0, 3)
            .map(
              (filter) => (
                <select
                  key={
                    filter.name
                  }
                  value={
                    filters[
                      filter.name
                    ] ?? ""
                  }
                  onChange={(
                    event,
                  ) =>
                    setFilters(
                      (
                        current,
                      ) => ({
                        ...current,
                        [filter.name]:
                          event
                            .target
                            .value,
                      }),
                    )
                  }
                  className={
                    INPUT
                  }
                >
                  <option value="">
                    All{" "}
                    {filter.label.toLowerCase()}
                  </option>

                  {filter.options?.map(
                    (option) => (
                      <option
                        key={
                          option
                        }
                        value={
                          option
                        }
                      >
                        {option.replaceAll(
                          "_",
                          " ",
                        )}
                      </option>
                    ),
                  )}

                  {filter.source &&
                    lookups[
                      filter.source
                    ]?.map(
                      (
                        option,
                      ) => (
                        <option
                          key={
                            option.id
                          }
                          value={
                            option.id
                          }
                        >
                          {labelFor(
                            option,
                          )}
                        </option>
                      ),
                    )}
                </select>
              ),
            )}

          <button
            type="button"
            className={
              SECONDARY
            }
            onClick={() => {
              setSearch("");
              setFilters({});
            }}
          >
            Reset
          </button>
        </div>

        {transferTypeForEndpoint(def.endpoint) ? (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-blue-200 bg-blue-50/70 p-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-blue-700">Data transfer</p>
              <p className="mt-1 text-xs font-semibold text-slate-600">Import validated records or export the current resource.</p>
            </div>
            <DataTransferActions type={transferTypeForEndpoint(def.endpoint)!} compact />
          </div>
        ) : null}
      </div>

      {error && (
        <div className="mx-5 mt-5 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700">
          {error}
        </div>
      )}

      {success && (
        <div className="mx-5 mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-700">
          {success}
        </div>
      )}

      {loading ? (
        <div className="grid gap-3 p-5 md:grid-cols-3">
          {[1, 2, 3].map(
            (item) => (
              <div
                key={item}
                className="h-24 animate-pulse rounded-2xl bg-slate-100"
              />
            ),
          )}
        </div>
      ) : filtered.length ===
        0 ? (
        <div className="p-12 text-center">
          <p className="font-black text-slate-800">
            No records match the
            current view.
          </p>

          <p className="mt-1 text-sm text-slate-500">
            Clear the filters or
            create a new record.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
              <tr>
                {def.columns.map(
                  (column) => (
                    <th
                      key={
                        column
                      }
                      className="px-5 py-4"
                    >
                      {displayColumn(
                        column,
                      )}
                    </th>
                  ),
                )}

                <th className="px-5 py-4 text-right">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {filtered.map(
                (
                  row,
                  index,
                ) => (
                  <tr
                    key={
                      row.id ??
                      index
                    }
                    className="hover:bg-blue-50/30"
                  >
                    {def.columns.map(
                      (
                        column,
                      ) => {
                        const value =
                          rowValue(
                            row,
                            column,
                          );

                        return (
                          <td
                            key={
                              column
                            }
                            className="max-w-[280px] truncate px-5 py-4 font-medium text-slate-700"
                          >
                            {column
                              .toLowerCase()
                              .includes(
                                "date",
                              ) ||
                            column
                              .toLowerCase()
                              .endsWith(
                                "at",
                              )
                              ? dateText(
                                  value,
                                  column,
                                )
                              : text(
                                  value,
                                )}
                          </td>
                        );
                      },
                    )}

                    <td className="whitespace-nowrap px-5 py-4 text-right">
                      <button
                        type="button"
                        className="mr-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-black"
                        onClick={() =>
                          setSelected(
                            row,
                          )
                        }
                      >
                        View
                      </button>

                      {canUpdate && (
                        <button
                          type="button"
                          className="mr-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-black"
                          onClick={() =>
                            openEdit(
                              row,
                            )
                          }
                        >
                          Edit
                        </button>
                      )}

                      {canDelete && (
                        <button
                          type="button"
                          disabled={
                            saving
                          }
                          className="rounded-xl border border-rose-200 px-3 py-2 text-xs font-black text-rose-600"
                          onClick={() =>
                            void remove(
                              row,
                            )
                          }
                        >
                          Remove
                        </button>
                      )}
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <Detail
          row={selected}
          fields={
            def.detailFields ??
            def.columns
          }
          onClose={() =>
            setSelected(
              null,
            )
          }
          canEdit={canUpdate}
          onEdit={() => {
            setSelected(null);
            openEdit(selected);
          }}
        />
      )}

      {open && (
        <div className="fixed inset-0 z-[100] overflow-y-auto bg-slate-950/60 p-4 backdrop-blur-sm [color-scheme:light]">
          <div className="mx-auto my-8 max-w-4xl overflow-hidden rounded-[30px] bg-slate-50 text-slate-900 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-5">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-600">
                  {editing
                    ? "Update"
                    : "Create"}
                </p>

                <h3 className="mt-1 text-2xl font-black">
                  {def.title}
                </h3>

                <p className="mt-1 text-xs text-slate-500">
                  Only fields supported
                  by the backend{" "}
                  {editing
                    ? "update"
                    : "create"}{" "}
                  contract are shown.
                </p>
              </div>

              <button
                type="button"
                className={
                  SECONDARY
                }
                onClick={() =>
                  setOpen(
                    false,
                  )
                }
              >
                Close
              </button>
            </div>

            <form
              onSubmit={save}
              className="space-y-5 p-5 sm:p-6"
            >
              <div className="grid gap-4 md:grid-cols-2">
                {fields.map(
                  (field) => (
                    <label
                      key={
                        field.name
                      }
                      className={
                        field.span ===
                          2 ||
                        field.type ===
                          "textarea"
                          ? "md:col-span-2"
                          : ""
                      }
                    >
                      <span className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
                        {
                          field.label
                        }

                        {field.required
                          ? " *"
                          : ""}
                      </span>

                      <FieldControl
                        field={
                          field
                        }
                        value={
                          form[
                            field.name
                          ]
                        }
                        setValue={(
                          value,
                        ) =>
                          setForm(
                            (
                              current,
                            ) => ({
                              ...current,
                              [field.name]:
                                value,
                            }),
                          )
                        }
                        lookups={
                          lookups
                        }
                      />
                    </label>
                  ),
                )}
              </div>

              {error && (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700">
                  {error}
                </div>
              )}

              <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
                <button
                  type="button"
                  className={
                    SECONDARY
                  }
                  onClick={() =>
                    setOpen(
                      false,
                    )
                  }
                >
                  Cancel
                </button>

                <button
                  disabled={
                    saving
                  }
                  className={
                    BUTTON
                  }
                >
                  {saving
                    ? "Saving…"
                    : editing
                      ? "Save changes"
                      : "Create record"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}

function Documents({
  permissions,
}: {
  permissions: string[];
}) {
  const [
    students,
    setStudents,
  ] = useState<Lookup[]>(
    [],
  );

  const [student, setStudent] =
    useState("");

  const [
    documents,
    setDocuments,
  ] = useState<Row[]>([]);

  const [form, setForm] =
    useState({
      title: "",
      type: "",
      url: "",
    });

  const [loading, setLoading] =
    useState(false);

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState("");

  const canManage =
    permission(
      permissions,
      "students.update",
    );

  useEffect(
    () => {
      void authedFetch<any>(
        "/students?page=1&pageSize=500",
      )
        .then((response) =>
          setStudents(
            rowsOf(
              response.data,
            ),
          ),
        )
        .catch(() =>
          setStudents([]),
        );
    },
    [],
  );

  useEffect(
    () => {
      void load();
    },
    [student],
  );

  async function load() {
    if (!student) {
      setDocuments([]);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response =
        await authedFetch<any>(
          `/portal/documents/students/${student}`,
        );

      setDocuments(
        rowsOf(
          response.data,
        ),
      );
    } catch (
      reason
    ) {
      setError(
        reason instanceof
          Error
          ? reason.message
          : "Unable to load documents.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function save(
    event: FormEvent,
  ) {
    event.preventDefault();

    if (!student) return;

    setSaving(true);
    setError("");

    try {
      await authedFetch(
        "/portal/documents",
        {
          method: "POST",
          body:
            JSON.stringify({
              ownerId: student,
              ...form,
            }),
        },
      );

      setForm({
        title: "",
        type: "",
        url: "",
      });

      await load();
    } catch (
      reason
    ) {
      setError(
        reason instanceof
          Error
          ? reason.message
          : "Unable to create document.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function remove(
    id: string,
  ) {
    if (
      !window.confirm(
        "Delete this document?",
      )
    ) {
      return;
    }

    setSaving(true);

    try {
      await authedFetch(
        `/portal/documents/${id}`,
        {
          method: "DELETE",
        },
      );

      await load();
    } catch (
      reason
    ) {
      setError(
        reason instanceof
          Error
          ? reason.message
          : "Unable to delete document.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5 [color-scheme:light]">
      <section className="rounded-[30px] border border-slate-200 bg-white p-5 text-slate-900 shadow-sm">
        <label>
          <span className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-slate-500">
            Student
          </span>

          <select
            value={student}
            onChange={(event) =>
              setStudent(
                event.target
                  .value,
              )
            }
            className={INPUT}
          >
            <option value="">
              Select student
            </option>

            {students.map(
              (item) => (
                <option
                  key={
                    item.id
                  }
                  value={
                    item.id
                  }
                >
                  {labelFor(
                    item,
                  )}
                </option>
              ),
            )}
          </select>
        </label>
      </section>

      {student &&
        canManage && (
          <form
            onSubmit={save}
            className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div className="grid gap-4 md:grid-cols-3">
              <input
                required
                placeholder="Title"
                value={
                  form.title
                }
                onChange={(
                  event,
                ) =>
                  setForm({
                    ...form,
                    title:
                      event
                        .target
                        .value,
                  })
                }
                className={
                  INPUT
                }
              />

              <input
                required
                placeholder="Document type"
                value={
                  form.type
                }
                onChange={(
                  event,
                ) =>
                  setForm({
                    ...form,
                    type:
                      event
                        .target
                        .value,
                  })
                }
                className={
                  INPUT
                }
              />

              <input
                required
                type="url"
                placeholder="Document URL"
                value={
                  form.url
                }
                onChange={(
                  event,
                ) =>
                  setForm({
                    ...form,
                    url:
                      event
                        .target
                        .value,
                  })
                }
                className={
                  INPUT
                }
              />
            </div>

            <div className="mt-4 flex justify-end">
              <button
                disabled={
                  saving
                }
                className={
                  BUTTON
                }
              >
                {saving
                  ? "Adding…"
                  : "Add document"}
              </button>
            </div>
          </form>
        )}

      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700">
          {error}
        </div>
      )}

      <section className="overflow-hidden rounded-[30px] border border-slate-200 bg-white text-slate-900">
        {loading ? (
          <div className="h-40 animate-pulse bg-slate-100" />
        ) : documents.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-400">
                <tr>
                  <th className="px-5 py-4">
                    Title
                  </th>
                  <th className="px-5 py-4">
                    Type
                  </th>
                  <th className="px-5 py-4">
                    Created
                  </th>
                  <th className="px-5 py-4 text-right">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {documents.map(
                  (document) => (
                    <tr
                      key={
                        document.id
                      }
                    >
                      <td className="px-5 py-4 font-bold">
                        {text(
                          document.title,
                        )}
                      </td>

                      <td className="px-5 py-4">
                        {text(
                          document.type,
                        )}
                      </td>

                      <td className="px-5 py-4">
                        {dateText(
                          document.createdAt,
                        )}
                      </td>

                      <td className="px-5 py-4 text-right">
                        <a
                          href={
                            document.url
                          }
                          target="_blank"
                          rel="noreferrer"
                          className="mr-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-black"
                        >
                          Open
                        </a>

                        {canManage &&
                          document.id && (
                            <button
                              disabled={
                                saving
                              }
                              onClick={() =>
                                void remove(
                                  document.id as string,
                                )
                              }
                              className="rounded-xl border border-rose-200 px-3 py-2 text-xs font-black text-rose-600"
                            >
                              Delete
                            </button>
                          )}
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-10 text-center text-sm text-slate-500">
            {student
              ? "No documents for this student."
              : "Select a student to manage documents."}
          </div>
        )}
      </section>
    </div>
  );
}

function Notifications({
  permissions,
}: {
  permissions: string[];
}) {
  const [
    users,
    setUsers,
  ] = useState<Lookup[]>([]);

  const [
    selectedUsers,
    setSelectedUsers,
  ] = useState<string[]>(
    [],
  );

  const [
    form,
    setForm,
  ] = useState({
    title: "",
    body: "",
  });

  const [
    history,
    setHistory,
  ] = useState<Row[]>([]);

  const [
    mode,
    setMode,
  ] = useState<
    "individual" | "bulk"
  >("individual");

  const [
    recipient,
    setRecipient,
  ] = useState("");

  const [
    error,
    setError,
  ] = useState("");

  const [
    saving,
    setSaving,
  ] = useState(false);

  const canManage =
    permission(
      permissions,
      "notices.manage",
    );

  useEffect(
    () => {
      void Promise.all([
        loadUsers(),
        loadHistory(),
      ]);
    },
    [],
  );

  async function loadUsers() {
    try {
      const response =
        await authedFetch<any>(
          "/users?page=1&pageSize=500",
        );

      setUsers(
        rowsOf(
          response.data,
        ),
      );
    } catch {
      setUsers([]);
    }
  }

  async function loadHistory() {
    try {
      const response =
        await authedFetch<any>(
          "/portal/notifications?page=1&limit=200",
        );

      setHistory(
        rowsOf(
          response.data,
        ),
      );
    } catch {
      setHistory([]);
    }
  }

  async function send(
    event: FormEvent,
  ) {
    event.preventDefault();
    setError("");

    const userIds =
      mode === "individual"
        ? recipient
          ? [recipient]
          : []
        : selectedUsers;

    if (!userIds.length) {
      setError(
        "Select at least one recipient.",
      );

      return;
    }

    setSaving(true);

    try {
      await authedFetch(
        mode === "bulk"
          ? "/portal/notifications/bulk"
          : "/portal/notifications",
        {
          method: "POST",
          body:
            JSON.stringify(
              mode === "bulk"
                ? {
                    userIds,
                    ...form,
                  }
                : {
                    userId:
                      userIds[0],
                    ...form,
                  },
            ),
        },
      );

      setForm({
        title: "",
        body: "",
      });

      setRecipient("");
      setSelectedUsers([]);

      await loadHistory();
    } catch (
      reason
    ) {
      setError(
        reason instanceof
          Error
          ? reason.message
          : "Unable to send notification.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5 [color-scheme:light]">
      <section className="rounded-[30px] border border-slate-200 bg-white p-5 text-slate-900 shadow-sm">
        <div className="mb-5 grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1">
          <button
            type="button"
            onClick={() =>
              setMode(
                "individual",
              )
            }
            className={`rounded-xl px-3 py-3 text-sm font-black ${
              mode ===
              "individual"
                ? "bg-blue-600 text-white"
                : "text-slate-600"
            }`}
          >
            Individual
          </button>

          <button
            type="button"
            onClick={() =>
              setMode("bulk")
            }
            className={`rounded-xl px-3 py-3 text-sm font-black ${
              mode === "bulk"
                ? "bg-blue-600 text-white"
                : "text-slate-600"
            }`}
          >
            Bulk
          </button>
        </div>

        {canManage ? (
          <form
            onSubmit={send}
            className="space-y-4"
          >
            {mode ===
            "individual" ? (
              <select
                required
                value={recipient}
                onChange={(
                  event,
                ) =>
                  setRecipient(
                    event
                      .target
                      .value,
                  )
                }
                className={
                  INPUT
                }
              >
                <option value="">
                  Select recipient
                </option>

                {users.map(
                  (user) => (
                    <option
                      key={
                        user.id
                      }
                      value={
                        user.id
                      }
                    >
                      {labelFor(
                        user,
                      )}
                    </option>
                  ),
                )}
              </select>
            ) : (
              <select
                multiple
                value={
                  selectedUsers
                }
                onChange={(
                  event,
                ) =>
                  setSelectedUsers(
                    Array.from(
                      event
                        .target
                        .selectedOptions,
                      (
                        option,
                      ) =>
                        option.value,
                    ),
                  )
                }
                className={`${INPUT} min-h-48`}
              >
                {users.map(
                  (user) => (
                    <option
                      key={
                        user.id
                      }
                      value={
                        user.id
                      }
                    >
                      {labelFor(
                        user,
                      )}
                    </option>
                  ),
                )}
              </select>
            )}

            <input
              required
              value={form.title}
              onChange={(event) =>
                setForm({
                  ...form,
                  title:
                    event.target
                      .value,
                })
              }
              placeholder="Notification title"
              className={
                INPUT
              }
            />

            <textarea
              required
              value={form.body}
              onChange={(event) =>
                setForm({
                  ...form,
                  body:
                    event.target
                      .value,
                })
              }
              placeholder="Message"
              className={`${INPUT} min-h-32`}
            />

            {error && (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700">
                {error}
              </div>
            )}

            <div className="flex justify-end">
              <button
                disabled={
                  saving
                }
                className={
                  BUTTON
                }
              >
                {saving
                  ? "Sending…"
                  : mode ===
                      "bulk"
                    ? "Send to recipients"
                    : "Send notification"}
              </button>
            </div>
          </form>
        ) : (
          <p className="text-sm text-slate-500">
            Your account does not have notification-management permission.
          </p>
        )}
      </section>

      <section className="overflow-hidden rounded-[30px] border border-slate-200 bg-white text-slate-900">
        <div className="border-b border-slate-100 p-5">
          <h2 className="text-xl font-black">
            Notification history
          </h2>
        </div>

        {history.length ? (
          <div className="divide-y divide-slate-100">
            {history.map(
              (notification) => (
                <div
                  key={
                    notification.id
                  }
                  className="p-5"
                >
                  <p className="font-black">
                    {text(
                      notification.title,
                    )}
                  </p>

                  <p className="mt-1 text-sm text-slate-500">
                    {text(
                      notification.body,
                    )}
                  </p>

                  <p className="mt-2 text-xs text-slate-400">
                    {dateText(
                      notification.createdAt,
                    )}
                  </p>
                </div>
              ),
            )}
          </div>
        ) : (
          <div className="p-10 text-center text-sm text-slate-500">
            No notification history available.
          </div>
        )}
      </section>
    </div>
  );
}

function Operations({
  permissions,
}: {
  permissions: string[];
}) {
  const [
    tab,
    setTab,
  ] = useState<
    | "categories"
    | "assets"
    | "facilities"
    | "maintenance"
  >("assets");

  const definitions: Record<
    typeof tab,
    Resource
  > = {
    categories: {
      ...R(
        "Asset categories",
        "Manage reusable asset categories.",
        "/operations/asset-categories",
        [
          {
            name: "name",
            label: "Name",
            required: true,
          },
          {
            name: "code",
            label: "Code",
            required: true,
          },
        ],
        [
          {
            name: "name",
            label: "Name",
          },
          {
            name: "code",
            label: "Code",
          },
        ],
        [
          "name",
          "code",
        ],
        [],
      ),

      canCreate: (p) =>
        permission(
          p,
          "operations.manage",
        ),
    },

    assets: {
      ...R(
        "Assets",
        "Manage operational inventory and asset lifecycle.",
        "/operations/assets?page=1&pageSize=500",
        [
          {
            name: "name",
            label: "Name",
            required: true,
          },
          {
            name: "assetTag",
            label: "Asset tag",
            required: true,
          },
          {
            name: "assetCategoryId",
            label: "Category",
            type: "select",
            source:
              "assetCategories",
          },
          {
            name: "campusId",
            label: "Campus",
            type: "select",
            source:
              "campuses",
          },
          {
            name: "departmentId",
            label: "Department",
            type: "select",
            source:
              "departments",
          },
          {
            name: "serialNumber",
            label: "Serial number",
          },
          {
            name: "location",
            label: "Location",
          },
          {
            name: "quantity",
            label: "Quantity",
            type: "number",
          },
          {
            name: "unitCost",
            label: "Unit cost",
            type: "number",
          },
          {
            name: "purchaseDate",
            label: "Purchase date",
            type: "date",
          },
          {
            name: "warrantyEndsAt",
            label: "Warranty ends",
            type: "date",
          },
          {
            name: "condition",
            label: "Condition",
            type: "select",
            options:
              CONDITIONS,
          },
          {
            name: "status",
            label: "Status",
            type: "select",
            options:
              ASSET_STATUSES,
          },
          {
            name: "assignedToId",
            label: "Assigned to",
            type: "select",
            source: "users",
            nullableOnEmpty: true,
          },
          {
            name: "notes",
            label: "Notes",
            type: "textarea",
            span: 2,
          },
        ],
        [
          {
            name: "name",
            label: "Name",
          },
          {
            name: "location",
            label: "Location",
          },
          {
            name: "quantity",
            label: "Quantity",
            type: "number",
          },
          {
            name: "condition",
            label: "Condition",
            type: "select",
            options:
              CONDITIONS,
          },
          {
            name: "status",
            label: "Status",
            type: "select",
            options:
              ASSET_STATUSES,
          },
          {
            name: "departmentId",
            label: "Department",
            type: "select",
            source:
              "departments",
            nullableOnEmpty: true,
          },
          {
            name: "assignedToId",
            label: "Assigned to",
            type: "select",
            source: "users",
            nullableOnEmpty: true,
          },
          {
            name: "notes",
            label: "Notes",
            type: "textarea",
            span: 2,
          },
        ],
        [
          "name",
          "assetTag",
          "status",
          "condition",
          "location",
        ],
        [
          {
            name: "status",
            label: "Status",
            options:
              ASSET_STATUSES,
          },
          {
            name: "departmentId",
            label: "Department",
            source:
              "departments",
          },
        ],
      ),

      updateEndpoint: (id) =>
        `/operations/assets/${id}`,

      canCreate: (p) =>
        permission(
          p,
          "operations.manage",
        ),

      canUpdate: (p) =>
        permission(
          p,
          "operations.manage",
        ),
    },

    facilities: {
      ...R(
        "Facilities",
        "Manage institutional facilities and capacity.",
        "/operations/facilities?includeInactive=true",
        [
          {
            name: "name",
            label: "Name",
            required: true,
          },
          {
            name: "code",
            label: "Code",
            required: true,
          },
          {
            name: "facilityType",
            label: "Type",
            type: "select",
            options:
              FACILITY_TYPES,
          },
          {
            name: "capacity",
            label: "Capacity",
            type: "number",
          },
          {
            name: "campusId",
            label: "Campus",
            type: "select",
            source:
              "campuses",
          },
          {
            name: "location",
            label: "Location",
          },
        ],
        [
          {
            name: "name",
            label: "Name",
          },
          {
            name: "facilityType",
            label: "Type",
            type: "select",
            options:
              FACILITY_TYPES,
          },
          {
            name: "capacity",
            label: "Capacity",
            type: "number",
          },
          {
            name: "location",
            label: "Location",
          },
          {
            name: "isActive",
            label: "Active",
            type: "checkbox",
          },
        ],
        [
          "name",
          "code",
          "facilityType",
          "capacity",
          "location",
        ],
        [
          {
            name: "facilityType",
            label: "Type",
            options:
              FACILITY_TYPES,
          },
        ],
      ),

      updateEndpoint: (id) =>
        `/operations/facilities/${id}`,

      canCreate: (p) =>
        permission(
          p,
          "operations.manage",
        ),

      canUpdate: (p) =>
        permission(
          p,
          "operations.manage",
        ),
    },

    maintenance: {
      ...R(
        "Maintenance",
        "Manage maintenance requests, priority, assignment, status and resolution.",
        "/operations/maintenance?page=1&pageSize=500",
        [
          {
            name: "facilityId",
            label: "Facility",
            type: "select",
            source:
              "facilities",
            nullableOnEmpty: true,
          },
          {
            name: "assetId",
            label: "Asset",
            type: "select",
            source: "assets",
            nullableOnEmpty: true,
          },
          {
            name: "title",
            label: "Title",
            required: true,
          },
          {
            name: "description",
            label: "Description",
            type: "textarea",
            required: true,
            span: 2,
          },
          {
            name: "priority",
            label: "Priority",
            type: "select",
            options:
              PRIORITIES,
          },
        ],
        [
          {
            name: "status",
            label: "Status",
            type: "select",
            options:
              MAINTENANCE_STATUS,
          },
          {
            name: "assignedToId",
            label: "Assigned to",
            type: "select",
            source: "users",
            nullableOnEmpty: true,
          },
          {
            name: "resolutionNote",
            label: "Resolution note",
            type: "textarea",
            span: 2,
          },
          {
            name: "priority",
            label: "Priority",
            type: "select",
            options:
              PRIORITIES,
          },
        ],
        [
          "title",
          "priority",
          "status",
          "createdAt",
        ],
        [
          {
            name: "status",
            label: "Status",
            options:
              MAINTENANCE_STATUS,
          },
          {
            name: "priority",
            label: "Priority",
            options:
              PRIORITIES,
          },
        ],
      ),

      updateEndpoint: (id) =>
        `/operations/maintenance/${id}`,

      canCreate: (p) =>
        permission(
          p,
          "maintenance.raise",
        ),

      canUpdate: (p) =>
        permission(
          p,
          "maintenance.raise",
        ),
    },
  };

  return (
    <div className="space-y-4 [color-scheme:light]">
      <div className="flex flex-wrap gap-2 rounded-[24px] border border-slate-200 bg-white p-2">
        {Object.entries(
          definitions,
        ).map(
          ([
            key,
            definition,
          ]) => (
            <button
              key={key}
              type="button"
              onClick={() =>
                setTab(
                  key as typeof tab,
                )
              }
              className={`rounded-2xl px-4 py-2.5 text-sm font-black ${
                tab === key
                  ? "bg-slate-950 text-white"
                  : "text-slate-500 hover:bg-slate-50"
              }`}
            >
              {
                definition.title
              }
            </button>
          ),
        )}
      </div>

      <ResourceManager
        def={
          definitions[
            tab
          ]
        }
        permissions={
          permissions
        }
      />
    </div>
  );
}

function AdminModuleContent({
  module,
}: {
  module: string;
}) {
  const item =
    findAdminNavItem(
      `/admin/${module}`,
    );

  const [
    permissions,
    setPermissions,
  ] = useState<
    string[]
  >([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  useEffect(
    () => {
      void getCurrentUser({
        background: true,
      })
        .then(
          (user) =>
            setPermissions(
              user.permissions,
            ),
        )
        .finally(() =>
          setLoading(
            false,
          ),
        );
    },
    [],
  );

  if (!item) {
    return (
      <div className="rounded-[30px] border border-rose-200 bg-rose-50 p-8 font-black text-rose-700">
        Unknown administration
        module.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-5">
        <Header
          item={item}
        />

        <div className="h-96 animate-pulse rounded-[30px] bg-white" />
      </div>
    );
  }

  if (
    module ===
    "students"
  ) {
    return (
      <div className="space-y-5">
        <Header
          item={item}
        />

        <StudentManagement />
      </div>
    );
  }

  if (
    module ===
    "documents"
  ) {
    return (
      <div className="space-y-5">
        <Header
          item={item}
        />

        <Documents
          permissions={
            permissions
          }
        />
      </div>
    );
  }

  if (
    module ===
    "notifications"
  ) {
    return (
      <div className="space-y-5">
        <Header
          item={item}
        />

        <Notifications
          permissions={
            permissions
          }
        />
      </div>
    );
  }

  if (
    module ===
    "operations"
  ) {
    return (
      <div className="space-y-5">
        <Header
          item={item}
        />

        <Operations
          permissions={
            permissions
          }
        />
      </div>
    );
  }

  const definition =
    resource(module);

  if (!definition) {
    return (
      <div className="rounded-[30px] border border-slate-200 bg-white p-8 text-slate-700">
        No administration
        adapter is configured
        for this module.
      </div>
    );
  }

  if (module === "users") {
    return (
      <div className="space-y-5">
        <Header item={item} />

        <PeopleImportPanel />

        <ResourceManager
          def={definition}
          permissions={permissions}
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Header
        item={item}
      />

      <ResourceManager
        def={
          definition
        }
        permissions={
          permissions
        }
      />
    </div>
  );
}


export function AdminModulePage({ module }: { module: string }) {
  return (
    <DashboardShell
      title="Institution Administration"
      subtitle="Manage authorized institutional modules and records"
      allowedRoles={["INSTITUTION_ADMIN"]}
    >
      <AdminModuleContent module={module} />
    </DashboardShell>
  );
}
