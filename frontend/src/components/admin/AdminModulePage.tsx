"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

import { StudentManagement } from "@/components/dashboard/StudentManagement";
import { authedFetch } from "@/lib/auth";
import {
  findAdminNavItem,
  type AdminNavItem,
} from "@/lib/adminNavigation";

const INPUT =
  "w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-3 text-sm font-semibold text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 [color-scheme:light]";

const ACTION =
  "rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white transition hover:-translate-y-0.5 hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50";

const SECONDARY =
  "rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-800 transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50";

type Row = Record<string, any> & {
  id?: string;
};

type Lookup = {
  id: string;
  name?: string;
  code?: string;
  number?: number;
  firstName?: string;
  lastName?: string;
  email?: string;
  [key: string]: any;
};

type FieldType =
  | "text"
  | "email"
  | "password"
  | "number"
  | "date"
  | "datetime-local"
  | "url"
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
  placeholder?: string;
  readOnlyOnEdit?: boolean;
  colSpan?: 1 | 2;
};

type Resource = {
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
  canCreate?: (permissions: string[]) => boolean;
  canUpdate?: (permissions: string[]) => boolean;
  canDelete?: (permissions: string[]) => boolean;
};

function rowsOf(data: any): Row[] {
  if (Array.isArray(data)) {
    return data;
  }

  if (Array.isArray(data?.items)) {
    return data.items;
  }

  if (Array.isArray(data?.data)) {
    return data.data;
  }

  return [];
}

function valueAt(row: Row, path: string): any {
  return path
    .split(".")
    .reduce(
      (value, key) => value?.[key],
      row,
    );
}

function show(value: any): string {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "—";
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  if (Array.isArray(value)) {
    return value
      .map(
        (item) =>
          item?.name ||
          item?.code ||
          item?.role?.name ||
          item?.role ||
          item?.id ||
          String(item),
      )
      .join(", ");
  }

  if (typeof value === "object") {
    return (
      value.name ||
      value.code ||
      value.title ||
      value.email ||
      value.id ||
      "—"
    );
  }

  return String(value);
}

function formatDate(value: any): string {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleString(
    "en-IN",
    {
      dateStyle: "medium",
      timeStyle: "short",
    },
  );
}

function lookupLabel(item: Lookup): string {
  const fullName = [
    item.firstName,
    item.lastName,
  ]
    .filter(Boolean)
    .join(" ")
    .trim();

  if (fullName && item.email) {
    return `${fullName} — ${item.email}`;
  }

  if (fullName) {
    return fullName;
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

  if (item.name && item.email) {
    return `${item.name} — ${item.email}`;
  }

  return (
    item.name ||
    item.code ||
    item.email ||
    item.id
  );
}

function labelForColumn(
  column: string,
): string {
  return column
    .split(".")
    .at(-1)!
    .replace(
      /([A-Z])/g,
      " $1",
    )
    .replace(
      /^./,
      (char) =>
        char.toUpperCase(),
    );
}

const LOOKUPS: Record<
  string,
  string
> = {
  campuses:
    "/campuses?page=1&pageSize=100",

  departments:
    "/departments?page=1&pageSize=100",

  programs:
    "/programs?page=1&pageSize=100",

  years:
    "/academic-years?page=1&pageSize=100",

  semesters:
    "/semesters?page=1&pageSize=100",

  sections:
    "/sections?page=1&pageSize=100",

  courses:
    "/courses?page=1&pageSize=100",

  faculty:
    "/users?page=1&pageSize=100&role=FACULTY",

  users:
    "/users?page=1&pageSize=100",

  parents:
    "/users?page=1&pageSize=100&role=PARENT",

  students:
    "/students?page=1&pageSize=100",

  facilities:
    "/operations/facilities?includeInactive=true",

  assets:
    "/operations/assets?page=1&pageSize=100",

  assetCategories:
    "/operations/asset-categories",
};

function normalizeDateInput(
  value: any,
  type: FieldType,
): string {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value).slice(
      0,
      type === "date" ? 10 : 16,
    );
  }

  return type === "date"
    ? date.toISOString().slice(0, 10)
    : date.toISOString().slice(0, 16);
}

