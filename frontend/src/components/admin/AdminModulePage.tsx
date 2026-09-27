"use client";

import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";

import { StudentManagement } from "@/components/dashboard/StudentManagement";
import { authedFetch, getCurrentUser } from "@/lib/auth";
import {
  findAdminNavItem,
  type AdminNavItem,
} from "@/lib/adminNavigation";

type Row = Record<string, any> & {
  id?: string;
};

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
  span?: 1 | 2;
};

type Filter = {
  name: string;
  label: string;
  source?: string;
  options?: string[];
};

type Resource = {
  title: string;
  description: string;
  endpoint: string;

  createEndpoint?: string;

  updateEndpoint?: (
    id: string,
  ) => string;

  deleteEndpoint?: (
    row: Row,
  ) => string;

  deleteMethod?:
    | "DELETE"
    | "PATCH";

  deleteBody?: (
    row: Row,
  ) => unknown;

  createFields: Field[];

  updateFields: Field[];

  columns: string[];

  filters?: Filter[];

  detailFields?: string[];

  canCreate?: (
    permissions: string[],
  ) => boolean;

  canUpdate?: (
    permissions: string[],
  ) => boolean;

  canDelete?: (
    permissions: string[],
  ) => boolean;
};

const INPUT =
  "w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-3 text-sm font-medium text-slate-900 caret-slate-900 outline-none placeholder:text-slate-400 transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50 disabled:bg-slate-50 disabled:text-slate-500";

const BUTTON =
  "rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white transition hover:-translate-y-0.5 hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50";

const SECONDARY =
  "rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 transition hover:border-slate-300 hover:bg-slate-50";

const LOOKUPS: Record<
  string,
  string
> = {
  campuses:
    "/campuses?page=1&pageSize=500",

  departments:
    "/departments?page=1&pageSize=500",

  programs:
    "/programs?page=1&pageSize=500",

  years:
    "/academic-years?page=1&pageSize=500",

  semesters:
    "/semesters?page=1&pageSize=500",

  sections:
    "/sections?page=1&pageSize=500",

  courses:
    "/courses?page=1&pageSize=500",

  faculty:
    "/users?page=1&pageSize=500&role=FACULTY",

  users:
    "/users?page=1&pageSize=500",

  parents:
    "/users?page=1&pageSize=500&role=PARENT",

  students:
    "/students?page=1&pageSize=500",

  facilities:
    "/operations/facilities",

  assets:
    "/operations/assets?page=1&pageSize=500",

  assetCategories:
    "/operations/asset-categories",
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

function rowsOf(
  data: any,
): Row[] {
  if (Array.isArray(data)) {
    return data;
  }

  if (
    Array.isArray(
      data?.items,
    )
  ) {
    return data.items;
  }

  if (
    Array.isArray(
      data?.data,
    )
  ) {
    return data.data;
  }

  return [];
}

function text(
  value: any,
): string {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "—";
  }

  if (
    typeof value ===
    "boolean"
  ) {
    return value
      ? "Yes"
      : "No";
  }

  if (Array.isArray(value)) {
    return value
      .map(text)
      .join(", ");
  }

  if (
    typeof value ===
    "object"
  ) {
    return (
      value.name ||
      value.title ||
      value.code ||
      value.email ||
      value.id ||
      "—"
    );
  }

  return String(value);
}

function dateText(
  value: any,
): string {
  if (!value) {
    return "—";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return String(value);
  }

  return date.toLocaleString(
    "en-IN",
    {
      dateStyle:
        "medium",
      timeStyle:
        "short",
    },
  );
}

function labelFor(
  item: Lookup,
): string {
  if (
    item.firstName ||
    item.lastName
  ) {
    const name =
      `${item.firstName || ""} ${
        item.lastName || ""
      }`.trim();

    return item.email
      ? `${name} — ${item.email}`
      : name ||
          item.id ||
          "Unnamed";
  }

  if (
    item.code &&
    item.name
  ) {
    return `${item.code} — ${item.name}`;
  }

  if (
    item.number !==
      undefined &&
    item.name
  ) {
    return `Semester ${item.number} — ${item.name}`;
  }

  return (
    item.name ||
    item.title ||
    item.email ||
    item.code ||
    item.id ||
    "Unnamed"
  );
}

