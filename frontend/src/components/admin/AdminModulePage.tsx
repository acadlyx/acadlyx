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

const INPUT =
  "w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-3 text-sm outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50";

const ACTION =
  "rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white transition hover:-translate-y-0.5 hover:bg-blue-600 disabled:opacity-50";

type Row =
  Record<string, any> & {
    id?: string;
  };

type Lookup = {
  id: string;
  name?: string;
  code?: string;
  number?: number;
};

type Field = {
  name: string;
  label: string;
  type?:
    | "text"
    | "email"
    | "password"
    | "number"
    | "date"
    | "datetime-local"
    | "textarea"
    | "select"
    | "checkbox";
  required?: boolean;
  source?: string;
  options?: string[];
  hiddenOnEdit?: boolean;
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

function show(
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
      JSON.stringify(value)
    );
  }

  return String(value);
}

function formatDate(
  value: any,
) {
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

function lookupLabel(
  item: Lookup,
) {
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
};

function control(
  field: Field,
  value: any,
  setValue: (
    value: any,
  ) => void,
  lookups: Record<
    string,
    Lookup[]
  >,
) {
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
        className={`${INPUT} min-h-28`}
      />
    );
  }

  if (
    field.type ===
    "checkbox"
  ) {
    return (
      <label className="flex h-12 items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold">
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

        {field.source
          ? lookups[
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
        field.type ||
        "text"
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

function resource(
  module: string,
): Resource | null {
  const R = (
    title: string,
    description: string,
    endpoint: string,
    fields: Field[],
    columns: string[],
  ): Resource => ({
    title,
    description,
    endpoint,
    fields,
    columns,
  });

  const map: Record<
    string,
    Resource
  > = {
    users: {
      ...R(
        "Institution users",
        "Manage institutional accounts and access roles.",
        "/users?page=1&pageSize=200",
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
            label: "Temporary password",
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
      ),

      updateEndpoint: (
        id,
      ) => `/users/${id}`,

      deleteEndpoint: (
        row,
      ) =>
        `/users/${row.id}/status`,

      deleteMethod:
        "PATCH",

      deleteBody: () => ({
        isActive: false,
      }),

      canCreate: (permissions) =>
        permissions.includes(
          "users.create",
        ),

      canUpdate: (permissions) =>
        permissions.includes(
          "users.update",
        ),

      canDelete: (permissions) =>
        permissions.includes(
          "users.delete",
        ),
    },

    departments: {
      ...R(
        "Departments",
        "Manage departments and their campus assignment.",
        "/departments?page=1&pageSize=200",
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
          "name",
          "code",
          "campus",
          "isActive",
        ],
      ),

      updateEndpoint: (
        id,
      ) =>
        `/departments/${id}`,

      deleteEndpoint: (
        row,
      ) =>
        `/departments/${row.id}`,

      canCreate: (permissions) =>
        permissions.includes(
          "departments.create",
        ),

      canUpdate: (permissions) =>
        permissions.includes(
          "departments.update",
        ),

      canDelete: (permissions) =>
        permissions.includes(
          "departments.delete",
        ),
    },

    programs: {
      ...R(
        "Programs",
        "Manage programs, levels, duration and department ownership.",
        "/programs?page=1&pageSize=200",
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
          "name",
          "code",
          "level",
          "department",
        ],
      ),

      updateEndpoint: (
        id,
      ) =>
        `/programs/${id}`,

      deleteEndpoint: (
        row,
      ) =>
        `/programs/${row.id}`,

      canCreate: (permissions) =>
        permissions.includes(
          "programs.create",
        ),

      canUpdate: (permissions) =>
        permissions.includes(
          "programs.update",
        ),

      canDelete: (permissions) =>
        permissions.includes(
          "programs.delete",
        ),
    },

    "academic-years": {
      ...R(
        "Academic years",
        "Manage academic-year boundaries and the current year.",
        "/academic-years?page=1&pageSize=200",
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
      ),

      updateEndpoint: (
        id,
      ) =>
        `/academic-years/${id}`,

      canCreate: (permissions) =>
        permissions.includes(
          "academic-years.create",
        ),

      canUpdate: (permissions) =>
        permissions.includes(
          "academic-years.update",
        ),
    },

    semesters: {
      ...R(
        "Semesters",
        "Manage semesters under programs and academic years.",
        "/semesters?page=1&pageSize=200",
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
          "name",
          "number",
          "program",
          "academicYear",
        ],
      ),

      updateEndpoint: (
        id,
      ) =>
        `/semesters/${id}`,

      deleteEndpoint: (
        row,
      ) =>
        `/semesters/${row.id}`,

      canCreate: (permissions) =>
        permissions.includes(
          "semesters.create",
        ),

      canUpdate: (permissions) =>
        permissions.includes(
          "semesters.update",
        ),

      canDelete: (permissions) =>
        permissions.includes(
          "semesters.delete",
        ),
    },

    sections: {
      ...R(
        "Sections",
        "Manage sections and capacity.",
        "/sections?page=1&pageSize=200",
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
          "name",
          "semester",
          "capacity",
          "isActive",
        ],
      ),

      updateEndpoint: (
        id,
      ) =>
        `/sections/${id}`,

      deleteEndpoint: (
        row,
      ) =>
        `/sections/${row.id}`,

      canCreate: (permissions) =>
        permissions.includes(
          "sections.create",
        ),

      canUpdate: (permissions) =>
        permissions.includes(
          "sections.update",
        ),

      canDelete: (permissions) =>
        permissions.includes(
          "sections.delete",
        ),
    },

    courses: {
      ...R(
        "Courses",
        "Manage the institutional course catalogue.",
        "/courses?page=1&pageSize=200",
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
          "code",
          "name",
          "credits",
          "department",
        ],
      ),

      updateEndpoint: (
        id,
      ) =>
        `/courses/${id}`,

      deleteEndpoint: (
        row,
      ) =>
        `/courses/${row.id}`,

      canCreate: (permissions) =>
        permissions.includes(
          "courses.create",
        ),

      canUpdate: (permissions) =>
        permissions.includes(
          "courses.update",
        ),

      canDelete: (permissions) =>
        permissions.includes(
          "courses.delete",
        ),
    },

    "course-offerings": {
      ...R(
        "Course offerings",
        "Assign courses to semesters, sections and faculty.",
        "/course-offerings?page=1&pageSize=200",
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
        ],
        [
          "course",
          "semester",
          "section",
          "faculty",
          "isActive",
        ],
      ),

      updateEndpoint: (
        id,
      ) =>
        `/course-offerings/${id}`,

      deleteEndpoint: (
        row,
      ) =>
        `/course-offerings/${row.id}`,

      canCreate: (permissions) =>
        permissions.includes(
          "course-offerings.create",
        ),

      canUpdate: (permissions) =>
        permissions.includes(
          "course-offerings.update",
        ),

      canDelete: (permissions) =>
        permissions.includes(
          "course-offerings.delete",
        ),
    },

    campuses: {
      ...R(
        "Campuses",
        "Manage campuses, codes and addresses.",
        "/campuses?page=1&pageSize=200",
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
          "name",
          "code",
          "address",
          "isActive",
        ],
      ),

      updateEndpoint: (
        id,
      ) =>
        `/campuses/${id}`,

      deleteEndpoint: (
        row,
      ) =>
        `/campuses/${row.id}`,

      canCreate: (permissions) =>
        permissions.includes(
          "campuses.create",
        ),

      canUpdate: (permissions) =>
        permissions.includes(
          "campuses.update",
        ),

      canDelete: (permissions) =>
        permissions.includes(
          "campuses.delete",
        ),
    },

    notices: {
      ...R(
        "Notices",
        "Publish, edit and remove institution notices.",
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
      ),

      updateEndpoint: (
        id,
      ) =>
        `/erp/notices/${id}`,

      deleteEndpoint: (
        row,
      ) =>
        `/erp/notices/${row.id}`,

      canCreate: (permissions) =>
        permissions.includes(
          "notices.manage",
        ),

      canUpdate: (permissions) =>
        permissions.includes(
          "notices.manage",
        ),

      canDelete: (permissions) =>
        permissions.includes(
          "notices.manage",
        ),
    },

    calendar: {
      ...R(
        "Calendar",
        "Create and maintain institutional calendar events.",
        "/calendar/events?page=1&pageSize=200",
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
        ],
        [
          "title",
          "eventType",
          "startDate",
          "endDate",
          "audience",
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

      canCreate: (permissions) =>
        permissions.includes(
          "calendar.manage",
        ),

      canUpdate: (permissions) =>
        permissions.includes(
          "calendar.manage",
        ),

      canDelete: (permissions) =>
        permissions.includes(
          "calendar.manage",
        ),
    },

    "parent-links": {
      ...R(
        "Parent links",
        "Connect parent accounts with student records.",
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

      canCreate: (permissions) =>
        permissions.includes(
          "parent-links.manage",
        ),

      canDelete: (permissions) =>
        permissions.includes(
          "parent-links.manage",
        ),
    },

    notifications: {
      ...R(
        "Notifications",
        "Send targeted portal notifications. The backend exposes creation, not arbitrary deletion.",
        "/portal/notifications?page=1&limit=100",
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
      ),

      createEndpoint:
        "/portal/notifications",

      canCreate: (permissions) =>
        permissions.includes(
          "notices.manage",
        ),
    },
  };

  return (
    map[module] ||
    null
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
                (field) =>
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
    const result =
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
        result,
      ),
    );
  }

  useEffect(() => {
    void Promise.all([
      load(),
      loadLookups(),
    ]);
  }, [def.endpoint]);

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
    const next = {
      ...row,
    };

    for (const field of def.fields) {
      if (
        (
          field.type ===
            "date" ||
          field.type ===
            "datetime-local"
        ) &&
        next[field.name]
      ) {
        const dateValue =
          new Date(
            next[field.name],
          );

        if (
          !Number.isNaN(
            dateValue.getTime(),
          )
        ) {
          next[field.name] =
            field.type ===
            "datetime-local"
              ? dateValue
                  .toISOString()
                  .slice(
                    0,
                    16,
                  )
              : dateValue
                  .toISOString()
                  .slice(
                    0,
                    10,
                  );
        }
      }
    }

    setEditing(
      row,
    );

    setForm(
      next,
    );

    setError("");
    setSuccess("");
    setOpen(true);
  }

  function payload() {
    const output: Row =
      {};

    for (const field of def.fields) {
      if (
        field.hiddenOnEdit &&
        editing
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
          "This module does not allow this operation.",
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
        `Remove ${show(
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
      <div className="flex flex-col gap-4 border-b border-slate-100 p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
            Data workspace
          </p>

          <h2 className="mt-1 text-xl font-black text-slate-950">
            {def.title}
          </h2>
        </div>

        {canCreate ? (
          <button
            type="button"
            onClick={openCreate}
            className={ACTION}
          >
            + Create
          </button>
        ) : null}
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
          {[1, 2, 3, 4, 5, 6].map(
            (item) => (
              <div
                key={item}
                className="h-24 rounded-2xl bg-slate-100 animate-pulse"
              />
            ),
          )}
        </div>
      ) : data.length ===
        0 ? (
        <div className="p-10 text-center text-sm text-slate-500">
          No records found.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[850px] text-left text-sm">
            <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
              <tr>
                {def.columns.map(
                  (column) => (
                    <th
                      key={column}
                      className="px-5 py-4"
                    >
                      {column.replace(
                        /([A-Z])/g,
                        " $1",
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
              {data.map(
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
                          className="px-5 py-4 font-medium text-slate-700"
                        >
                          {column
                            .toLowerCase()
                            .includes(
                              "date",
                            ) ||
                          column
                            .toLowerCase()
                            .includes(
                              "at",
                            )
                            ? formatDate(
                                row[
                                  column
                                ],
                              )
                            : show(
                                row[
                                  column
                                ],
                              )}
                        </td>
                      ),
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
                          className="mr-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-black"
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
                          className="rounded-xl border border-rose-200 px-3 py-2 text-xs font-black text-rose-600"
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
                type="button"
                onClick={() =>
                  setOpen(
                    false,
                  )
                }
                className="rounded-2xl border border-slate-200 px-3 py-2 text-sm font-black"
              >
                Close
              </button>
            </div>

            <form
              onSubmit={save}
              className="space-y-5 p-5 sm:p-6"
            >
              <div className="grid gap-4 md:grid-cols-2">
                {def.fields
                  .filter(
                    (field) =>
                      !(
                        editing &&
                        field.hiddenOnEdit
                      ),
                  )
                  .map(
                    (field) => (
                      <label
                        key={
                          field.name
                        }
                        className={
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

                        {control(
                          field,
                          form[
                            field.name
                          ],
                          (
                            value,
                          ) =>
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
                        )}
                      </label>
                    ),
                  )}
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
                <button
                  type="button"
                  onClick={() =>
                    setOpen(
                      false,
                    )
                  }
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className={ACTION}
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
  const [
    tab,
    setTab,
  ] =
    useState<
      "assets" | "facilities" | "maintenance"
    >("assets");

  const definitions: Record<
    string,
    Resource
  > = {
    assets: {
      title: "Assets",
      description:
        "Manage operational inventory.",
      endpoint:
        "/operations/assets?page=1&pageSize=100",
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
          name: "campusId",
          label: "Campus",
          type: "select",
          source: "campuses",
        },
        {
          name: "departmentId",
          label: "Department",
          type: "select",
          source: "departments",
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
      updateEndpoint: (
        id,
      ) =>
        `/operations/assets/${id}`,
      canCreate: (permissions) =>
        permissions.includes(
          "operations.manage",
        ),
      canUpdate: (permissions) =>
        permissions.includes(
          "operations.manage",
        ),
    },

    facilities: {
      title: "Facilities",
      description:
        "Manage institution facilities.",
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
          source: "campuses",
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
      updateEndpoint: (
        id,
      ) =>
        `/operations/facilities/${id}`,
      canCreate: (permissions) =>
        permissions.includes(
          "operations.manage",
        ),
      canUpdate: (permissions) =>
        permissions.includes(
          "operations.manage",
        ),
    },

    maintenance: {
      title: "Maintenance",
      description:
        "Manage maintenance requests and status.",
      endpoint:
        "/operations/maintenance?page=1&pageSize=100",
      fields: [
        {
          name: "facilityId",
          label: "Facility",
          type: "select",
          source: "facilities",
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
          label: "Resolution note",
          type: "textarea",
        },
      ],
      columns: [
        "title",
        "priority",
        "status",
        "createdAt",
      ],
      updateEndpoint: (
        id,
      ) =>
        `/operations/maintenance/${id}`,
      canCreate: (permissions) =>
        permissions.includes(
          "operations.manage",
        ) ||
        permissions.includes(
          "maintenance.raise",
        ),
      canUpdate: (permissions) =>
        permissions.includes(
          "operations.manage",
        ) ||
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

  const [form, setForm] =
    useState({
      title: "",
      type: "",
      url: "",
    });

  const canCreate =
    permissions.includes(
      "documents.manage",
    ) ||
    permissions.includes(
      "students.update",
    );

  useEffect(() => {
    void authedFetch<any>(
      "/students?page=1&pageSize=500",
    )
      .then((response) =>
        setStudents(
          rowsOf(
            response.data,
          ) as Lookup[],
        ),
      )
      .catch(() =>
        setStudents([]),
      );
  }, []);

  useEffect(() => {
    if (!student) {
      setDocuments([]);
      return;
    }

    setLoading(true);

    void authedFetch<any>(
      `/portal/documents/students/${student}`,
    )
      .then((response) =>
        setDocuments(
          rowsOf(
            response.data,
          ),
        ),
      )
      .catch(() =>
        setDocuments([]),
      )
      .finally(() =>
        setLoading(false),
      );
  }, [student]);

  async function create(
    event: FormEvent,
  ) {
    event.preventDefault();

    if (!student) return;

    await authedFetch(
      "/portal/documents",
      {
        method: "POST",
        body: JSON.stringify({
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

    const response =
      await authedFetch<any>(
        `/portal/documents/students/${student}`,
      );

    setDocuments(
      rowsOf(
        response.data,
      ),
    );
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

    await authedFetch(
      `/portal/documents/${id}`,
      {
        method: "DELETE",
      },
    );

    setDocuments(
      (current) =>
        current.filter(
          (document) =>
            document.id !==
            id,
        ),
    );
  }

  return (
    <div className="space-y-5">
      <section className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-sm">
        <label className="block">
          <span className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-slate-500">
            Student
          </span>

          <select
            value={student}
            onChange={(event) =>
              setStudent(
                event.target.value,
              )
            }
            className={INPUT}
          >
            <option value="">
              Select student
            </option>

            {students.map(
              (studentItem) => (
                <option
                  key={
                    studentItem.id
                  }
                  value={
                    studentItem.id
                  }
                >
                  {lookupLabel(
                    studentItem,
                  )}
                </option>
              ),
            )}
          </select>
        </label>
      </section>

      {student &&
      canCreate ? (
        <form
          onSubmit={create}
          className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-sm"
        >
          <div className="grid gap-4 md:grid-cols-3">
            <input
              required
              placeholder="Title"
              value={form.title}
              onChange={(event) =>
                setForm({
                  ...form,
                  title:
                    event.target
                      .value,
                })
              }
              className={INPUT}
            />

            <input
              required
              placeholder="Type"
              value={form.type}
              onChange={(event) =>
                setForm({
                  ...form,
                  type:
                    event.target
                      .value,
                })
              }
              className={INPUT}
            />

            <input
              required
              type="url"
              placeholder="Document URL"
              value={form.url}
              onChange={(event) =>
                setForm({
                  ...form,
                  url:
                    event.target
                      .value,
                })
              }
              className={INPUT}
            />
          </div>

          <div className="mt-4 flex justify-end">
            <button
              type="submit"
              className={ACTION}
            >
              Add document
            </button>
          </div>
        </form>
      ) : null}

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
                  (document) => (
                    <tr
                      key={
                        document.id
                      }
                    >
                      <td className="px-5 py-4 font-bold">
                        {
                          document.title
                        }
                      </td>

                      <td className="px-5 py-4">
                        {
                          document.type
                        }
                      </td>

                      <td className="px-5 py-4">
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
                          className="mr-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-black"
                        >
                          Open
                        </a>

                        {canCreate ? (
                          <button
                            type="button"
                          onClick={() => {
  if (!document.id) return;
  void remove(document.id);
}}
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
          <div className="p-10 text-center text-sm text-slate-500">
            Select a student to inspect documents.
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
  ] = useState<string[]>(
    [],
  );

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
          .then((currentUser) =>
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
        Unknown administration module.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-5">
        <Header item={item} />

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
        <Header item={item} />

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
        <Header item={item} />

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
        <Header item={item} />

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
        No UI adapter configured.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Header item={item} />

      <ResourceManager
        def={definition}
        permissions={
          permissions
        }
      />
    </div>
  );
}