function control(
  field: Field,
  value: any,
  setValue: (value: any) => void,
  lookups: Record<
    string,
    Lookup[]
  >,
  editing: boolean,
) {
  const disabled =
    editing &&
    Boolean(
      field.readOnlyOnEdit,
    );

  if (field.type === "textarea") {
    return (
      <textarea
        value={value ?? ""}
        disabled={disabled}
        placeholder={
          field.placeholder
        }
        onChange={(event) =>
          setValue(
            event.target.value,
          )
        }
        className={`${INPUT} min-h-28 resize-y`}
      />
    );
  }

  if (field.type === "checkbox") {
    return (
      <label className="flex min-h-12 items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-900 [color-scheme:light]">
        <input
          type="checkbox"
          checked={Boolean(value)}
          disabled={disabled}
          onChange={(event) =>
            setValue(
              event.target.checked,
            )
          }
          className="h-4 w-4 accent-blue-600"
        />

        <span>
          {field.label}
        </span>
      </label>
    );
  }

  if (field.type === "select") {
    return (
      <select
        value={value ?? ""}
        disabled={disabled}
        onChange={(event) =>
          setValue(
            event.target.value,
          )
        }
        className={`${INPUT} appearance-auto`}
      >
        <option
          value=""
          className="bg-white text-slate-950"
        >
          Select{" "}
          {field.label.toLowerCase()}
        </option>

        {field.options?.map(
          (option) => (
            <option
              key={option}
              value={option}
              className="bg-white text-slate-950"
            >
              {option.replaceAll(
                "_",
                " ",
              )}
            </option>
          ),
        )}

        {field.source
          ? (
              lookups[
                field.source
              ] || []
            ).map(
              (option) => (
                <option
                  key={
                    option.id
                  }
                  value={
                    option.id
                  }
                  className="bg-white text-slate-950"
                >
                  {lookupLabel(
                    option,
                  )}
                </option>
              ),
            )
          : null}
      </select>
    );
  }

  return (
    <input
      type={
        field.type || "text"
      }
      value={value ?? ""}
      disabled={disabled}
      placeholder={
        field.placeholder
      }
      onChange={(event) =>
        setValue(
          event.target.value,
        )
      }
      className={INPUT}
    />
  );
}

function commonPermissions(
  permission: string,
) {
  return (
    permissions: string[],
  ) =>
    permissions.includes(
      permission,
    );
}