function displayColumn(
  column: string,
): string {
  return column
    .replace(
      /([A-Z])/g,
      " $1",
    )
    .replace(
      /^./,
      (value) =>
        value.toUpperCase(),
    );
}

function rowValue(
  row: Row,
  key: string,
): any {
  if (
    row[key] !==
    undefined
  ) {
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
    const alias of
      aliases[key] || []
  ) {
    if (
      row[alias] !==
      undefined
    ) {
      return row[alias];
    }
  }

  return undefined;
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

function FieldControl({
  field,
  value,
  setValue,
  lookups,
}: {
  field: Field;
  value: any;
  setValue: (
    value: any,
  ) => void;
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
            event.target
              .value,
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
          checked={Boolean(
            value,
          )}
          onChange={(event) =>
            setValue(
              event.target
                .checked,
            )
          }
          className="h-5 w-5 accent-blue-600"
        />

        <span>
          {field.label}
        </span>
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
            event.target
              .value,
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
    );
  }

  return (
    <input
      type={
        field.type ||
        "text"
      }
      value={value ?? ""}
      onChange={(event) =>
        setValue(
          event.target
            .value,
        )
      }
      className={INPUT}
    />
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
  permission: string,
): Resource {
  return {
    ...resource,

    updateEndpoint: (
      id,
    ) =>
      `${base}/${id}`,

    deleteEndpoint: (
      row,
    ) =>
      `${base}/${row.id}`,

    canCreate: (
      permissions,
    ) =>
      permissions.includes(
        `${permission}.create`,
      ),

    canUpdate: (
      permissions,
    ) =>
      permissions.includes(
        `${permission}.update`,
      ),

    canDelete: (
      permissions,
    ) =>
      permissions.includes(
        `${permission}.delete`,
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
          "Manage accounts, roles and active status. Account status is changed through the dedicated status endpoint.",
          "/users?page=1&pageSize=500",

          [
            {
              name: "firstName",
              label:
                "First name",
              required: true,
            },
            {
              name: "lastName",
              label:
                "Last name",
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
            },
            {
              name: "role",
              label: "Role",
              type: "select",
              options:
                ROLES,
              required: true,
            },
          ],

          [
            {
              name: "firstName",
              label:
                "First name",
            },
            {
              name: "lastName",
              label:
                "Last name",
            },
            {
              name: "phone",
              label: "Phone",
            },
            {
              name: "role",
              label: "Role",
              type: "select",
              options:
                ROLES,
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
              options:
                ROLES,
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
      };

    case "departments":
      return withCrud(
        R(
          "Departments",
          "Manage departments and optional campus ownership. Active status is an update-only field.",
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
              source:
                "campuses",
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
              source:
                "campuses",
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
              source:
                "campuses",
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
              name:
                "departmentId",
              label:
                "Department",
              type: "select",
              source:
                "departments",
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
              name:
                "durationYears",
              label:
                "Duration years",
              type: "number",
              required: true,
            },
          ],

          [
            {
              name:
                "departmentId",
              label:
                "Department",
              type: "select",
              source:
                "departments",
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
              name:
                "durationYears",
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
            "durationYears",
            "department",
            "isActive",
          ],

          [
            {
              name:
                "departmentId",
              label:
                "Department",
              source:
                "departments",
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
              label:
                "Start date",
              type: "date",
              required: true,
            },
            {
              name: "endDate",
              label:
                "End date",
              type: "date",
              required: true,
            },
            {
              name: "isCurrent",
              label:
                "Current year",
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
              label:
                "Start date",
              type: "date",
            },
            {
              name: "endDate",
              label:
                "End date",
              type: "date",
            },
            {
              name: "isCurrent",
              label:
                "Current year",
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
          "Create semesters under a program and academic year. Program and year define the relationship and are create-only.",
          "/semesters?page=1&pageSize=500",

          [
            {
              name: "programId",
              label: "Program",
              type: "select",
              source:
                "programs",
              required: true,
            },
            {
              name:
                "academicYearId",
              label:
                "Academic year",
              type: "select",
              source:
                "years",
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
              label:
                "Start date",
              type: "date",
            },
            {
              name: "endDate",
              label:
                "End date",
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
              label:
                "Start date",
              type: "date",
            },
            {
              name: "endDate",
              label:
                "End date",
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
              source:
                "programs",
            },
            {
              name:
                "academicYearId",
              label:
                "Academic year",
              source:
                "years",
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
          "Manage class sections and capacity. Semester assignment is create-only.",
          "/sections?page=1&pageSize=500",

          [
            {
              name:
                "semesterId",
              label:
                "Semester",
              type: "select",
              source:
                "semesters",
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
              name:
                "semesterId",
              label:
                "Semester",
              source:
                "semesters",
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
          "Manage the institutional course catalogue. Active status is update-only.",
          "/courses?page=1&pageSize=500",

          [
            {
              name:
                "departmentId",
              label:
                "Department",
              type: "select",
              source:
                "departments",
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
              name:
                "description",
              label:
                "Description",
              type: "textarea",
            },
          ],

          [
            {
              name:
                "departmentId",
              label:
                "Department",
              type: "select",
              source:
                "departments",
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
              name:
                "description",
              label:
                "Description",
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
              name:
                "departmentId",
              label:
                "Department",
              source:
                "departments",
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
          "Create an offering from course + semester + section. Once created, only faculty assignment and active state are editable.",
          "/course-offerings?page=1&pageSize=500",

          [
            {
              name: "courseId",
              label: "Course",
              type: "select",
              source:
                "courses",
              required: true,
            },
            {
              name:
                "semesterId",
              label:
                "Semester",
              type: "select",
              source:
                "semesters",
              required: true,
            },
            {
              name:
                "sectionId",
              label:
                "Section",
              type: "select",
              source:
                "sections",
              required: true,
            },
            {
              name:
                "facultyId",
              label:
                "Faculty",
              type: "select",
              source:
                "faculty",
            },
          ],

          [
            {
              name:
                "facultyId",
              label:
                "Faculty",
              type: "select",
              source:
                "faculty",
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
              source:
                "courses",
            },
            {
              name:
                "semesterId",
              label:
                "Semester",
              source:
                "semesters",
            },
            {
              name:
                "sectionId",
              label:
                "Section",
              source:
                "sections",
            },
            {
              name:
                "facultyId",
              label:
                "Faculty",
              source:
                "faculty",
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
          "Manage campus identity, code and address. Active status is update-only.",
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
            },
            {
              name: "audience",
              label: "Audience",
              type: "select",
              options:
                AUDIENCES,
            },
            {
              name:
                "departmentId",
              label:
                "Department",
              type: "select",
              source:
                "departments",
            },
            {
              name:
                "expiresAt",
              label: "Expires",
              type: "datetime-local",
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
            },
            {
              name: "audience",
              label: "Audience",
              type: "select",
              options:
                AUDIENCES,
            },
            {
              name:
                "departmentId",
              label:
                "Department",
              type: "select",
              source:
                "departments",
            },
            {
              name:
                "expiresAt",
              label: "Expires",
              type: "datetime-local",
            },
          ],

          [
            "title",
            "audience",
            "department",
            "expiresAt",
            "createdAt",
          ],
        ),

        updateEndpoint: (
          id,
        ) =>
          `/erp/notices/${id}`,

        deleteEndpoint: (
          row,
        ) =>
          `/erp/notices/${row.id}`,

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
      };

    case "calendar":
      return {
        ...R(
          "Calendar",
          "Manage institutional events without mixing create-only and update-only fields.",
          "/calendar/events?page=1&pageSize=500",

          [
            {
              name: "title",
              label: "Title",
              required: true,
            },
            {
              name:
                "description",
              label:
                "Description",
              type: "textarea",
            },
            {
              name:
                "eventType",
              label:
                "Event type",
              type: "select",
              options:
                EVENT_TYPES,
            },
            {
              name:
                "startDate",
              label: "Start",
              type: "datetime-local",
              required: true,
            },
            {
              name:
                "endDate",
              label: "End",
              type: "datetime-local",
              required: true,
            },
            {
              name:
                "academicYearId",
              label:
                "Academic year",
              type: "select",
              source:
                "years",
            },
            {
              name:
                "audience",
              label:
                "Audience",
              type: "select",
              options:
                CALENDAR_AUDIENCES,
            },
          ],

          [
            {
              name: "title",
              label: "Title",
            },
            {
              name:
                "description",
              label:
                "Description",
              type: "textarea",
            },
            {
              name:
                "eventType",
              label:
                "Event type",
              type: "select",
              options:
                EVENT_TYPES,
            },
            {
              name:
                "startDate",
              label: "Start",
              type: "datetime-local",
            },
            {
              name:
                "endDate",
              label: "End",
              type: "datetime-local",
            },
            {
              name:
                "academicYearId",
              label:
                "Academic year",
              type: "select",
              source:
                "years",
            },
            {
              name:
                "audience",
              label:
                "Audience",
              type: "select",
              options:
                CALENDAR_AUDIENCES,
            },
          ],

          [
            "title",
            "eventType",
            "audience",
            "startDate",
            "endDate",
          ],
        ),

        updateEndpoint: (
          id,
        ) =>
          `/calendar/events/${id}`,

        deleteEndpoint: (
          row,
        ) =>
          `/calendar/events/${row.id}`,

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
      };

    case "parent-links":
      return {
        ...R(
          "Parent links",
          "Connect parent accounts to student records. Links are immutable after creation and can be removed.",
          "/erp/parent-links?page=1&pageSize=500",

          [
            {
              name:
                "parentId",
              label: "Parent",
              type: "select",
              source:
                "parents",
              required: true,
            },
            {
              name:
                "studentId",
              label: "Student",
              type: "select",
              source:
                "students",
              required: true,
            },
            {
              name:
                "relationship",
              label:
                "Relationship",
            },
          ],

          [],

          [
            "parent",
            "student",
            "relationship",
            "createdAt",
          ],
        ),

        createEndpoint:
          "/erp/parent-links",

        deleteEndpoint: (
          row,
        ) =>
          `/erp/parent-links/${row.parentId}/${row.studentId}`,

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
      };

    default:
      return null;
  }
}

function DetailDrawer({
  row,
  fields,
  onClose,
}: {
  row: Row;
  fields: string[];
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[120] bg-slate-950/55 p-4 backdrop-blur-sm"
      onMouseDown={
        onClose
      }
    >
      <aside
        className="ml-auto flex h-full max-w-xl flex-col overflow-hidden rounded-[30px] bg-white shadow-2xl"
        onMouseDown={(
          event,
        ) =>
          event.stopPropagation()
        }
      >
        <div className="flex items-center justify-between border-b border-slate-100 p-6">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-600">
              Record details
            </p>

            <h3 className="mt-1 text-2xl font-black text-slate-950">
              {text(
                row.name ||
                  row.title ||
                  row.email ||
                  row.code ||
                  row.id,
              )}
            </h3>
          </div>

          <button
            type="button"
            className={
              SECONDARY
            }
            onClick={
              onClose
            }
          >
            Close
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid gap-3">
            {fields.map(
              (field) => {
                const value =
                  rowValue(
                    row,
                    field,
                  );

                const isDate =
                  field
                    .toLowerCase()
                    .includes(
                      "date",
                    ) ||
                  field
                    .toLowerCase()
                    .endsWith(
                      "at",
                    );

                return (
                  <div
                    key={
                      field
                    }
                    className="rounded-2xl border border-slate-100 bg-slate-50 p-4"
                  >
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                      {displayColumn(
                        field,
                      )}
                    </p>

                    <p className="mt-1 break-words text-sm font-bold text-slate-800">
                      {isDate
                        ? dateText(
                            value,
                          )
                        : text(
                            value,
                          )}
                    </p>
                  </div>
                );
              },
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}

function ResourceManager({
  def,
  permissions,
}: {
  def: Resource;
  permissions: string[];
}) {
  const [
    data,
    setData,
  ] = useState<Row[]>(
    [],
  );

  const [
    lookups,
    setLookups,
  ] = useState<
    Record<
      string,
      Lookup[]
    >
  >({});

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  const [
    success,
    setSuccess,
  ] = useState("");

  const [
    search,
    setSearch,
  ] = useState("");

  const [
    filters,
    setFilters,
  ] = useState<
    Record<
      string,
      string
    >
  >({});

  const [
    selected,
    setSelected,
  ] = useState<Row | null>(
    null,
  );

  const [
    open,
    setOpen,
  ] = useState(false);

  const [
    editing,
    setEditing,
  ] = useState<Row | null>(
    null,
  );

  const [
    form,
    setForm,
  ] = useState<Row>({});

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

  const fields =
    editing
      ? def.updateFields
      : def.createFields;

  const sources =
    useMemo(
      () => [
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

                if (
                  typeof actual ===
                    "object" &&
                  actual
                ) {
                  return (
                    String(
                      actual.id ||
                        actual.code ||
                        actual.name ||
                        "",
                    ) ===
                    value
                  );
                }

                return (
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

  function openEdit(
    row: Row,
  ) {
    const next: Row =
      {};

    for (
      const field of
        def.updateFields
    ) {
      next[
        field.name
      ] =
        rowValue(
          row,
          field.name,
        ) ??
        row[
          field.name
        ] ??
        "";
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
        value !==
          undefined
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

  async function save(
    event: FormEvent,
  ) {
    event.preventDefault();

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
          ] ===
            "" ||
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

    setSaving(true);
    setError("");

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

    if (
      !window.confirm(
        `Remove ${text(
          row.name ||
            row.title ||
            row.email ||
            row.code ||
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
    <section className="overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-[0_14px_45px_rgba(15,23,42,0.06)]">
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
              {
                filtered.length
              }{" "}
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
                event.target
                  .value,
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
                    ] ||
                    ""
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
                    (
                      option,
                    ) => (
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
                      row.id ||
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
                            className="max-w-[260px] truncate px-5 py-4 font-medium text-slate-700"
                          >
                            {isDate
                              ? dateText(
                                  value,
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
                        className="mr-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-black text-slate-700"
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
                          className="mr-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-black text-slate-700"
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
        <DetailDrawer
          row={
            selected
          }
          fields={
            def.detailFields ||
            def.columns
          }
          onClose={() =>
            setSelected(
              null,
            )
          }
        />
      )}

      {open && (
        <div className="fixed inset-0 z-[100] overflow-y-auto bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="mx-auto my-8 max-w-4xl overflow-hidden rounded-[30px] bg-slate-50 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-5">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-600">
                  {editing
                    ? "Update"
                    : "Create"}
                </p>

                <h3 className="mt-1 text-2xl font-black text-slate-950">
                  {def.title}
                </h3>
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
              onSubmit={
                save
              }
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
                      {field.type !==
                        "checkbox" && (
                        <span className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
                          {
                            field.label
                          }

                          {field.required
                            ? " *"
                            : ""}
                        </span>
                      )}

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
                  type="submit"
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
  ] = useState<
    Lookup[]
  >([]);

  const [
    student,
    setStudent,
  ] = useState("");

  const [
    documents,
    setDocuments,
  ] = useState<Row[]>(
    [],
  );

  const [
    loading,
    setLoading,
  ] = useState(false);

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  const [
    form,
    setForm,
  ] = useState({
    title: "",
    type: "",
    url: "",
  });

  const canManage =
    permissions.includes(
      "students.update",
    );

  async function load() {
    if (!student) {
      setDocuments([]);
      return;
    }

    setLoading(true);

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

  useEffect(
    () => {
      void authedFetch<any>(
        "/students?page=1&pageSize=500",
      )
        .then(
          (response) =>
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

  async function save(
    event: FormEvent,
  ) {
    event.preventDefault();

    if (!student) {
      return;
    }

    setSaving(true);
    setError("");

    try {
      await authedFetch(
        "/portal/documents",
        {
          method: "POST",
          body:
            JSON.stringify({
              ownerId:
                student,
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
          method:
            "DELETE",
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
    <div className="space-y-5">
      <section className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-sm">
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

      <section className="overflow-hidden rounded-[30px] border border-slate-200 bg-white">
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
                  (
                    document,
                  ) => (
                    <tr
                      key={
                        document.id
                      }
                    >
                      <td className="px-5 py-4 font-bold text-slate-800">
                        {text(
                          document.title,
                        )}
                      </td>

                      <td className="px-5 py-4 text-slate-600">
                        {text(
                          document.type,
                        )}
                      </td>

                      <td className="px-5 py-4 text-slate-600">
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
                          className="mr-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-black text-slate-700"
                        >
                          Open
                        </a>

                        {canManage && (
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
  ] = useState<
    Lookup[]
  >([]);

  const [
    selected,
    setSelected,
  ] = useState<
    string[]
  >([]);

  const [
    history,
    setHistory,
  ] = useState<Row[]>(
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
    error,
    setError,
  ] = useState("");

  const [
    saving,
    setSaving,
  ] = useState(false);

  const canSend =
    permissions.includes(
      "notices.manage",
    );

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
    } catch (
      reason
    ) {
      setError(
        reason instanceof
          Error
          ? reason.message
          : "Unable to load notification history.",
      );
    }
  }

  useEffect(
    () => {
      void Promise.all([
        authedFetch<any>(
          "/users?page=1&pageSize=500",
        ).then(
          (response) =>
            setUsers(
              rowsOf(
                response.data,
              ),
            ),
        ),
        loadHistory(),
      ]);
    },
    [],
  );

  async function send(
    event: FormEvent,
  ) {
    event.preventDefault();

    if (!selected.length) {
      setError(
        "Select at least one recipient.",
      );

      return;
    }

    setSaving(true);
    setError("");

    try {
      await authedFetch(
        selected.length ===
          1
          ? "/portal/notifications"
          : "/portal/notifications/bulk",
        {
          method: "POST",
          body:
            JSON.stringify(
              selected.length ===
                1
                ? {
                    userId:
                      selected[0],
                    ...form,
                  }
                : {
                    userIds:
                      selected,
                    ...form,
                  },
            ),
        },
      );

      setSelected([]);

      setForm({
        title: "",
        body: "",
      });

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
    <div className="space-y-5">
      <form
        onSubmit={
          send
        }
        className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-sm"
      >
        <div className="grid gap-4">
          <label>
            <span className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-slate-500">
              Recipients
            </span>

            <select
              multiple
              value={
                selected
              }
              onChange={(
                event,
              ) =>
                setSelected(
                  Array.from(
                    (
                      event.target as HTMLSelectElement
                    )
                      .selectedOptions,
                    (
                      option,
                    ) =>
                      option.value,
                  ),
                )
              }
              className={`${INPUT} min-h-44`}
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

            <span className="mt-1 block text-xs text-slate-400">
              Hold Command/Ctrl
              to select multiple
              recipients.
            </span>
          </label>

          <input
            required
            placeholder="Notification title"
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

          <textarea
            required
            placeholder="Message"
            value={
              form.body
            }
            onChange={(
              event,
            ) =>
              setForm({
                ...form,
                body:
                  event
                    .target
                    .value,
              })
            }
            className={`${INPUT} min-h-32`}
          />

          <div className="flex justify-end">
            <button
              disabled={
                !canSend ||
                saving
              }
              className={
                BUTTON
              }
            >
              {saving
                ? "Sending…"
                : selected.length >
                    1
                  ? `Send to ${selected.length} users`
                  : "Send notification"}
            </button>
          </div>
        </div>
      </form>

      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700">
          {error}
        </div>
      )}

      <section className="overflow-hidden rounded-[30px] border border-slate-200 bg-white">
        <div className="border-b border-slate-100 p-5">
          <h2 className="font-black text-slate-950">
            Notification history
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-left text-sm">
            <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-400">
              <tr>
                <th className="px-5 py-4">
                  Title
                </th>

                <th className="px-5 py-4">
                  Message
                </th>

                <th className="px-5 py-4">
                  Created
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {history.map(
                (
                  item,
                  index,
                ) => (
                  <tr
                    key={
                      item.id ||
                      index
                    }
                  >
                    <td className="px-5 py-4 font-bold text-slate-800">
                      {text(
                        item.title,
                      )}
                    </td>

                    <td className="max-w-xl px-5 py-4 text-slate-600">
                      {text(
                        item.body,
                      )}
                    </td>

                    <td className="px-5 py-4 text-slate-500">
                      {dateText(
                        item.createdAt,
                      )}
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
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

        [],

        [
          "name",
          "code",
        ],
      ),

      createEndpoint:
        "/operations/asset-categories",

      canCreate: (
        permissions,
      ) =>
        permissions.includes(
          "operations.manage",
        ),
    },

    assets: {
      ...R(
        "Assets",
        "Manage institutional inventory. Asset tag, category and campus are create-only; operational fields are updateable.",
        "/operations/assets?page=1&pageSize=500",

        [
          {
            name: "name",
            label: "Name",
            required: true,
          },
          {
            name:
              "assetTag",
            label:
              "Asset tag",
            required: true,
          },
          {
            name:
              "assetCategoryId",
            label:
              "Category",
            type: "select",
            source:
              "assetCategories",
          },
          {
            name:
              "campusId",
            label: "Campus",
            type: "select",
            source:
              "campuses",
          },
          {
            name:
              "departmentId",
            label:
              "Department",
            type: "select",
            source:
              "departments",
          },
          {
            name:
              "serialNumber",
            label:
              "Serial number",
          },
          {
            name:
              "location",
            label:
              "Location",
          },
          {
            name:
              "quantity",
            label:
              "Quantity",
            type: "number",
          },
          {
            name:
              "unitCost",
            label:
              "Unit cost",
            type: "number",
          },
          {
            name:
              "purchaseDate",
            label:
              "Purchase date",
            type: "date",
          },
          {
            name:
              "warrantyEndsAt",
            label:
              "Warranty ends",
            type: "date",
          },
          {
            name:
              "condition",
            label:
              "Condition",
            type: "select",
            options:
              CONDITIONS,
          },
          {
            name:
              "status",
            label: "Status",
            type: "select",
            options:
              ASSET_STATUSES,
          },
          {
            name:
              "assignedToId",
            label:
              "Assigned to",
            type: "select",
            source:
              "users",
          },
          {
            name: "notes",
            label: "Notes",
            type: "textarea",
          },
        ],

        [
          {
            name: "name",
            label: "Name",
          },
          {
            name:
              "location",
            label:
              "Location",
          },
          {
            name:
              "quantity",
            label:
              "Quantity",
            type: "number",
          },
          {
            name:
              "condition",
            label:
              "Condition",
            type: "select",
            options:
              CONDITIONS,
          },
          {
            name:
              "status",
            label: "Status",
            type: "select",
            options:
              ASSET_STATUSES,
          },
          {
            name:
              "departmentId",
            label:
              "Department",
            type: "select",
            source:
              "departments",
          },
          {
            name:
              "assignedToId",
            label:
              "Assigned to",
            type: "select",
            source:
              "users",
          },
          {
            name: "notes",
            label: "Notes",
            type: "textarea",
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
            name:
              "status",
            label: "Status",
            options:
              ASSET_STATUSES,
          },
          {
            name:
              "condition",
            label:
              "Condition",
            options:
              CONDITIONS,
          },
        ],
      ),

      createEndpoint:
        "/operations/assets",

      updateEndpoint: (
        id,
      ) =>
        `/operations/assets/${id}`,

      canCreate: (
        permissions,
      ) =>
        permissions.includes(
          "operations.manage",
        ),

      canUpdate: (
        permissions,
      ) =>
        permissions.includes(
          "operations.manage",
        ),
    },

    facilities: {
      ...R(
        "Facilities",
        "Manage institutional facilities and capacity.",
        "/operations/facilities",

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
            name:
              "facilityType",
            label: "Type",
            type: "select",
            options:
              FACILITY_TYPES,
          },
          {
            name:
              "capacity",
            label:
              "Capacity",
            type: "number",
          },
          {
            name:
              "campusId",
            label: "Campus",
            type: "select",
            source:
              "campuses",
          },
          {
            name:
              "location",
            label:
              "Location",
          },
        ],

        [
          {
            name: "name",
            label: "Name",
          },
          {
            name:
              "facilityType",
            label: "Type",
            type: "select",
            options:
              FACILITY_TYPES,
          },
          {
            name:
              "capacity",
            label:
              "Capacity",
            type: "number",
          },
          {
            name:
              "location",
            label:
              "Location",
          },
          {
            name:
              "isActive",
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
            name:
              "facilityType",
            label: "Type",
            options:
              FACILITY_TYPES,
          },
        ],
      ),

      createEndpoint:
        "/operations/facilities",

      updateEndpoint: (
        id,
      ) =>
        `/operations/facilities/${id}`,

      canCreate: (
        permissions,
      ) =>
        permissions.includes(
          "operations.manage",
        ),

      canUpdate: (
        permissions,
      ) =>
        permissions.includes(
          "operations.manage",
        ),
    },

    maintenance: {
      ...R(
        "Maintenance",
        "Raise and update maintenance requests. Creation and lifecycle updates use different backend contracts.",
        "/operations/maintenance?page=1&pageSize=500",

        [
          {
            name:
              "facilityId",
            label:
              "Facility",
            type: "select",
            source:
              "facilities",
          },
          {
            name:
              "assetId",
            label: "Asset",
            type: "select",
            source:
              "assets",
          },
          {
            name: "title",
            label: "Title",
            required: true,
          },
          {
            name:
              "description",
            label:
              "Description",
            type: "textarea",
            required: true,
          },
          {
            name:
              "priority",
            label:
              "Priority",
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
            name:
              "assignedToId",
            label:
              "Assigned to",
            type: "select",
            source:
              "users",
          },
          {
            name:
              "resolutionNote",
            label:
              "Resolution note",
            type: "textarea",
          },
          {
            name:
              "priority",
            label:
              "Priority",
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
            name:
              "priority",
            label:
              "Priority",
            options:
              PRIORITIES,
          },
          {
            name:
              "status",
            label: "Status",
            options:
              MAINTENANCE_STATUS,
          },
        ],
      ),

      createEndpoint:
        "/operations/maintenance",

      updateEndpoint: (
        id,
      ) =>
        `/operations/maintenance/${id}`,

      canCreate: (
        permissions,
      ) =>
        permissions.includes(
          "maintenance.raise",
        ),

      canUpdate: (
        permissions,
      ) =>
        permissions.includes(
          "maintenance.raise",
        ),
    },
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 rounded-[24px] border border-slate-200 bg-white p-2">
        {Object.entries(
          definitions,
        ).map(
          ([
            key,
            definition,
          ]) => (
            <button
              type="button"
              key={key}
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
    resource(
      module,
    );

  if (!definition) {
    return (
      <div className="rounded-[30px] border border-slate-200 bg-white p-8 text-slate-600">
        No administration
        adapter configured.
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
