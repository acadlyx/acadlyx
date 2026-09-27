"use client";

import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  StudentManagement,
} from "@/components/dashboard/StudentManagement";

import {
  authedFetch,
} from "@/lib/auth";

import {
  findAdminNavItem,
  type AdminNavItem,
} from "@/lib/adminNavigation";

type Row =
  Record<string, any> & {
    id?: string;
  };

type Lookup = {
  id: string;
  name?: string;
  code?: string;
  number?: number;
  programId?: string;
  academicYearId?: string;
  semesterId?: string;
  isActive?: boolean;
  isCurrent?: boolean;
};

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
  hiddenOnEdit?: boolean;
  colSpan?: 1 | 2;
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

  fields: Field[];

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
  "w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50 disabled:bg-slate-50";

const BUTTON =
  "rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white transition hover:-translate-y-0.5 hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50";

const SECONDARY =
  "rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 transition hover:border-slate-300 hover:bg-slate-50";

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

  if (
    typeof value ===
    "object"
  ) {
    return (
      value.name ||
      value.code ||
      value.title ||
      value.email ||
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
    item.code ||
    item.id
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
  const direct =
    row[key];

  if (
    direct !==
    undefined
  ) {
    if (
      key === "role" &&
      Array.isArray(direct)
    ) {
      return (
        direct[0]?.name ||
        direct[0] ||
        "—"
      );
    }

    return direct;
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

function permission(
  permissions: string[],
  value: string,
) {
  return permissions.includes(
    value,
  );
}

function canAny(
  permissions: string[],
  values: string[],
) {
  return values.some(
    (value) =>
      permissions.includes(
        value,
      ),
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

function Control({
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
      <label className="flex min-h-12 items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold">
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

function resource(
  module: string,
): Resource | null {
  const R = (
    title: string,
    description: string,
    endpoint: string,
    fields: Field[],
    columns: string[],
    filters: Filter[] = [],
    detailFields = columns,
  ): Resource => ({
    title,
    description,
    endpoint,
    fields,
    columns,
    filters,
    detailFields,
  });

  const crud = (
    base: string,
    permissionKey: string,
  ) => ({
    updateEndpoint: (
      id: string,
    ) =>
      `${base}/${id}`,

    deleteEndpoint: (
      row: Row,
    ) =>
      `${base}/${row.id}`,

    canCreate: (
      permissions: string[],
    ) =>
      permission(
        permissions,
        `${permissionKey}.create`,
      ),

    canUpdate: (
      permissions: string[],
    ) =>
      permission(
        permissions,
        `${permissionKey}.update`,
      ),

    canDelete: (
      permissions: string[],
    ) =>
      permission(
        permissions,
        `${permissionKey}.delete`,
      ),
  });

  const map: Record<
    string,
    Resource
  > = {
    users: {
      ...R(
        "Institution users",
        "Complete institutional account management, roles and account status.",
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
            hiddenOnEdit: true,
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
            hiddenOnEdit: true,
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
        permission(
          permissions,
          "users.create",
        ),

      canUpdate: (
        permissions,
      ) =>
        permission(
          permissions,
          "users.update",
        ),

      canDelete: (
        permissions,
      ) =>
        permission(
          permissions,
          "users.delete",
        ),
    },

    departments: {
      ...R(
        "Departments",
        "Manage academic departments, campus ownership and status.",
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
            required: true,
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

      ...crud(
        "/departments",
        "departments",
      ),
    },

    programs: {
      ...R(
        "Programs",
        "Manage programs, levels, duration and department ownership.",
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
            label:
              "Duration years",
            type: "number",
            required: true,
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

      ...crud(
        "/programs",
        "programs",
      ),
    },

    "academic-years": {
      ...R(
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

      updateEndpoint: (
        id,
      ) =>
        `/academic-years/${id}`,

      canCreate: (
        permissions,
      ) =>
        permission(
          permissions,
          "academic-years.create",
        ),

      canUpdate: (
        permissions,
      ) =>
        permission(
          permissions,
          "academic-years.update",
        ),
    },

    semesters: {
      ...R(
        "Semesters",
        "Manage semester definitions under programs and academic years.",
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

      ...crud(
        "/semesters",
        "semesters",
      ),
    },

    sections: {
      ...R(
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

      ...crud(
        "/sections",
        "sections",
      ),
    },

    courses: {
      ...R(
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

      ...crud(
        "/courses",
        "courses",
      ),
    },

    "course-offerings": {
      ...R(
        "Course offerings",
        "Assign courses to semesters, sections and faculty, with roster access from the same workspace.",
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

      ...crud(
        "/course-offerings",
        "course-offerings",
      ),
    },

    campuses: {
      ...R(
        "Campuses",
        "Manage campuses, codes, addresses and activation state.",
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

      ...crud(
        "/campuses",
        "campuses",
      ),
    },

    notices: {
      ...R(
        "Notices",
        "Create, target, publish and retire institution notices.",
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
            label: "Expires",
            type: "datetime-local",
          },
        ],
        [
          "title",
          "audience",
          "expiresAt",
          "createdAt",
        ],
        [
          {
            name: "audience",
            label: "Audience",
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
        permission(
          permissions,
          "notices.manage",
        ),

      canUpdate: (
        permissions,
      ) =>
        permission(
          permissions,
          "notices.manage",
        ),

      canDelete: (
        permissions,
      ) =>
        permission(
          permissions,
          "notices.manage",
        ),
    },

    calendar: {
      ...R(
        "Calendar",
        "Manage institutional events with academic year, audience, type and date controls.",
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
          {
            name: "academicYearId",
            label: "Academic year",
            type: "select",
            source: "years",
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
            options: [
              "HOLIDAY",
              "EXAM",
              "EVENT",
              "DEADLINE",
              "ACADEMIC",
            ],
          },
          {
            name: "audience",
            label: "Audience",
            options: [
              "ALL",
              "STUDENTS",
              "FACULTY",
              "STAFF",
            ],
          },
          {
            name: "academicYearId",
            label: "Academic year",
            source: "years",
          },
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
        permission(
          permissions,
          "calendar.manage",
        ),

      canUpdate: (
        permissions,
      ) =>
        permission(
          permissions,
          "calendar.manage",
        ),

      canDelete: (
        permissions,
      ) =>
        permission(
          permissions,
          "calendar.manage",
        ),
    },

    "parent-links": {
      ...R(
        "Parent links",
        "Connect parent accounts with student records and relationship type.",
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
            required: true,
          },
        ],
        [
          "parent",
          "student",
          "relationship",
          "createdAt",
        ],
        [
          {
            name: "parentId",
            label: "Parent",
            source: "parents",
          },
          {
            name: "studentId",
            label: "Student",
            source: "students",
          },
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
        permission(
          permissions,
          "parent-links.manage",
        ),

      canDelete: (
        permissions,
      ) =>
        permission(
          permissions,
          "parent-links.manage",
        ),
    },

    notifications: {
      ...R(
        "Notifications",
        "Send targeted notifications and inspect notification history.",
        "/portal/notifications?page=1&limit=200",
        [
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
          },
        ],
        [
          "title",
          "body",
          "readAt",
          "createdAt",
        ],
        [
          {
            name: "userId",
            label: "Recipient",
            source: "users",
          },
        ],
      ),

      createEndpoint:
        "/portal/notifications",

      canCreate: (
        permissions,
      ) =>
        permission(
          permissions,
          "notices.manage",
        ),
    },
  };

  return (
    map[module] ||
    null
  );
}

function Detail({
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
      className="fixed inset-0 z-[110] bg-slate-950/50 p-4 backdrop-blur-sm"
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
              (field) => (
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
                    {field
                      .toLowerCase()
                      .includes(
                        "date",
                      ) ||
                    field
                      .toLowerCase()
                      .endsWith(
                        "at",
                      )
                      ? dateText(
                          rowValue(
                            row,
                            field,
                          ),
                        )
                      : text(
                          rowValue(
                            row,
                            field,
                          ),
                        )}
                  </p>
                </div>
              ),
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

  const sources =
    useMemo(
      () =>
        [
          ...new Set(
            def.fields
              .map(
                (
                  field,
                ) =>
                  field.source,
              )
              .filter(
                Boolean,
              ) as string[],
          ),
        ],
      [def.fields],
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
                  "object"
                ) {
                  return (
                    String(
                      actual?.id ||
                        actual?.code ||
                        actual?.name ||
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

  function normalize(
    row: Row,
  ) {
    const next = {
      ...row,
    };

    for (
      const field of
        def.fields
    ) {
      if (
        (
          field.type ===
            "date" ||
          field.type ===
            "datetime-local"
        ) &&
        next[
          field.name
        ]
      ) {
        const date =
          new Date(
            next[
              field.name
            ],
          );

        if (
          !Number.isNaN(
            date.getTime(),
          )
        ) {
          next[
            field.name
          ] =
            field.type ===
            "datetime-local"
              ? date
                  .toISOString()
                  .slice(
                    0,
                    16,
                  )
              : date
                  .toISOString()
                  .slice(
                    0,
                    10,
                  );
        }
      }
    }

    return next;
  }

  function openCreate() {
    setEditing(null);
    setForm({});
    setError("");
    setOpen(true);
  }

  function openEdit(
    row: Row,
  ) {
    setEditing(row);
    setForm(
      normalize(row),
    );
    setError("");
    setOpen(true);
  }

  function payload() {
    const output: Row =
      {};

    for (
      const field of
        def.fields
    ) {
      if (
        editing &&
        field.hiddenOnEdit
      ) {
        continue;
      }

      let value =
        form[
          field.name
        ];

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

  async function save(
    event: FormEvent,
  ) {
    event.preventDefault();

    for (
      const field of
        def.fields
    ) {
      if (
        field.required &&
        !form[
          field.name
        ]
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
              {filtered.length} visible
              {" "}
              of{" "}
              {data.length}
              {" "}
              records
            </p>
          </div>

          {canCreate && (
            <button
              className={
                BUTTON
              }
              onClick={
                openCreate
              }
            >
              + Create{" "}
              {def.title.replace(
                /s$/i,
                "",
              )}
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
          {[
            1,
            2,
            3,
          ].map(
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
                      ) => (
                        <td
                          key={
                            column
                          }
                          className="max-w-[260px] truncate px-5 py-4 font-medium text-slate-700"
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
                                rowValue(
                                  row,
                                  column,
                                ),
                              )
                            : text(
                                rowValue(
                                  row,
                                  column,
                                ),
                              )}
                        </td>
                      ),
                    )}

                    <td className="whitespace-nowrap px-5 py-4 text-right">
                      <button
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

                <h3 className="mt-1 text-2xl font-black">
                  {def.title}
                </h3>
              </div>

              <button
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
                {def.fields
                  .filter(
                    (
                      field,
                    ) =>
                      !(
                        editing &&
                        field.hiddenOnEdit
                      ),
                  )
                  .map(
                    (
                      field,
                    ) => (
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
                        </span>

                        <Control
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

  const canCreate =
    canAny(
      permissions,
      [
        "documents.manage",
        "students.update",
      ],
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
              ) as Lookup[],
            ),
        )
        .catch(() =>
          setStudents(
            [],
          ),
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
        <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
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
              className={
                INPUT
              }
            >
              <option value="">
                Select student
              </option>

              {students.map(
                (
                  studentItem,
                ) => (
                  <option
                    key={
                      studentItem.id
                    }
                    value={
                      studentItem.id
                    }
                  >
                    {labelFor(
                      studentItem,
                    )}
                  </option>
                ),
              )}
            </select>
          </label>

          {student && (
            <div className="rounded-2xl bg-slate-950 px-5 py-4 text-sm font-bold text-white">
              {
                documents.length
              }{" "}
              document
              {documents.length ===
              1
                ? ""
                : "s"}
            </div>
          )}
        </div>
      </section>

      {student &&
        canCreate && (
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

                        {canCreate &&
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
      title:
        "Asset categories",
      description:
        "Manage reusable categories used by the institutional asset register.",
      endpoint:
        "/operations/asset-categories",
      fields: [
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
      columns: [
        "name",
        "code",
        "assetCount",
      ],
      canCreate: (
        permissions,
      ) =>
        permission(
          permissions,
          "operations.manage",
        ),
    },

    assets: {
      title: "Assets",
      description:
        "Manage operational inventory and asset lifecycle.",
      endpoint:
        "/operations/assets?page=1&pageSize=500",
      fields: [
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
          name: "notes",
          label: "Notes",
          type: "textarea",
        },
      ],
      columns: [
        "name",
        "assetTag",
        "status",
        "condition",
        "location",
      ],
      filters: [
        {
          name: "departmentId",
          label: "Department",
          source:
            "departments",
        },
        {
          name: "status",
          label: "Status",
          options: [
            "IN_USE",
            "IN_STORE",
            "UNDER_REPAIR",
            "RETIRED",
            "LOST",
          ],
        },
      ],
      updateEndpoint: (
        id,
      ) =>
        `/operations/assets/${id}`,
      canCreate: (
        permissions,
      ) =>
        permission(
          permissions,
          "operations.manage",
        ),
      canUpdate: (
        permissions,
      ) =>
        permission(
          permissions,
          "operations.manage",
        ),
    },

    facilities: {
      title: "Facilities",
      description:
        "Manage institutional facilities and capacity.",
      endpoint:
        "/operations/facilities",
      fields: [
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
          source:
            "campuses",
        },
        {
          name: "location",
          label: "Location",
        },
      ],
      columns: [
        "name",
        "code",
        "facilityType",
        "capacity",
        "location",
      ],
      filters: [
        {
          name: "facilityType",
          label: "Type",
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
      ],
      updateEndpoint: (
        id,
      ) =>
        `/operations/facilities/${id}`,
      canCreate: (
        permissions,
      ) =>
        permission(
          permissions,
          "operations.manage",
        ),
      canUpdate: (
        permissions,
      ) =>
        permission(
          permissions,
          "operations.manage",
        ),
    },

    maintenance: {
      title:
        "Maintenance",
      description:
        "Manage maintenance requests, priorities, status and resolution notes.",
      endpoint:
        "/operations/maintenance?page=1&pageSize=500",
      fields: [
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
          name: "resolutionNote",
          label:
            "Resolution note",
          type: "textarea",
        },
      ],
      columns: [
        "title",
        "priority",
        "status",
        "createdAt",
      ],
      filters: [
        {
          name: "priority",
          label: "Priority",
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
          options: [
            "OPEN",
            "ASSIGNED",
            "IN_PROGRESS",
            "RESOLVED",
            "CLOSED",
            "REJECTED",
          ],
        },
      ],
      updateEndpoint: (
        id,
      ) =>
        `/operations/maintenance/${id}`,
      canCreate: (
        permissions,
      ) =>
        canAny(
          permissions,
          [
            "operations.manage",
            "maintenance.raise",
          ],
        ),
      canUpdate: (
        permissions,
      ) =>
        canAny(
          permissions,
          [
            "operations.manage",
            "maintenance.raise",
          ],
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
              setLoading(
                false,
              ),
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
      <div className="rounded-[30px] border border-slate-200 bg-white p-8">
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