function resource(
  module: string,
): Resource | null {
  const crud = (
    title: string,
    description: string,
    endpoint: string,
    createFields: Field[],
    updateFields: Field[],
    columns: string[],
    permission: string,
  ): Resource => ({
    title,
    description,
    endpoint,
    createFields,
    updateFields,
    columns,

    canCreate:
      commonPermissions(
        `${permission}.create`,
      ),

    canUpdate:
      commonPermissions(
        `${permission}.update`,
      ),

    canDelete:
      commonPermissions(
        `${permission}.delete`,
      ),
  });

  const map: Record<
    string,
    Resource
  > = {
    users: {
      title:
        "Institution users",

      description:
        "Create accounts, assign institutional roles, update account status and deactivate users.",

      endpoint:
        "/users?page=1&pageSize=100",

      updateEndpoint: (
        id,
      ) =>
        `/users/${id}`,

      deleteEndpoint: (
        row,
      ) =>
        `/users/${row.id}/status`,

      deleteMethod:
        "PATCH",

      deleteBody: () => ({
        isActive: false,
      }),

      createFields: [
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
          label:
            "Temporary password",
          type: "password",
          required: true,
          placeholder:
            "Minimum 8 characters",
        },

        {
          name: "role",
          label: "Role",
          type: "select",
          required: true,
          options: [
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
          ],
        },
      ],

      updateFields: [
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
          readOnlyOnEdit: true,
        },

        {
          name: "phone",
          label: "Phone",
        },

        {
          name: "role",
          label: "Role",
          type: "select",
          required: true,
          options: [
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
          ],
        },

        {
          name: "isActive",
          label:
            "Active account",
          type: "checkbox",
        },
      ],

      columns: [
        "firstName",
        "lastName",
        "email",
        "roles",
        "isActive",
      ],

      canCreate: (
        permissions,
      ) =>
        permissions.includes(
          "users.create",
        ),

      canUpdate: (
        permissions,
      ) =>
        permissions.includes(
          "users.update",
        ),

      canDelete: (
        permissions,
      ) =>
        permissions.includes(
          "users.delete",
        ),
    },

    departments: crud(
      "Departments",
      "Manage department identity, code, campus assignment and active status.",
      "/departments?page=1&pageSize=100",

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

      "departments",
    ),

    programs: crud(
      "Programs",
      "Manage programs, department ownership, academic level and duration.",
      "/programs?page=1&pageSize=100",

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
          placeholder:
            "UG / PG / Diploma",
        },

        {
          name: "durationYears",
          label:
            "Duration years",
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
          label:
            "Duration years",
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
        "department",
        "isActive",
      ],

      "programs",
    ),

    "academic-years": crud(
      "Academic years",
      "Define academic-year boundaries and mark the institution's current year.",
      "/academic-years?page=1&pageSize=100",

      [
        {
          name: "name",
          label: "Name",
          required: true,
          placeholder:
            "2026-27",
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

      "academic-years",
    ),

    semesters: crud(
      "Semesters",
      "Create semester definitions and associate them with a program and academic year.",
      "/semesters?page=1&pageSize=100",

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
          label:
            "Semester number",
          type: "number",
          required: true,
        },

        {
          name: "name",
          label: "Name",
          required: true,
          placeholder:
            "Semester 1",
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
          name: "programId",
          label: "Program",
          type: "select",
          source: "programs",
          readOnlyOnEdit: true,
        },

        {
          name: "academicYearId",
          label: "Academic year",
          type: "select",
          source: "years",
          readOnlyOnEdit: true,
        },

        {
          name: "number",
          label:
            "Semester number",
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
        "isActive",
      ],

      "semesters",
    ),

    sections: crud(
      "Sections",
      "Create class sections under a semester and maintain their capacity and active status.",
      "/sections?page=1&pageSize=100",

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
          name: "semesterId",
          label: "Semester",
          type: "select",
          source: "semesters",
          readOnlyOnEdit: true,
        },

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

      "sections",
    ),

    courses: crud(
      "Courses",
      "Manage the institutional course catalogue, ownership, credits and description.",
      "/courses?page=1&pageSize=100",

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
          colSpan: 2,
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
          colSpan: 2,
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

      "courses",
    ),

    "course-offerings": {
      title:
        "Course offerings",

      description:
        "Assign a course to a semester and section, optionally assign faculty, and manage offering status.",

      endpoint:
        "/course-offerings?page=1&pageSize=100",

      updateEndpoint: (
        id,
      ) =>
        `/course-offerings/${id}`,

      deleteEndpoint: (
        row,
      ) =>
        `/course-offerings/${row.id}`,

      createFields: [
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
        },
      ],

      updateFields: [
        {
          name: "courseId",
          label: "Course",
          type: "select",
          source: "courses",
          readOnlyOnEdit: true,
        },

        {
          name: "semesterId",
          label: "Semester",
          type: "select",
          source: "semesters",
          readOnlyOnEdit: true,
        },

        {
          name: "sectionId",
          label: "Section",
          type: "select",
          source: "sections",
          readOnlyOnEdit: true,
        },

        {
          name: "facultyId",
          label: "Faculty",
          type: "select",
          source: "faculty",
        },

        {
          name: "isActive",
          label: "Active",
          type: "checkbox",
        },
      ],

      columns: [
        "course",
        "semester",
        "section",
        "faculty",
        "isActive",
      ],

      canCreate: (
        permissions,
      ) =>
        permissions.includes(
          "course-offerings.create",
        ),

      canUpdate: (
        permissions,
      ) =>
        permissions.includes(
          "course-offerings.update",
        ),

      canDelete: (
        permissions,
      ) =>
        permissions.includes(
          "course-offerings.delete",
        ),
    },

    campuses: crud(
      "Campuses",
      "Manage campus identity, code, address and active status.",
      "/campuses?page=1&pageSize=100",

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
          colSpan: 2,
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
          colSpan: 2,
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

      "campuses",
    ),

    notices: {
      title: "Notices",

      description:
        "Publish institutional notices, target audiences or departments, and control expiry.",

      endpoint:
        "/erp/notices?includeExpired=true",

      updateEndpoint: (
        id,
      ) =>
        `/erp/notices/${id}`,

      deleteEndpoint: (
        row,
      ) =>
        `/erp/notices/${row.id}`,

      createFields: [
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
          colSpan: 2,
        },

        {
          name: "audience",
          label: "Audience",
          type: "select",
          options: [
            "ALL",
            "STUDENT",
            "FACULTY",
            "PARENT",
            "STAFF",
            "HOD",
            "MANAGEMENT",
          ],
        },

        {
          name: "departmentId",
          label: "Department",
          type: "select",
          source: "departments",
        },

        {
          name: "expiresAt",
          label: "Expires at",
          type: "datetime-local",
        },
      ],

      updateFields: [
        {
          name: "title",
          label: "Title",
        },

        {
          name: "body",
          label: "Body",
          type: "textarea",
          colSpan: 2,
        },

        {
          name: "audience",
          label: "Audience",
          type: "select",
          options: [
            "ALL",
            "STUDENT",
            "FACULTY",
            "PARENT",
            "STAFF",
            "HOD",
            "MANAGEMENT",
          ],
        },

        {
          name: "departmentId",
          label: "Department",
          type: "select",
          source: "departments",
        },

        {
          name: "expiresAt",
          label: "Expires at",
          type: "datetime-local",
        },
      ],

      columns: [
        "title",
        "audience",
        "department",
        "expiresAt",
        "createdAt",
      ],

      canCreate: (
        permissions,
      ) =>
        permissions.includes(
          "notices.manage",
        ),

      canUpdate: (
        permissions,
      ) =>
        permissions.includes(
          "notices.manage",
        ),

      canDelete: (
        permissions,
      ) =>
        permissions.includes(
          "notices.manage",
        ),
    },

    notifications: {
      title:
        "Notifications",

      description:
        "Send a portal notification to one recipient.",

      endpoint:
        "/portal/notifications?page=1&limit=100",

      createEndpoint:
        "/portal/notifications",

      createFields: [
        {
          name: "userId",
          label: "Recipient",
          type: "select",
          source: "users",
          required: true,
        },

        {
          name: "title",
          label: "Title",
          required: true,
        },

        {
          name: "body",
          label: "Message",
          type: "textarea",
          required: true,
          colSpan: 2,
        },
      ],

      updateFields: [],

      columns: [
        "title",
        "body",
        "readAt",
        "createdAt",
      ],

      canCreate: (
        permissions,
      ) =>
        permissions.includes(
          "notices.manage",
        ),
    },

    calendar: {
      title:
        "Calendar",

      description:
        "Create, update and remove institutional calendar events with dates, type, academic year and audience.",

      endpoint:
        "/calendar/events?page=1&pageSize=100",

      updateEndpoint: (
        id,
      ) =>
        `/calendar/events/${id}`,

      deleteEndpoint: (
        row,
      ) =>
        `/calendar/events/${row.id}`,

      createFields: [
        {
          name: "title",
          label: "Title",
          required: true,
        },

        {
          name: "description",
          label: "Description",
          type: "textarea",
          colSpan: 2,
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
          name: "eventType",
          label: "Event type",
          type: "select",
          options: [
            "HOLIDAY",
            "EXAM",
            "EVENT",
            "DEADLINE",
            "ACADEMIC",
          ],
        },

        {
          name: "academicYearId",
          label: "Academic year",
          type: "select",
          source: "years",
        },

        {
          name: "audience",
          label: "Audience",
          type: "select",
          options: [
            "ALL",
            "STUDENTS",
            "FACULTY",
            "STAFF",
          ],
        },
      ],

      updateFields: [
        {
          name: "title",
          label: "Title",
        },

        {
          name: "description",
          label: "Description",
          type: "textarea",
          colSpan: 2,
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
          name: "eventType",
          label: "Event type",
          type: "select",
          options: [
            "HOLIDAY",
            "EXAM",
            "EVENT",
            "DEADLINE",
            "ACADEMIC",
          ],
        },

        {
          name: "academicYearId",
          label: "Academic year",
          type: "select",
          source: "years",
        },

        {
          name: "audience",
          label: "Audience",
          type: "select",
          options: [
            "ALL",
            "STUDENTS",
            "FACULTY",
            "STAFF",
          ],
        },
      ],

      columns: [
        "title",
        "eventType",
        "startDate",
        "endDate",
        "audience",
      ],

      canCreate: (
        permissions,
      ) =>
        permissions.includes(
          "calendar.manage",
        ),

      canUpdate: (
        permissions,
      ) =>
        permissions.includes(
          "calendar.manage",
        ),

      canDelete: (
        permissions,
      ) =>
        permissions.includes(
          "calendar.manage",
        ),
    },

    "parent-links": {
      title:
        "Parent links",

      description:
        "Connect a parent account to a student record and remove incorrect links.",

      endpoint:
        "/erp/parent-links",

      createEndpoint:
        "/erp/parent-links",

      deleteEndpoint: (
        row,
      ) =>
        `/erp/parent-links/${row.parentId}/${row.studentId}`,

      createFields: [
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
          placeholder:
            "Father / Mother / Guardian",
        },
      ],

      updateFields: [],

      columns: [
        "parent",
        "student",
        "relationship",
        "createdAt",
      ],

      canCreate: (
        permissions,
      ) =>
        permissions.includes(
          "parent-links.manage",
        ),

      canDelete: (
        permissions,
      ) =>
        permissions.includes(
          "parent-links.manage",
        ),
    },
  };

  return (
    map[module] || null
  );
}

function Header({
  item,
}: {
  item: AdminNavItem;
}) {
  return (
    <section className="relative overflow-hidden rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_18px_60px_rgba(15,23,42,0.07)] sm:p-8">
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

function ResourceManager({
  def,
  permissions,
}: {
  def: Resource;
  permissions: string[];
}) {
  const [data, setData] =
    useState<Row[]>([]);

  const [lookups, setLookups] =
    useState<
      Record<
        string,
        Lookup[]
      >
    >({});

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  const [open, setOpen] =
    useState(false);

  const [editing, setEditing] =
    useState<Row | null>(
      null,
    );

  const [form, setForm] =
    useState<Row>({});

  const [search, setSearch] =
    useState("");

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

  const sources =
    useMemo(
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

  const visibleRows =
    useMemo(() => {
      const query =
        search
          .trim()
          .toLowerCase();

      if (!query) {
        return data;
      }

      return data.filter(
        (row) =>
          def.columns.some(
            (column) =>
              show(
                valueAt(
                  row,
                  column,
                ),
              )
                .toLowerCase()
                .includes(
                  query,
                ),
          ),
      );
    }, [
      data,
      def.columns,
      search,
    ]);

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
    const results =
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
                ) as Lookup[],
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
        results,
      ),
    );
  }

  useEffect(() => {
    void Promise.all([
      load(),
      loadLookups(),
    ]);

    // Resource definition changes only when the admin module changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [def.endpoint]);

  function fieldsForForm() {
    return editing
      ? def.updateFields
      : def.createFields;
  }

  function openCreate() {
    setEditing(null);
    setForm({});
    setError("");
    setSuccess("");
    setOpen(true);
  }

  function openEdit(
    row: Row,
  ) {
    const next: Row = {
      ...row,
    };

    for (const field of def.updateFields) {
      if (
        (
          field.type ===
            "date" ||
          field.type ===
            "datetime-local"
        ) &&
        next[field.name]
      ) {
        next[field.name] =
          normalizeDateInput(
            next[field.name],
            field.type,
          );
      }

      if (
        Array.isArray(
          next.roles,
        )
      ) {
        next.role =
          next.roles[0]
            ?.name ||
          next.roles[0]
            ?.role?.name ||
          next.roles[0]
            ?.role ||
          "";
      }
    }

    setEditing(row);
    setForm(next);
    setError("");
    setSuccess("");
    setOpen(true);
  }

  function payload() {
    const output: Row =
      {};

    for (const field of fieldsForForm()) {
      if (
        editing &&
        field.readOnlyOnEdit
      ) {
        continue;
      }

      let value =
        form[field.name];

      if (
        field.type ===
          "number" &&
        value !== ""
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
        value !== "" &&
        value !==
          undefined
      ) {
        output[
          field.name
        ] = value;
      }
    }

    return output;
  }

  function validateRequired() {
    const missing =
      fieldsForForm().filter(
        (field) =>
          field.required &&
          !field.readOnlyOnEdit &&
          (
            form[
              field.name
            ] === "" ||
            form[
              field.name
            ] ===
              undefined ||
            form[
              field.name
            ] === null
          ),
      );

    if (missing.length) {
      setError(
        `Please complete: ${missing
          .map(
            (field) =>
              field.label,
          )
          .join(", ")}.`,
      );

      return false;
    }

    return true;
  }

  async function save(
    event: FormEvent,
  ) {
    event.preventDefault();

    if (!validateRequired()) {
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

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
          "This module does not support this operation.",
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
              payload(),
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
      !def.deleteEndpoint
    ) {
      return;
    }

    const label = show(
      row.name ||
        row.title ||
        row.email ||
        row.code ||
        row.id,
    );

    if (
      !window.confirm(
        `Remove ${label}?`,
      )
    ) {
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      await authedFetch(
        def.deleteEndpoint(
          row,
        ),
        {
          method:
            def.deleteMethod ||
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
        "Record removed or deactivated successfully.",
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
    <section className="overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-[0_14px_45px_rgba(15,23,42,0.06)]">
      <div className="border-b border-slate-100 p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
              Data workspace
            </p>

            <h2 className="mt-1 text-xl font-black text-slate-950">
              {def.title}
            </h2>

            <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-500">
              {def.description}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() =>
                void Promise.all(
                  [
                    load(),
                    loadLookups(),
                  ],
                )
              }
              disabled={
                loading ||
                saving
              }
              className={
                SECONDARY
              }
            >
              Refresh
            </button>

            {canCreate ? (
              <button
                type="button"
                onClick={
                  openCreate
                }
                className={
                  ACTION
                }
              >
                + Create
              </button>
            ) : null}
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <input
            value={search}
            onChange={(event) =>
              setSearch(
                event.target
                  .value,
              )
            }
            placeholder={`Search ${def.title.toLowerCase()}…`}
            className={`${INPUT} sm:max-w-sm`}
          />

          <p className="text-xs font-bold text-slate-400">
            {visibleRows.length}{" "}
            visible ·{" "}
            {data.length}{" "}
            loaded
          </p>
        </div>
      </div>

      {error ? (
        <div className="mx-5 mt-5 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700">
          {error}
        </div>
      ) : null}

      {success ? (
        <div className="mx-5 mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-700">
          {success}
        </div>
      ) : null}

      {loading ? (
        <div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-3">
          {[
            1,
            2,
            3,
            4,
            5,
            6,
          ].map(
            (item) => (
              <div
                key={item}
                className="h-24 rounded-2xl bg-slate-100 animate-pulse"
              />
            ),
          )}
        </div>
      ) : visibleRows.length ===
        0 ? (
        <div className="p-12 text-center">
          <p className="font-black text-slate-900">
            No records found
          </p>

          <p className="mt-1 text-sm text-slate-500">
            Create a record or
            change the search
            term.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
              <tr>
                {def.columns.map(
                  (column) => (
                    <th
                      key={column}
                      className="px-5 py-4"
                    >
                      {labelForColumn(
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
              {visibleRows.map(
                (
                  row,
                  index,
                ) => (
                  <tr
                    key={
                      row.id ||
                      index
                    }
                    className="hover:bg-blue-50/30"
                  >
                    {def.columns.map(
                      (
                        column,
                      ) => {
                        const cell =
                          valueAt(
                            row,
                            column,
                          );

                        const isDate =
                          column
                            .toLowerCase()
                            .includes(
                              "date",
                            ) ||
                          column
                            .toLowerCase()
                            .endsWith(
                              "at",
                            );

                        return (
                          <td
                            key={
                              column
                            }
                            className="px-5 py-4 font-semibold text-slate-700"
                          >
                            {isDate
                              ? formatDate(
                                  cell,
                                )
                              : show(
                                  cell,
                                )}
                          </td>
                        );
                      },
                    )}

                    <td className="px-5 py-4 text-right">
                      {canUpdate ? (
                        <button
                          type="button"
                          onClick={() =>
                            openEdit(
                              row,
                            )
                          }
                          className="mr-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-black text-slate-800"
                        >
                          Edit
                        </button>
                      ) : null}

                      {canDelete ? (
                        <button
                          type="button"
                          disabled={
                            saving
                          }
                          onClick={() =>
                            void remove(
                              row,
                            )
                          }
                          className="rounded-xl border border-rose-200 px-3 py-2 text-xs font-black text-rose-600 hover:bg-rose-50"
                        >
                          Remove
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      )}

      {open ? (
        <div className="fixed inset-0 z-[100] overflow-y-auto bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="mx-auto my-8 max-w-5xl overflow-hidden rounded-[30px] bg-slate-50 shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-6 py-5">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-600">
                  {editing
                    ? "Update record"
                    : "Create record"}
                </p>

                <h3 className="mt-1 text-2xl font-black text-slate-950">
                  {def.title}
                </h3>

                {editing ? (
                  <p className="mt-1 text-xs text-slate-500">
                    Fields marked as
                    locked are part
                    of the record's
                    identity and
                    are not sent to
                    the update API.
                  </p>
                ) : null}
              </div>

              <button
                type="button"
                onClick={() =>
                  setOpen(false)
                }
                className={
                  SECONDARY
                }
              >
                Close
              </button>
            </div>

            <form
              onSubmit={save}
              className="space-y-6 p-5 sm:p-6"
            >
              <div className="grid gap-4 md:grid-cols-2">
                {fieldsForForm().map(
                  (field) => (
                    <label
                      key={
                        field.name
                      }
                      className={
                        field.colSpan ===
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

                        {editing &&
                        field.readOnlyOnEdit
                          ? " · locked"
                          : ""}
                      </span>

                      {control(
                        field,
                        form[
                          field.name
                        ],
                        (value) =>
                          setForm(
                            (
                              previous,
                            ) => ({
                              ...previous,
                              [field.name]:
                                value,
                            }),
                          ),
                        lookups,
                        Boolean(
                          editing,
                        ),
                      )}
                    </label>
                  ),
                )}
              </div>

              {error ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700">
                  {error}
                </div>
              ) : null}

              <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-4">
                <button
                  type="button"
                  onClick={() =>
                    setOpen(false)
                  }
                  className={
                    SECONDARY
                  }
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className={
                    ACTION
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
      ) : null}
    </section>
  );
}

function Operations({
  permissions,
}: {
  permissions: string[];
}) {
  const canRead =
    permissions.includes(
      "operations.read",
    ) ||
    permissions.includes(
      "operations.manage",
    );

  const canManage =
    permissions.includes(
      "operations.manage",
    );

  const canRaiseMaintenance =
    permissions.includes(
      "maintenance.raise",
    );

  const [tab, setTab] =
    useState<
      | "asset-categories"
      | "assets"
      | "facilities"
      | "maintenance"
    >(
      canRead
        ? "assets"
        : "maintenance",
    );

  const definitions: Record<
    string,
    Resource
  > = {
    "asset-categories": {
      title:
        "Asset categories",

      description:
        "Create operational asset categories used by the asset inventory.",

      endpoint:
        "/operations/asset-categories",

      createFields: [
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

      updateFields: [],

      columns: [
        "name",
        "code",
      ],

      canCreate: () =>
        canManage,
    },

    assets: {
      title: "Assets",

      description:
        "Manage operational inventory, ownership, condition and status.",

      endpoint:
        "/operations/assets?page=1&pageSize=100",

      updateEndpoint: (
        id,
      ) =>
        `/operations/assets/${id}`,

      createFields: [
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
          label:
            "Asset category",
          type: "select",
          source:
            "assetCategories",
        },

        {
          name: "campusId",
          label: "Campus",
          type: "select",
          source: "campuses",
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
          label:
            "Serial number",
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
          label:
            "Purchase date",
          type: "date",
        },

        {
          name: "warrantyEndsAt",
          label:
            "Warranty ends",
          type: "date",
        },

        {
          name: "location",
          label: "Location",
        },

        {
          name: "condition",
          label: "Condition",
          type: "select",
          options: [
            "NEW",
            "GOOD",
            "FAIR",
            "POOR",
            "DAMAGED",
          ],
        },

        {
          name: "status",
          label: "Status",
          type: "select",
          options: [
            "IN_USE",
            "IN_STORE",
            "UNDER_REPAIR",
            "RETIRED",
            "LOST",
          ],
        },

        {
          name: "assignedToId",
          label:
            "Assigned to",
          type: "select",
          source: "users",
        },

        {
          name: "notes",
          label: "Notes",
          type: "textarea",
          colSpan: 2,
        },
      ],

      updateFields: [
        {
          name: "name",
          label: "Name",
        },

        {
          name: "assetTag",
          label: "Asset tag",
          readOnlyOnEdit: true,
        },

        {
          name: "assetCategoryId",
          label:
            "Asset category",
          type: "select",
          source:
            "assetCategories",
          readOnlyOnEdit: true,
        },

        {
          name: "campusId",
          label: "Campus",
          type: "select",
          source: "campuses",
          readOnlyOnEdit: true,
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
          label:
            "Serial number",
          readOnlyOnEdit: true,
        },

        {
          name: "quantity",
          label: "Quantity",
          type: "number",
        },

        {
          name: "location",
          label: "Location",
        },

        {
          name: "condition",
          label: "Condition",
          type: "select",
          options: [
            "NEW",
            "GOOD",
            "FAIR",
            "POOR",
            "DAMAGED",
          ],
        },

        {
          name: "status",
          label: "Status",
          type: "select",
          options: [
            "IN_USE",
            "IN_STORE",
            "UNDER_REPAIR",
            "RETIRED",
            "LOST",
          ],
        },

        {
          name: "assignedToId",
          label:
            "Assigned to",
          type: "select",
          source: "users",
        },

        {
          name: "notes",
          label: "Notes",
          type: "textarea",
          colSpan: 2,
        },
      ],

      columns: [
        "name",
        "assetTag",
        "status",
        "condition",
        "location",
      ],

      canCreate: () =>
        canManage,

      canUpdate: () =>
        canManage,
    },

    facilities: {
      title:
        "Facilities",

      description:
        "Manage classrooms, labs, libraries, hostels, sports areas and other facilities.",

      endpoint:
        "/operations/facilities?includeInactive=true",

      updateEndpoint: (
        id,
      ) =>
        `/operations/facilities/${id}`,

      createFields: [
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
          options: [
            "CLASSROOM",
            "LAB",
            "AUDITORIUM",
            "LIBRARY",
            "HOSTEL",
            "SPORTS",
            "OTHER",
          ],
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
          source: "campuses",
        },

        {
          name: "location",
          label: "Location",
        },
      ],

      updateFields: [
        {
          name: "name",
          label: "Name",
        },

        {
          name: "code",
          label: "Code",
          readOnlyOnEdit: true,
        },

        {
          name: "facilityType",
          label: "Type",
          type: "select",
          options: [
            "CLASSROOM",
            "LAB",
            "AUDITORIUM",
            "LIBRARY",
            "HOSTEL",
            "SPORTS",
            "OTHER",
          ],
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
          source: "campuses",
          readOnlyOnEdit: true,
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

      columns: [
        "name",
        "code",
        "facilityType",
        "capacity",
        "location",
        "isActive",
      ],

      canCreate: () =>
        canManage,

      canUpdate: () =>
        canManage,
    },

    maintenance: {
      title:
        "Maintenance",

      description:
        "Raise and update maintenance requests. Resolution and assignment fields are available when the backend permits them.",

      endpoint:
        "/operations/maintenance?page=1&pageSize=100",

      updateEndpoint: (
        id,
      ) =>
        `/operations/maintenance/${id}`,

      createFields: [
        {
          name: "facilityId",
          label: "Facility",
          type: "select",
          source:
            "facilities",
        },

        {
          name: "assetId",
          label: "Asset",
          type: "select",
          source: "assets",
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
          colSpan: 2,
        },

        {
          name: "priority",
          label: "Priority",
          type: "select",
          options: [
            "LOW",
            "MEDIUM",
            "HIGH",
            "URGENT",
          ],
        },
      ],

      updateFields: [
        {
          name: "facilityId",
          label: "Facility",
          type: "select",
          source:
            "facilities",
          readOnlyOnEdit: true,
        },

        {
          name: "assetId",
          label: "Asset",
          type: "select",
          source: "assets",
          readOnlyOnEdit: true,
        },

        {
          name: "title",
          label: "Title",
          readOnlyOnEdit: true,
        },

        {
          name: "description",
          label: "Description",
          type: "textarea",
          readOnlyOnEdit: true,
          colSpan: 2,
        },

        {
          name: "priority",
          label: "Priority",
          type: "select",
          options: [
            "LOW",
            "MEDIUM",
            "HIGH",
            "URGENT",
          ],
        },

        {
          name: "status",
          label: "Status",
          type: "select",
          options: [
            "OPEN",
            "ASSIGNED",
            "IN_PROGRESS",
            "RESOLVED",
            "CLOSED",
            "REJECTED",
          ],
        },

        {
          name: "assignedToId",
          label:
            "Assigned to",
          type: "select",
          source: "users",
        },

        {
          name: "resolutionNote",
          label:
            "Resolution note",
          type: "textarea",
          colSpan: 2,
        },
      ],

      columns: [
        "title",
        "priority",
        "status",
        "createdAt",
      ],

      canCreate: () =>
        canRaiseMaintenance,

      canUpdate: () =>
        canRaiseMaintenance,
    },
  };

  const tabs = [
    canRead
      ? [
          "asset-categories",
          "Asset categories",
        ]
      : null,

    canRead
      ? [
          "assets",
          "Assets",
        ]
      : null,

    canRead
      ? [
          "facilities",
          "Facilities",
        ]
      : null,

    canRaiseMaintenance
      ? [
          "maintenance",
          "Maintenance",
        ]
      : null,
  ].filter(
    Boolean,
  ) as [
    | "asset-categories"
    | "assets"
    | "facilities"
    | "maintenance",
    string,
  ][];

  if (!tabs.length) {
    return (
      <div className="rounded-[30px] border border-rose-200 bg-rose-50 p-8 font-bold text-rose-700">
        You do not have
        permission to operate
        this workspace.
      </div>
    );
  }

  const activeTab =
    tabs.some(
      ([key]) =>
        key === tab,
    )
      ? tab
      : tabs[0][0];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 rounded-[24px] border border-slate-200 bg-white p-2">
        {tabs.map(
          ([
            key,
            label,
          ]) => (
            <button
              key={key}
              type="button"
              onClick={() =>
                setTab(key)
              }
              className={`rounded-2xl px-4 py-3 text-sm font-black transition ${
                activeTab ===
                key
                  ? "bg-slate-950 text-white"
                  : "text-slate-500 hover:bg-slate-50"
              }`}
            >
              {label}
            </button>
          ),
        )}
      </div>

      <ResourceManager
        def={
          definitions[
            activeTab
          ]
        }
        permissions={
          permissions
        }
      />
    </div>
  );
}

function Documents({
  permissions,
}: {
  permissions: string[];
}) {
  const [students, setStudents] =
    useState<Lookup[]>([]);

  const [student, setStudent] =
    useState("");

  const [documents, setDocuments] =
    useState<Row[]>([]);

  const [loading, setLoading] =
    useState(false);

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  const [form, setForm] =
    useState({
      title: "",
      type: "",
      url: "",
    });

  const canManage =
    permissions.includes(
      "students.update",
    );

  useEffect(() => {
    void authedFetch<any>(
      "/students?page=1&pageSize=100",
    )
      .then(
        (response) =>
          setStudents(
            rowsOf(
              response.data,
            ) as Lookup[],
          ),
      )
      .catch(
        (reason) =>
          setError(
            reason instanceof
              Error
              ? reason.message
              : "Unable to load students.",
          ),
      );
  }, []);

  async function loadDocuments(
    studentId: string,
  ) {
    if (!studentId) {
      setDocuments([]);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response =
        await authedFetch<any>(
          `/portal/documents/students/${studentId}`,
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

      setDocuments([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDocuments(
      student,
    );
  }, [student]);

  async function create(
    event: FormEvent,
  ) {
    event.preventDefault();

    if (!student) {
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      await authedFetch(
        "/portal/documents",
        {
          method: "POST",
          body: JSON.stringify(
            {
              ownerId:
                student,
              ...form,
            },
          ),
        },
      );

      setForm({
        title: "",
        type: "",
        url: "",
      });

      setSuccess(
        "Document added successfully.",
      );

      await loadDocuments(
        student,
      );
    } catch (
      reason
    ) {
      setError(
        reason instanceof
          Error
          ? reason.message
          : "Unable to add document.",
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
    setError("");

    try {
      await authedFetch(
        `/portal/documents/${id}`,
        {
          method: "DELETE",
        },
      );

      setDocuments(
        (current) =>
          current.filter(
            (
              document,
            ) =>
              document.id !==
              id,
          ),
      );

      setSuccess(
        "Document deleted successfully.",
      );
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
    <div className="space-y-5">
      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700">
          {error}
        </div>
      ) : null}

      {success ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-700">
          {success}
        </div>
      ) : null}

      <section className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-600">
            Student document
            workspace
          </p>

          <h2 className="mt-1 text-xl font-black text-slate-950">
            Select a student
          </h2>
        </div>

        <select
          value={student}
          onChange={(event) =>
            setStudent(
              event.target.value,
            )
          }
          className={INPUT}
        >
          <option
            value=""
            className="bg-white text-slate-950"
          >
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
                className="bg-white text-slate-950"
              >
                {lookupLabel(
                  item,
                )}
              </option>
            ),
          )}
        </select>
      </section>

      {student &&
      canManage ? (
        <form
          onSubmit={create}
          className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-sm"
        >
          <div className="mb-4">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-600">
              Create
            </p>

            <h2 className="mt-1 text-xl font-black text-slate-950">
              Add document
            </h2>
          </div>

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
              placeholder="Type"
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
              placeholder="https://…"
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
              type="submit"
              disabled={
                saving
              }
              className={
                ACTION
              }
            >
              {saving
                ? "Adding…"
                : "Add document"}
            </button>
          </div>
        </form>
      ) : null}

      <section className="overflow-hidden rounded-[30px] border border-slate-200 bg-white">
        {loading ? (
          <div className="h-40 animate-pulse bg-slate-100" />
        ) : documents.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-left text-sm">
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
                  (
                    document,
                  ) => (
                    <tr
                      key={
                        document.id
                      }
                    >
                      <td className="px-5 py-4 font-bold text-slate-900">
                        {
                          document.title
                        }
                      </td>

                      <td className="px-5 py-4 text-slate-700">
                        {
                          document.type
                        }
                      </td>

                      <td className="px-5 py-4 text-slate-700">
                        {formatDate(
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
                          className="mr-2 inline-block rounded-xl border border-slate-200 px-3 py-2 text-xs font-black text-slate-800"
                        >
                          Open
                        </a>

                        {canManage ? (
                          <button
                            type="button"
                            disabled={
                              saving
                            }
                            onClick={() =>
                              void remove(
                                document.id,
                              )
                            }
                            className="rounded-xl border border-rose-200 px-3 py-2 text-xs font-black text-rose-600"
                          >
                            Delete
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-12 text-center text-sm text-slate-500">
            Select a student to
            inspect their
            documents.
          </div>
        )}
      </section>
    </div>
  );
}

export function AdminModulePage({
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

  const [loading, setLoading] =
    useState(true);

  useEffect(() => {
    void import(
      "@/lib/auth"
    ).then(
      ({
        getCurrentUser,
      }) =>
        getCurrentUser({
          background: true,
        })
          .then(
            (
              currentUser,
            ) =>
              setPermissions(
                currentUser.permissions,
              ),
          )
          .finally(() =>
            setLoading(false),
          ),
    );
  }, []);

  if (!item) {
    return (
      <div className="rounded-[30px] border border-rose-200 bg-rose-50 p-8 font-black text-rose-700">
        Unknown
        administration
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

        <div className="h-96 rounded-[30px] bg-white animate-pulse" />
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
      <div className="rounded-[30px] border border-slate-200 bg-white p-8">
        <p className="font-black text-slate-950">
          No UI adapter
          configured.
        </p>

        <p className="mt-1 text-sm text-slate-500">
          This admin module
          has no supported
          form contract in
          the current build.
        </p>
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
