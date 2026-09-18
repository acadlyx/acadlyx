"use client";

import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import StudentManagement from "@/components/dashboard/StudentManagement";
import CourseOfferingRoster from "@/components/dashboard/CourseOfferingRoster";
import {
  AuthRequiredError,
  authedFetch,
  getCurrentUser,
  isAuthenticated,
  logout,
} from "@/lib/auth";

type User = {
  id: string;
  institutionId?: string | null;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  isActive: boolean;
  roles?: {
    id: string;
    name: string;
  }[];
};

type RecordItem = Record<string, unknown> & {
  id: string;
  name?: string;
  code?: string;
  title?: string;
  isActive?: boolean;
  isCurrent?: boolean;
};

type ListResponse<T> = {
  success?: boolean;
  data?: T[];
  meta?: {
    total?: number;
    page?: number;
    pageSize?: number;
    totalPages?: number;
  };
};

type UserListResponse = {
  success?: boolean;
  data?: {
    items: User[];
    total: number;
  };
};

type ModuleKey =
  | "overview"
  | "users"
  | "students"
  | "faculty"
  | "campuses"
  | "departments"
  | "programs"
  | "academic-years"
  | "semesters"
  | "sections"
  | "courses"
  | "course-offerings";

type ModuleDefinition = {
  key: ModuleKey;
  label: string;
  endpoint?: string;
  description: string;
  canCreate: boolean;
};

const modules: ModuleDefinition[] = [
  {
    key: "overview",
    label: "Overview",
    description:
      "Institution-wide administration and academic structure.",
    canCreate: false,
  },
  {
    key: "users",
    label: "Users",
    endpoint: "/users",
    description:
      "Create and manage institution users and roles.",
    canCreate: true,
  },
  {
    key: "students",
    label: "Students",
    endpoint:
      "/users?role=STUDENT&page=1&pageSize=100",
    description:
      "Student accounts and institutional identities.",
    canCreate: true,
  },
  {
    key: "faculty",
    label: "Faculty",
    endpoint:
      "/users?role=FACULTY&page=1&pageSize=100",
    description:
      "Faculty accounts and teaching staff.",
    canCreate: true,
  },
  {
    key: "campuses",
    label: "Campuses",
    endpoint: "/campuses",
    description:
      "Physical campuses and their academic locations.",
    canCreate: true,
  },
  {
    key: "departments",
    label: "Departments",
    endpoint: "/departments",
    description:
      "Academic departments and organizational units.",
    canCreate: true,
  },
  {
    key: "programs",
    label: "Programs",
    endpoint: "/programs",
    description:
      "Degree and academic programs.",
    canCreate: true,
  },
  {
    key: "academic-years",
    label: "Academic Years",
    endpoint: "/academic-years",
    description:
      "Academic years and the active academic cycle.",
    canCreate: true,
  },
  {
    key: "semesters",
    label: "Semesters",
    endpoint: "/semesters",
    description:
      "Program-specific semester structure.",
    canCreate: true,
  },
  {
    key: "sections",
    label: "Sections",
    endpoint: "/sections",
    description:
      "Student sections within academic semesters.",
    canCreate: true,
  },
  {
    key: "courses",
    label: "Courses",
    endpoint: "/courses",
    description:
      "Course catalog and department subjects.",
    canCreate: true,
  },
  {
    key: "course-offerings",
    label: "Course Offerings",
    endpoint: "/course-offerings",
    description:
      "Connect courses, semesters, sections and faculty.",
    canCreate: true,
  },
];

const roleOptions = [
  "INSTITUTION_ADMIN",
  "DIRECTOR",
  "MANAGEMENT",
  "HOD",
  "FACULTY",
  "STAFF",
  "STUDENT",
  "PARENT",
];

function inputClass() {
  return "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400";
}

function labelClass() {
  return "mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500";
}

function getRecordName(item: RecordItem) {
  return String(
    item.name ||
      item.title ||
      item.code ||
      item.id
  );
}

function normalizeList<T>(
  response: ListResponse<T>
): T[] {
  return Array.isArray(response.data)
    ? response.data
    : [];
}

function formatDateInput(value: unknown) {
  if (!value) {
    return "";
  }

  const date = new Date(
    String(value)
  );

  if (Number.isNaN(date.getTime())) {
    return String(value).slice(0, 10);
  }

  return date
    .toISOString()
    .slice(0, 10);
}

function optionLabel(item: RecordItem) {
  const name =
    item.name ||
    item.title ||
    "";

  const code =
    item.code ||
    "";

  if (code && name) {
    return `${code} — ${name}`;
  }

  return String(
    name ||
      code ||
      item.id
  );
}

export function AdminPortal() {
  const router = useRouter();

  const [
    activeModule,
    setActiveModule,
  ] =
    useState<ModuleKey>(
      "overview"
    );

  const [user, setUser] =
    useState<
      Awaited<
        ReturnType<
          typeof getCurrentUser
        >
      > | null
    >(null);

  const [
    records,
    setRecords,
  ] =
    useState<RecordItem[]>(
      []
    );

  const [
    users,
    setUsers,
  ] =
    useState<User[]>([]);

  const [loading, setLoading] =
    useState(false);

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState("");

  const [
    success,
    setSuccess,
  ] = useState("");

  const [search, setSearch] =
    useState("");

  const [
    editing,
    setEditing,
  ] =
    useState<RecordItem | null>(
      null
    );

  const [
    showCreate,
    setShowCreate,
  ] = useState(false);

  const [
    showUserCreate,
    setShowUserCreate,
  ] = useState(false);

  const [
    form,
    setForm,
  ] =
    useState<
      Record<string, string>
    >({});

  const [
    userForm,
    setUserForm,
  ] = useState({
    email: "",
    firstName: "",
    lastName: "",
    phone: "",
    password: "",
    role: "STUDENT",
  });

  const [selectedOffering, setSelectedOffering] = useState<RecordItem | null>(null);

  const [
    lookups,
    setLookups,
  ] = useState({
    campuses:
      [] as RecordItem[],
    departments:
      [] as RecordItem[],
    programs:
      [] as RecordItem[],
    academicYears:
      [] as RecordItem[],
    semesters:
      [] as RecordItem[],
    sections:
      [] as RecordItem[],
    courses:
      [] as RecordItem[],
    faculty:
      [] as User[],
  });

  const [
    stats,
    setStats,
  ] = useState({
    users: 0,
    students: 0,
    faculty: 0,
    campuses: 0,
    departments: 0,
    programs: 0,
    academicYears: 0,
    semesters: 0,
    courses: 0,
    sections: 0,
    offerings: 0,
  });

  const currentModule =
    useMemo(
      () =>
        modules.find(
          (module) =>
            module.key ===
            activeModule
        ) ||
        modules[0],
      [activeModule]
    );

  useEffect(() => {
    async function initialize() {
      try {
        if (
          !isAuthenticated()
        ) {
          router.replace(
            "/login"
          );
          return;
        }

        const currentUser =
          await getCurrentUser();

        if (
          !currentUser.roles.includes(
            "INSTITUTION_ADMIN"
          )
        ) {
          router.replace(
            "/login"
          );
          return;
        }

        setUser(currentUser);

        await Promise.all([
          loadOverview(),
          loadLookups(),
        ]);
      } catch (err) {
        handleError(err);
      }
    }

    void initialize();
  }, [router]);

  useEffect(() => {
    if (
      activeModule !==
        "overview" &&
      activeModule !== "students" &&
      currentModule.endpoint
    ) {
      void loadModule();
    }
  }, [
    activeModule,
  ]);

  async function loadOverview() {
    setLoading(true);
    setError("");

    try {
      const [
        userResponse,
        campusResponse,
        departmentResponse,
        programResponse,
        yearResponse,
        semesterResponse,
        courseResponse,
        sectionResponse,
        offeringResponse,
      ] = await Promise.all([
        authedFetch<UserListResponse>(
          "/users?page=1&pageSize=100"
        ),
        authedFetch<
          ListResponse<RecordItem>
        >(
          "/campuses?page=1&pageSize=100"
        ),
        authedFetch<
          ListResponse<RecordItem>
        >(
          "/departments?page=1&pageSize=100"
        ),
        authedFetch<
          ListResponse<RecordItem>
        >(
          "/programs?page=1&pageSize=100"
        ),
        authedFetch<
          ListResponse<RecordItem>
        >(
          "/academic-years?page=1&pageSize=100"
        ),
        authedFetch<
          ListResponse<RecordItem>
        >(
          "/semesters?page=1&pageSize=100"
        ),
        authedFetch<
          ListResponse<RecordItem>
        >(
          "/courses?page=1&pageSize=100"
        ),
        authedFetch<
          ListResponse<RecordItem>
        >(
          "/sections?page=1&pageSize=100"
        ),
        authedFetch<
          ListResponse<RecordItem>
        >(
          "/course-offerings?page=1&pageSize=100"
        ),
      ]);

      const loadedUsers =
        userResponse.data?.items ||
        [];

      const campuses =
        normalizeList(
          campusResponse
        );

      const departments =
        normalizeList(
          departmentResponse
        );

      const programs =
        normalizeList(
          programResponse
        );

      const academicYears =
        normalizeList(
          yearResponse
        );

      const semesters =
        normalizeList(
          semesterResponse
        );

      const courses =
        normalizeList(
          courseResponse
        );

      const sections =
        normalizeList(
          sectionResponse
        );

      const offerings =
        normalizeList(
          offeringResponse
        );

      setUsers(
        loadedUsers
      );

      setStats({
        users:
          userResponse.data
            ?.total ||
          loadedUsers.length,

        students:
          loadedUsers.filter(
            (item) =>
              item.roles?.some(
                (role) =>
                  role.name ===
                  "STUDENT"
              )
          ).length,

        faculty:
          loadedUsers.filter(
            (item) =>
              item.roles?.some(
                (role) =>
                  role.name ===
                  "FACULTY"
              )
          ).length,

        campuses:
          campuses.length,

        departments:
          departments.length,

        programs:
          programs.length,

        academicYears:
          academicYears.length,

        semesters:
          semesters.length,

        courses:
          courses.length,

        sections:
          sections.length,

        offerings:
          offerings.length,
      });
    } catch (err) {
      handleError(err);
    } finally {
      setLoading(false);
    }
  }

  async function loadLookups() {
    try {
      const [
        campusResponse,
        departmentResponse,
        programResponse,
        yearResponse,
        semesterResponse,
        sectionResponse,
        courseResponse,
        facultyResponse,
      ] = await Promise.all([
        authedFetch<
          ListResponse<RecordItem>
        >(
          "/campuses?page=1&pageSize=100"
        ),
        authedFetch<
          ListResponse<RecordItem>
        >(
          "/departments?page=1&pageSize=100"
        ),
        authedFetch<
          ListResponse<RecordItem>
        >(
          "/programs?page=1&pageSize=100"
        ),
        authedFetch<
          ListResponse<RecordItem>
        >(
          "/academic-years?page=1&pageSize=100"
        ),
        authedFetch<
          ListResponse<RecordItem>
        >(
          "/semesters?page=1&pageSize=100"
        ),
        authedFetch<
          ListResponse<RecordItem>
        >(
          "/sections?page=1&pageSize=100"
        ),
        authedFetch<
          ListResponse<RecordItem>
        >(
          "/courses?page=1&pageSize=100"
        ),
        authedFetch<UserListResponse>(
          "/users?role=FACULTY&page=1&pageSize=100"
        ),
      ]);

      setLookups({
        campuses:
          normalizeList(
            campusResponse
          ),

        departments:
          normalizeList(
            departmentResponse
          ),

        programs:
          normalizeList(
            programResponse
          ),

        academicYears:
          normalizeList(
            yearResponse
          ),

        semesters:
          normalizeList(
            semesterResponse
          ),

        sections:
          normalizeList(
            sectionResponse
          ),

        courses:
          normalizeList(
            courseResponse
          ),

        faculty:
          facultyResponse.data
            ?.items || [],
      });
    } catch (err) {
      handleError(err);
    }
  }

  async function loadModule() {
    if (
      !currentModule.endpoint ||
      activeModule ===
        "overview"
    ) {
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      if (
        activeModule ===
          "users" ||
        activeModule ===
          "students" ||
        activeModule ===
          "faculty"
      ) {
        const response =
          await authedFetch<UserListResponse>(
            currentModule.endpoint
          );

        setUsers(
          response.data?.items ||
            []
        );

        setRecords([]);
      } else {
        const separator =
          currentModule.endpoint.includes(
            "?"
          )
            ? "&"
            : "?";

        const response =
          await authedFetch<
            ListResponse<RecordItem>
          >(
            `${currentModule.endpoint}${separator}page=1&pageSize=100`
          );

        setRecords(
          normalizeList(
            response
          )
        );

        setUsers([]);
      }
    } catch (err) {
      handleError(err);
    } finally {
      setLoading(false);
    }
  }

  function handleError(
    err: unknown
  ) {
    if (
      err instanceof
      AuthRequiredError
    ) {
      router.replace(
        "/login"
      );
      return;
    }

    setError(
      err instanceof Error
        ? err.message
        : "Request failed."
    );
  }

  function clearMessages() {
    setError("");
    setSuccess("");
  }

  function openModule(
    key: ModuleKey
  ) {
    clearMessages();
    setEditing(null);
    setShowCreate(false);
    setShowUserCreate(false);
    setForm({});
    setSearch("");
    setActiveModule(key);
  }

  function startCreate() {
    clearMessages();
    setEditing(null);
    setForm(
      defaultFormForModule(
        activeModule
      )
    );
    setShowCreate(true);
  }

  function startEdit(
    item: RecordItem
  ) {
    clearMessages();
    setEditing(item);
    setShowCreate(true);

    const next: Record<
      string,
      string
    > = {};

    Object.entries(item).forEach(
      ([key, value]) => {
        if (
          [
            "id",
            "createdAt",
            "updatedAt",
            "institutionId",
          ].includes(key)
        ) {
          return;
        }

        if (
          value !== null &&
          value !== undefined &&
          typeof value !==
            "object"
        ) {
          next[key] =
            key.endsWith(
              "Date"
            )
              ? formatDateInput(
                  value
                )
              : String(value);
        }
      }
    );

    if (
      activeModule ===
        "departments" &&
      item.campusId
    ) {
      next.campusId =
        String(
          item.campusId
        );
    }

    if (
      activeModule ===
        "programs" &&
      item.departmentId
    ) {
      next.departmentId =
        String(
          item.departmentId
        );
    }

    if (
      activeModule ===
      "semesters"
    ) {
      if (
        item.programId
      ) {
        next.programId =
          String(
            item.programId
          );
      }

      if (
        item.academicYearId
      ) {
        next.academicYearId =
          String(
            item.academicYearId
          );
      }
    }

    if (
      activeModule ===
        "sections" &&
      item.semesterId
    ) {
      next.semesterId =
        String(
          item.semesterId
        );
    }

    if (
      activeModule ===
        "courses" &&
      item.departmentId
    ) {
      next.departmentId =
        String(
          item.departmentId
        );
    }

    if (
      activeModule ===
      "course-offerings"
    ) {
      if (
        item.courseId
      ) {
        next.courseId =
          String(
            item.courseId
          );
      }

      if (
        item.semesterId
      ) {
        next.semesterId =
          String(
            item.semesterId
          );
      }

      if (
        item.sectionId
      ) {
        next.sectionId =
          String(
            item.sectionId
          );
      }

      if (
        item.facultyId
      ) {
        next.facultyId =
          String(
            item.facultyId
          );
      }
    }

    setForm(next);
  }

  function setField(
    key: string,
    value: string
  ) {
    setForm(
      (previous) => ({
        ...previous,
        [key]: value,
      })
    );
  }

  function buildPayload() {
    const payload: Record<
      string,
      unknown
    > = {};

    Object.entries(form).forEach(
      ([key, value]) => {
        if (
          value === ""
        ) {
          return;
        }

        if (
          [
            "durationYears",
            "credits",
            "number",
            "capacity",
          ].includes(key)
        ) {
          const parsed =
            Number(value);

          if (
            Number.isFinite(
              parsed
            )
          ) {
            payload[key] =
              parsed;
          }

          return;
        }

        if (
          [
            "isCurrent",
            "isActive",
          ].includes(key)
        ) {
          payload[key] =
            value ===
            "true";

          return;
        }

        payload[key] =
          value;
      }
    );

    return payload;
  }

  async function saveRecord(
    event: FormEvent
  ) {
    event.preventDefault();

    if (
      !currentModule.endpoint
    ) {
      return;
    }

    setSaving(true);
    clearMessages();

    try {
      const endpoint =
        editing
          ? `${currentModule.endpoint}/${editing.id}`
          : currentModule.endpoint;

      await authedFetch(
        endpoint,
        {
          method:
            editing
              ? "PATCH"
              : "POST",
          body:
            JSON.stringify(
              buildPayload()
            ),
        }
      );

      setSuccess(
        editing
          ? `${singularLabel(
              currentModule.label
            )} updated successfully.`
          : `${singularLabel(
              currentModule.label
            )} created successfully.`
      );

      setEditing(null);
      setShowCreate(false);
      setForm({});

      await Promise.all([
        loadModule(),
        loadOverview(),
        loadLookups(),
      ]);
    } catch (err) {
      handleError(err);
    } finally {
      setSaving(false);
    }
  }

  async function deactivate(
    item: RecordItem
  ) {
    if (
      !currentModule.endpoint
    ) {
      return;
    }

    if (
      !window.confirm(
        `Deactivate "${getRecordName(
          item
        )}"?`
      )
    ) {
      return;
    }

    setSaving(true);
    clearMessages();

    try {
      await authedFetch(
        `${currentModule.endpoint}/${item.id}`,
        {
          method: "DELETE",
        }
      );

      setSuccess(
        "Record deactivated successfully."
      );

      await Promise.all([
        loadModule(),
        loadOverview(),
        loadLookups(),
      ]);
    } catch (err) {
      handleError(err);
    } finally {
      setSaving(false);
    }
  }

  async function createUser(
    event: FormEvent
  ) {
    event.preventDefault();

    setSaving(true);
    clearMessages();

    try {
      await authedFetch(
        "/users",
        {
          method: "POST",
          body:
            JSON.stringify({
              email:
                userForm.email.trim(),
              firstName:
                userForm.firstName.trim(),
              lastName:
                userForm.lastName.trim(),
              phone:
                userForm.phone.trim(),
              password:
                userForm.password,
              role:
                userForm.role,
            }),
        }
      );

      setSuccess(
        `${userForm.role.replace(
          /_/g,
          " "
        )} account created successfully.`
      );

      setUserForm({
        email: "",
        firstName: "",
        lastName: "",
        phone: "",
        password: "",
        role: "STUDENT",
      });

      setShowUserCreate(
        false
      );

      await Promise.all([
        loadModule(),
        loadOverview(),
        loadLookups(),
      ]);
    } catch (err) {
      handleError(err);
    } finally {
      setSaving(false);
    }
  }

  async function toggleUser(
    item: User
  ) {
    setSaving(true);
    clearMessages();

    try {
      await authedFetch(
        `/users/${item.id}/status`,
        {
          method: "PATCH",
          body:
            JSON.stringify({
              isActive:
                !item.isActive,
            }),
        }
      );

      setSuccess(
        item.isActive
          ? "User deactivated."
          : "User activated."
      );

      await Promise.all([
        loadModule(),
        loadOverview(),
        loadLookups(),
      ]);
    } catch (err) {
      handleError(err);
    } finally {
      setSaving(false);
    }
  }

  const filteredRecords =
    records.filter(
      (item) => {
        if (
          !search.trim()
        ) {
          return true;
        }

        const text =
          `${item.name || ""} ${
            item.code || ""
          } ${
            item.title || ""
          } ${item.id}`.toLowerCase();

        return text.includes(
          search.toLowerCase()
        );
      }
    );

  const filteredUsers =
    users.filter(
      (item) => {
        if (
          !search.trim()
        ) {
          return true;
        }

        const text =
          `${item.firstName} ${
            item.lastName
          } ${
            item.email
          } ${
            item.roles
              ?.map(
                (role) =>
                  role.name
              )
              .join(" ") ||
            ""
          }`.toLowerCase();

        return text.includes(
          search.toLowerCase()
        );
      }
    );

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between px-5 py-4">
          <div>
            <p className="text-[11px] font-bold tracking-[0.2em] text-slate-400">
              ACADLYX ERP
            </p>

            <h1 className="mt-1 text-xl font-bold text-slate-950">
              Institution Administration
            </h1>

            {user && (
              <p className="mt-0.5 text-xs text-slate-500">
                {
                  user.firstName
                }{" "}
                {
                  user.lastName
                }{" "}
                · Institution
                Admin
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() =>
                void Promise.all(
                  [
                    loadOverview(),
                    loadLookups(),
                    activeModule !== "overview" &&
                    activeModule !== "students"
                      ? loadModule()
                      : Promise.resolve(),
                  ]
                )
              }
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Refresh
            </button>

            <button
              onClick={() =>
                void logout().then(
                  () =>
                    router.push(
                      "/login"
                    )
                )
              }
              className="rounded-xl bg-slate-950 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1500px] gap-5 p-5 lg:grid-cols-[250px_1fr]">
        <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-2 lg:sticky lg:top-[90px]">
          <div className="px-3 py-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
              Workspace
            </p>
          </div>

          <nav className="space-y-1">
            {modules.map(
              (module) => (
                <button
                  key={
                    module.key
                  }
                  onClick={() =>
                    openModule(
                      module.key
                    )
                  }
                  className={`w-full rounded-xl px-3 py-2.5 text-left text-sm font-medium transition ${
                    activeModule ===
                    module.key
                      ? "bg-slate-950 text-white"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"
                  }`}
                >
                  {
                    module.label
                  }
                </button>
              )
            )}
          </nav>

          <div className="mt-4 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-500">
            Academic relationships
            use live institutional
            selectors. Database
            IDs do not need to be
            entered manually.
          </div>
        </aside>

        <section className="min-w-0">
          {error && (
            <Alert
              tone="error"
              text={error}
              onClose={() =>
                setError("")
              }
            />
          )}

          {success && (
            <Alert
              tone="success"
              text={success}
              onClose={() =>
                setSuccess("")
              }
            />
          )}

          {activeModule ===
          "overview" ? (
            <Overview
              stats={stats}
              loading={loading}
              onOpen={openModule}
            />
          ) : (
            <div>
              <div className="mb-5 flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Administration
                  </p>

                  <h2 className="mt-1 text-2xl font-bold text-slate-950">
                    {
                      currentModule.label
                    }
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    {
                      currentModule.description
                    }
                  </p>
                </div>

                <div className="flex gap-2">
                  {currentModule.canCreate &&
                    ![
                      "users",
                      "students",
                      "faculty",
                    ].includes(
                      activeModule
                    ) && (
                      <button
                        onClick={
                          startCreate
                        }
                        className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
                      >
                        + Add{" "}
                        {singularLabel(
                          currentModule.label
                        )}
                      </button>
                    )}

                  {["users", "faculty"].includes(activeModule) && (
                    <button
                      onClick={() => {
                        clearMessages();
                        setShowUserCreate(
                          true
                        );
                      }}
                      className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
                    >
                      + Create User
                    </button>
                  )}
                </div>
              </div>

              {activeModule === "students" ? (
                <StudentManagement
                  onChanged={async () => {
                    await Promise.all([
                      loadOverview(),
                      loadLookups(),
                    ]);
                  }}
                />
              ) : ["users", "faculty"].includes(activeModule) ? (
                <UserTable
                  users={filteredUsers}
                  search={search}
                  setSearch={setSearch}
                  loading={loading}
                  onToggle={toggleUser}
                />
              ) : (
                <RecordTable
                  records={filteredRecords}
                  search={search}
                  setSearch={setSearch}
                  loading={loading}
                  onEdit={startEdit}
                  onDeactivate={deactivate}
                  allowDeactivate={activeModule !== "academic-years"}
                  showRoster={activeModule === "course-offerings"}
                  onRoster={setSelectedOffering}
                />
              )}
            </div>
          )}

          {selectedOffering && activeModule === "course-offerings" && (
            <CourseOfferingRoster
              offering={selectedOffering}
              onClose={() => setSelectedOffering(null)}
            />
          )}

          {showUserCreate && (
            <Modal
              title="Create User"
              onClose={() =>
                setShowUserCreate(
                  false
                )
              }
            >
              <form
                onSubmit={
                  createUser
                }
                className="space-y-5"
              >
                <div className="grid gap-4 md:grid-cols-2">
                  <Field
                    label="First name"
                    required
                  >
                    <input
                      required
                      value={
                        userForm.firstName
                      }
                      onChange={(
                        event
                      ) =>
                        setUserForm(
                          (
                            previous
                          ) => ({
                            ...previous,
                            firstName:
                              event
                                .target
                                .value,
                          })
                        )
                      }
                      className={
                        inputClass()
                      }
                    />
                  </Field>

                  <Field
                    label="Last name"
                    required
                  >
                    <input
                      required
                      value={
                        userForm.lastName
                      }
                      onChange={(
                        event
                      ) =>
                        setUserForm(
                          (
                            previous
                          ) => ({
                            ...previous,
                            lastName:
                              event
                                .target
                                .value,
                          })
                        )
                      }
                      className={
                        inputClass()
                      }
                    />
                  </Field>

                  <Field
                    label="Email"
                    required
                  >
                    <input
                      required
                      type="email"
                      value={
                        userForm.email
                      }
                      onChange={(
                        event
                      ) =>
                        setUserForm(
                          (
                            previous
                          ) => ({
                            ...previous,
                            email:
                              event
                                .target
                                .value,
                          })
                        )
                      }
                      className={
                        inputClass()
                      }
                    />
                  </Field>

                  <Field label="Phone">
                    <input
                      value={
                        userForm.phone
                      }
                      onChange={(
                        event
                      ) =>
                        setUserForm(
                          (
                            previous
                          ) => ({
                            ...previous,
                            phone:
                              event
                                .target
                                .value,
                          })
                        )
                      }
                      className={
                        inputClass()
                      }
                    />
                  </Field>

                  <Field
                    label="Password"
                    required
                  >
                    <input
                      required
                      minLength={8}
                      type="password"
                      value={
                        userForm.password
                      }
                      onChange={(
                        event
                      ) =>
                        setUserForm(
                          (
                            previous
                          ) => ({
                            ...previous,
                            password:
                              event
                                .target
                                .value,
                          })
                        )
                      }
                      className={
                        inputClass()
                      }
                    />
                  </Field>

                  <Field
                    label="Role"
                    required
                  >
                    <select
                      value={
                        userForm.role
                      }
                      onChange={(
                        event
                      ) =>
                        setUserForm(
                          (
                            previous
                          ) => ({
                            ...previous,
                            role:
                              event
                                .target
                                .value,
                          })
                        )
                      }
                      className={
                        inputClass()
                      }
                    >
                      {roleOptions.map(
                        (role) => (
                          <option
                            key={
                              role
                            }
                            value={
                              role
                            }
                          >
                            {role.replace(
                              /_/g,
                              " "
                            )}
                          </option>
                        )
                      )}
                    </select>
                  </Field>
                </div>

                <div className="rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-800">
                  User creation
                  establishes the
                  institutional
                  account. Student
                  academic enrollment
                  will be handled by
                  the dedicated
                  Student module.
                </div>

                <ModalActions
                  onCancel={() =>
                    setShowUserCreate(
                      false
                    )
                  }
                  saving={saving}
                  submitLabel="Create User"
                />
              </form>
            </Modal>
          )}

          {showCreate &&
            currentModule.endpoint &&
            ![
              "users",
              "students",
              "faculty",
            ].includes(
              activeModule
            ) && (
              <Modal
                title={`${editing ? "Edit" : "Add"} ${singularLabel(
                  currentModule.label
                )}`}
                onClose={() => {
                  setShowCreate(
                    false
                  );
                  setEditing(
                    null
                  );
                }}
              >
                <RecordForm
                  module={
                    currentModule.key
                  }
                  form={form}
                  setField={
                    setField
                  }
                  onSubmit={
                    saveRecord
                  }
                  onCancel={() => {
                    setShowCreate(
                      false
                    );
                    setEditing(
                      null
                    );
                  }}
                  saving={saving}
                  editing={Boolean(
                    editing
                  )}
                  lookups={
                    lookups
                  }
                />
              </Modal>
            )}
        </section>
      </div>
    </main>
  );
}

function singularLabel(
  label: string
) {
  const map: Record<
    string,
    string
  > = {
    Campuses: "Campus",
    Departments:
      "Department",
    Programs: "Program",
    "Academic Years":
      "Academic Year",
    Semesters: "Semester",
    Sections: "Section",
    Courses: "Course",
    "Course Offerings":
      "Course Offering",
  };

  return (
    map[label] ||
    label.replace(
      /s$/,
      ""
    )
  );
}

function defaultFormForModule(
  module: ModuleKey
): Record<string, string> {
  switch (module) {
    case "campuses":
      return {};

    case "departments":
      return {};

    case "programs":
      return {};

    case "academic-years":
      return {
        isCurrent:
          "false",
      };

    case "semesters":
      return {};

    case "sections":
      return {};

    case "courses":
      return {};

    case "course-offerings":
      return {};

    default:
      return {};
  }
}

function Overview({
  stats,
  loading,
  onOpen,
}: {
  stats: {
    users: number;
    students: number;
    faculty: number;
    campuses: number;
    departments: number;
    programs: number;
    academicYears: number;
    semesters: number;
    courses: number;
    sections: number;
    offerings: number;
  };

  loading: boolean;

  onOpen: (
    module: ModuleKey
  ) => void;
}) {
  const cards: {
    label: string;
    value: number;
    module: ModuleKey;
  }[] = [
    {
      label: "Total Users",
      value: stats.users,
      module: "users",
    },
    {
      label: "Students",
      value: stats.students,
      module: "students",
    },
    {
      label: "Faculty",
      value: stats.faculty,
      module: "faculty",
    },
    {
      label: "Campuses",
      value: stats.campuses,
      module: "campuses",
    },
    {
      label: "Departments",
      value: stats.departments,
      module: "departments",
    },
    {
      label: "Programs",
      value: stats.programs,
      module: "programs",
    },
    {
      label: "Academic Years",
      value: stats.academicYears,
      module:
        "academic-years",
    },
    {
      label: "Semesters",
      value: stats.semesters,
      module:
        "semesters",
    },
    {
      label: "Courses",
      value: stats.courses,
      module: "courses",
    },
    {
      label: "Sections",
      value: stats.sections,
      module: "sections",
    },
    {
      label:
        "Course Offerings",
      value: stats.offerings,
      module:
        "course-offerings",
    },
  ];

  return (
    <div>
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Institution overview
        </p>

        <h2 className="mt-1 text-2xl font-bold text-slate-950">
          Administration
          Dashboard
        </h2>

        <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
          Configure the institution
          from its physical
          campuses through
          departments, programs,
          academic years,
          semesters, sections,
          courses and teaching
          assignments.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(
          (card) => (
            <button
              key={
                card.label
              }
              onClick={() =>
                onOpen(
                  card.module
                )
              }
              className="rounded-2xl border border-slate-200 bg-white p-5 text-left transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-sm"
            >
              <p className="text-sm font-medium text-slate-500">
                {
                  card.label
                }
              </p>

              <p className="mt-3 text-3xl font-bold text-slate-950">
                {loading
                  ? "—"
                  : card.value}
              </p>

              <p className="mt-3 text-xs font-medium text-slate-400">
                Open module →
              </p>
            </button>
          )
        )}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <QuickCard
          title="Physical structure"
          description="Create campuses and attach departments to the correct campus."
          button="Manage Campuses"
          onClick={() =>
            onOpen(
              "campuses"
            )
          }
        />

        <QuickCard
          title="Academic structure"
          description="Build departments, programs, academic years, semesters, sections and courses using relationship-aware forms."
          button="Manage Departments"
          onClick={() =>
            onOpen(
              "departments"
            )
          }
        />

        <QuickCard
          title="Teaching setup"
          description="Assign courses to sections and faculty without entering database IDs manually."
          button="Manage Offerings"
          onClick={() =>
            onOpen(
              "course-offerings"
            )
          }
        />
      </div>
    </div>
  );
}

function QuickCard({
  title,
  description,
  button,
  onClick,
}: {
  title: string;
  description: string;
  button: string;
  onClick: () => void;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <h3 className="font-semibold text-slate-950">
        {title}
      </h3>

      <p className="mt-2 text-sm leading-6 text-slate-500">
        {description}
      </p>

      <button
        onClick={onClick}
        className="mt-4 text-sm font-semibold text-slate-900 underline underline-offset-4"
      >
        {button}
      </button>
    </div>
  );
}

function UserTable({
  users,
  search,
  setSearch,
  loading,
  onToggle,
}: {
  users: User[];
  search: string;
  setSearch: (
    value: string
  ) => void;
  loading: boolean;
  onToggle: (
    user: User
  ) => void;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="border-b border-slate-100 p-4">
        <input
          value={search}
          onChange={(event) =>
            setSearch(
              event.target
                .value
            )
          }
          placeholder="Search name, email or role…"
          className={
            inputClass()
          }
        />
      </div>

      {loading ? (
        <Loading />
      ) : users.length ===
        0 ? (
        <EmptyState text="No users found." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-4 py-3">
                  User
                </th>

                <th className="px-4 py-3">
                  Role
                </th>

                <th className="px-4 py-3">
                  Phone
                </th>

                <th className="px-4 py-3">
                  Status
                </th>

                <th className="px-4 py-3 text-right">
                  Action
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {users.map(
                (item) => (
                  <tr
                    key={
                      item.id
                    }
                    className="hover:bg-slate-50"
                  >
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-900">
                        {
                          item.firstName
                        }{" "}
                        {
                          item.lastName
                        }
                      </p>

                      <p className="text-xs text-slate-400">
                        {
                          item.email
                        }
                      </p>
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {item.roles?.map(
                          (
                            role
                          ) => (
                            <span
                              key={
                                role.id
                              }
                              className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600"
                            >
                              {role.name.replace(
                                /_/g,
                                " "
                              )}
                            </span>
                          )
                        )}
                      </div>
                    </td>

                    <td className="px-4 py-3 text-slate-500">
                      {
                        item.phone ||
                        "—"
                      }
                    </td>

                    <td className="px-4 py-3">
                      <StatusBadge
                        active={
                          item.isActive
                        }
                      />
                    </td>

                    <td className="px-4 py-3 text-right">
                      <button
                        disabled={
                          loading
                        }
                        onClick={() =>
                          onToggle(
                            item
                          )
                        }
                        className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-white disabled:opacity-50"
                      >
                        {item.isActive
                          ? "Deactivate"
                          : "Activate"}
                      </button>
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function RecordTable({
  records,
  search,
  setSearch,
  loading,
  onEdit,
  onDeactivate,
  allowDeactivate,
  showRoster,
  onRoster,
}: {
  records: RecordItem[];
  search: string;
  setSearch: (
    value: string
  ) => void;
  loading: boolean;
  onEdit: (
    item: RecordItem
  ) => void;
  onDeactivate: (
    item: RecordItem
  ) => void;
  allowDeactivate: boolean;
  showRoster?: boolean;
  onRoster?: (item: RecordItem) => void;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="border-b border-slate-100 p-4">
        <input
          value={search}
          onChange={(event) =>
            setSearch(
              event.target
                .value
            )
          }
          placeholder="Search records…"
          className={
            inputClass()
          }
        />
      </div>

      {loading ? (
        <Loading />
      ) : records.length ===
        0 ? (
        <EmptyState text="No records found. Create the first record for this module." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-4 py-3">
                  Record
                </th>

                <th className="px-4 py-3">
                  Details
                </th>

                <th className="px-4 py-3">
                  Status
                </th>

                <th className="px-4 py-3 text-right">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {records.map(
                (item) => (
                  <tr
                    key={
                      item.id
                    }
                    className="hover:bg-slate-50"
                  >
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-900">
                        {getRecordName(
                          item
                        )}
                      </p>

                      {item.code && (
                        <p className="text-xs text-slate-400">
                          {
                            String(
                              item.code
                            )
                          }
                        </p>
                      )}
                    </td>

                    <td className="max-w-[520px] px-4 py-3 text-xs leading-5 text-slate-500">
                      <RecordDetails
                        item={
                          item
                        }
                      />
                    </td>

                    <td className="px-4 py-3">
                      {typeof item.isCurrent ===
                      "boolean" ? (
                        <span
                          className={`rounded-full px-2 py-1 text-xs font-semibold ${
                            item.isCurrent
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {item.isCurrent
                            ? "Current"
                            : "Not current"}
                        </span>
                      ) : (
                        <StatusBadge
                          active={
                            item.isActive !==
                            false
                          }
                        />
                      )}
                    </td>

                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        {showRoster && onRoster && (
                          <button
                            onClick={() => onRoster(item)}
                            className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            Roster
                          </button>
                        )}

                        <button
                          onClick={() =>
                            onEdit(
                              item
                            )
                          }
                          className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-white"
                        >
                          Edit
                        </button>

                        {allowDeactivate &&
                          item.isActive !==
                            false && (
                            <button
                              onClick={() =>
                                onDeactivate(
                                  item
                                )
                              }
                              className="rounded-lg border border-red-100 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50"
                            >
                              Deactivate
                            </button>
                          )}
                      </div>
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function RecordDetails({
  item,
}: {
  item: RecordItem;
}) {
  const details: string[] =
    [];

  const department =
    item.department as
      | RecordItem
      | undefined;

  const campus =
    item.campus as
      | RecordItem
      | undefined;

  const program =
    item.program as
      | RecordItem
      | undefined;

  const academicYear =
    item.academicYear as
      | RecordItem
      | undefined;

  const course =
    item.course as
      | RecordItem
      | undefined;

  const section =
    item.section as
      | RecordItem
      | undefined;

  const faculty =
    item.faculty as
      | User
      | undefined;

  if (campus?.name) {
    details.push(
      `Campus: ${String(
        campus.name
      )}`
    );
  }

  if (department?.name) {
    details.push(
      `Department: ${String(
        department.name
      )}`
    );
  }

  if (program?.name) {
    details.push(
      `Program: ${String(
        program.name
      )}`
    );
  }

  if (academicYear?.name) {
    details.push(
      `Academic year: ${String(
        academicYear.name
      )}`
    );
  }

  if (course?.name) {
    details.push(
      `Course: ${String(
        course.name
      )}`
    );
  }

  if (section?.name) {
    details.push(
      `Section: ${String(
        section.name
      )}`
    );
  }

  if (faculty?.firstName) {
    details.push(
      `Faculty: ${faculty.firstName} ${faculty.lastName}`
    );
  }

  if (item.level) {
    details.push(
      `Level: ${String(
        item.level
      )}`
    );
  }

  if (item.durationYears) {
    details.push(
      `Duration: ${String(
        item.durationYears
      )} years`
    );
  }

  if (item.number) {
    details.push(
      `Semester: ${String(
        item.number
      )}`
    );
  }

  if (item.credits) {
    details.push(
      `Credits: ${String(
        item.credits
      )}`
    );
  }

  if (item.capacity) {
    details.push(
      `Capacity: ${String(
        item.capacity
      )}`
    );
  }

  if (item.address) {
    details.push(
      String(
        item.address
      )
    );
  }

  return (
    <span>
      {details.length
        ? details.join(
            " · "
          )
        : "No additional details"}
    </span>
  );
}

type Lookups = {
  campuses: RecordItem[];
  departments: RecordItem[];
  programs: RecordItem[];
  academicYears: RecordItem[];
  semesters: RecordItem[];
  sections: RecordItem[];
  courses: RecordItem[];
  faculty: User[];
};

function RecordForm({
  module,
  form,
  setField,
  onSubmit,
  onCancel,
  saving,
  editing,
  lookups,
}: {
  module: ModuleKey;
  form: Record<
    string,
    string
  >;
  setField: (
    key: string,
    value: string
  ) => void;
  onSubmit: (
    event: FormEvent
  ) => void;
  onCancel: () => void;
  saving: boolean;
  editing: boolean;
  lookups: Lookups;
}) {
  const semesterOptions =
    lookups.semesters.filter(
      (item) => {
        const programId =
          form.programId;

        const academicYearId =
          form.academicYearId;

        return (
          (!programId ||
            String(
              item.programId
            ) ===
              programId) &&
          (!academicYearId ||
            String(
              item.academicYearId
            ) ===
              academicYearId)
        );
      }
    );

  const sectionOptions =
    lookups.sections.filter(
      (item) =>
        !form.semesterId ||
        String(
          item.semesterId
        ) ===
          form.semesterId
    );

  const programOptions =
    lookups.programs.filter(
      (item) =>
        !form.departmentId ||
        String(
          item.departmentId
        ) ===
          form.departmentId
    );

  const courseOptions =
    lookups.courses.filter(
      (item) =>
        !form.departmentId ||
        String(
          item.departmentId
        ) ===
          form.departmentId
    );

  const facultyOptions: RecordItem[] =
    lookups.faculty.map(
      (item) => ({
        id: item.id,
        name: `${item.firstName} ${item.lastName}`,
        code: item.email,
      })
    );

  const fields =
    getFieldsForModule(
      module
    );

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-5"
    >
      <div className="grid gap-4 md:grid-cols-2">
        {fields.map(
          (field) => {
            const options =
              field.optionSource ===
              "campuses"
                ? lookups.campuses
                : field.optionSource ===
                  "departments"
                ? lookups.departments
                : field.optionSource ===
                  "programs"
                ? programOptions
                : field.optionSource ===
                  "academicYears"
                ? lookups.academicYears
                : field.optionSource ===
                  "semesters"
                ? semesterOptions
                : field.optionSource ===
                  "sections"
                ? sectionOptions
                : field.optionSource ===
                  "courses"
                ? courseOptions
                : field.optionSource ===
                  "faculty"
                ? facultyOptions
                : undefined;

            return (
              <Field
                key={
                  field.key
                }
                label={
                  field.label
                }
                required={
                  field.required
                }
                help={
                  field.help
                }
              >
                {field.type ===
                "select" ? (
                  <select
                    required={
                      field.required
                    }
                    value={
                      form[
                        field.key
                      ] ||
                      ""
                    }
                    onChange={(
                      event
                    ) =>
                      setField(
                        field.key,
                        event
                          .target
                          .value
                      )
                    }
                    className={
                      inputClass()
                    }
                    disabled={
                      field.disabled
                    }
                  >
                    {field.placeholderOption && (
                      <option value="">
                        {
                          field.placeholderOption
                        }
                      </option>
                    )}

                    {options?.map(
                      (
                        option
                      ) => (
                        <option
                          key={
                            option.id
                          }
                          value={
                            option.id
                          }
                        >
                          {optionLabel(
                            option
                          )}
                        </option>
                      )
                    )}

                    {field.staticOptions?.map(
                      (
                        option
                      ) => (
                        <option
                          key={
                            option.value
                          }
                          value={
                            option.value
                          }
                        >
                          {
                            option.label
                          }
                        </option>
                      )
                    )}
                  </select>
                ) : (
                  <input
                    required={
                      field.required
                    }
                    type={
                      field.type ||
                      "text"
                    }
                    min={
                      field.min !==
                      undefined
                        ? String(
                            field.min
                          )
                        : undefined
                    }
                    value={
                      form[
                        field.key
                      ] ||
                      ""
                    }
                    onChange={(
                      event
                    ) =>
                      setField(
                        field.key,
                        event
                          .target
                          .value
                      )
                    }
                    placeholder={
                      field.placeholder
                    }
                    className={
                      inputClass()
                    }
                  />
                )}
              </Field>
            );
          }
        )}
      </div>

      <div className="rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-500">
        {editing
          ? "Changes are validated by the backend and remain inside your institution."
          : "Relationships are selected from live institutional records. The backend enforces tenant boundaries again before saving."}
      </div>

      <ModalActions
        onCancel={onCancel}
        saving={saving}
        submitLabel={
          editing
            ? "Save Changes"
            : "Create"
        }
      />
    </form>
  );
}

type FormField = {
  key: string;
  label: string;
  required?: boolean;
  type?: string;
  placeholder?: string;
  min?: number;
  optionSource?: keyof Lookups;
  placeholderOption?: string;
  disabled?: boolean;
  help?: string;
  staticOptions?: {
    value: string;
    label: string;
  }[];
};

function getFieldsForModule(
  module: ModuleKey
): FormField[] {
  switch (module) {
    case "campuses":
      return [
        {
          key: "name",
          label: "Campus name",
          required: true,
          placeholder:
            "Main Campus",
        },
        {
          key: "code",
          label: "Campus code",
          required: true,
          placeholder:
            "MAIN",
        },
        {
          key: "address",
          label: "Address",
          placeholder:
            "Campus address",
        },
        {
          key: "isActive",
          label: "Status",
          type: "select",
          staticOptions: [
            {
              value:
                "true",
              label:
                "Active",
            },
            {
              value:
                "false",
              label:
                "Inactive",
            },
          ],
        },
      ];

    case "departments":
      return [
        {
          key: "name",
          label:
            "Department name",
          required: true,
          placeholder:
            "Computer Science & Engineering",
        },
        {
          key: "code",
          label:
            "Department code",
          required: true,
          placeholder:
            "CSE",
        },
        {
          key: "campusId",
          label: "Campus",
          optionSource:
            "campuses",
          type: "select",
          placeholderOption:
            "Select campus (optional)",
        },
      ];

    case "programs":
      return [
        {
          key:
            "departmentId",
          label:
            "Department",
          required: true,
          optionSource:
            "departments",
          type: "select",
          placeholderOption:
            "Select department",
        },
        {
          key: "name",
          label:
            "Program name",
          required: true,
          placeholder:
            "B.Tech Computer Science & Engineering",
        },
        {
          key: "code",
          label:
            "Program code",
          required: true,
          placeholder:
            "BTECH-CSE",
        },
        {
          key: "level",
          label: "Level",
          required: true,
          type: "select",
          staticOptions: [
            {
              value:
                "UG",
              label:
                "Undergraduate (UG)",
            },
            {
              value:
                "PG",
              label:
                "Postgraduate (PG)",
            },
            {
              value:
                "DIPLOMA",
              label:
                "Diploma",
            },
            {
              value:
                "CERTIFICATE",
              label:
                "Certificate",
            },
          ],
        },
        {
          key:
            "durationYears",
          label:
            "Duration in years",
          required: true,
          type: "number",
          min: 1,
        },
      ];

    case "academic-years":
      return [
        {
          key: "name",
          label:
            "Academic year",
          required: true,
          placeholder:
            "2026-27",
        },
        {
          key:
            "startDate",
          label:
            "Start date",
          required: true,
          type: "date",
        },
        {
          key:
            "endDate",
          label:
            "End date",
          required: true,
          type: "date",
        },
        {
          key:
            "isCurrent",
          label:
            "Current academic year",
          type: "select",
          staticOptions: [
            {
              value:
                "true",
              label: "Yes",
            },
            {
              value:
                "false",
              label: "No",
            },
          ],
        },
      ];

    case "semesters":
      return [
        {
          key:
            "programId",
          label: "Program",
          required: true,
          optionSource:
            "programs",
          type: "select",
          placeholderOption:
            "Select program",
        },
        {
          key:
            "academicYearId",
          label:
            "Academic year",
          required: true,
          optionSource:
            "academicYears",
          type: "select",
          placeholderOption:
            "Select academic year",
        },
        {
          key: "number",
          label:
            "Semester number",
          required: true,
          type: "number",
          min: 1,
        },
        {
          key: "name",
          label:
            "Semester name",
          required: true,
          placeholder:
            "Semester 1",
        },
        {
          key:
            "startDate",
          label:
            "Start date",
          type: "date",
        },
        {
          key:
            "endDate",
          label:
            "End date",
          type: "date",
        },
      ];

    case "sections":
      return [
        {
          key:
            "semesterId",
          label:
            "Semester",
          required: true,
          optionSource:
            "semesters",
          type: "select",
          placeholderOption:
            "Select semester",
        },
        {
          key: "name",
          label:
            "Section name",
          required: true,
          placeholder:
            "A",
        },
        {
          key:
            "capacity",
          label:
            "Capacity",
          type: "number",
          min: 1,
          placeholder:
            "60",
        },
      ];

    case "courses":
      return [
        {
          key:
            "departmentId",
          label:
            "Department",
          required: true,
          optionSource:
            "departments",
          type: "select",
          placeholderOption:
            "Select department",
        },
        {
          key: "code",
          label:
            "Course code",
          required: true,
          placeholder:
            "CS301",
        },
        {
          key: "name",
          label:
            "Course name",
          required: true,
          placeholder:
            "Data Structures",
        },
        {
          key: "credits",
          label: "Credits",
          required: true,
          type: "number",
          min: 1,
        },
        {
          key:
            "description",
          label:
            "Description",
          placeholder:
            "Course description",
        },
      ];

    case "course-offerings":
      return [
        {
          key:
            "courseId",
          label: "Course",
          required: true,
          optionSource:
            "courses",
          type: "select",
          placeholderOption:
            "Select course",
        },
        {
          key:
            "semesterId",
          label:
            "Semester",
          required: true,
          optionSource:
            "semesters",
          type: "select",
          placeholderOption:
            "Select semester",
        },
        {
          key:
            "sectionId",
          label:
            "Section",
          required: true,
          optionSource:
            "sections",
          type: "select",
          placeholderOption:
            "Select section",
        },
        {
          key:
            "facultyId",
          label:
            "Faculty",
          optionSource:
            "faculty",
          type: "select",
          placeholderOption:
            "Select faculty (optional)",
        },
      ];

    default:
      return [];
  }
}

function Field({
  label,
  required,
  children,
  help,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  help?: string;
}) {
  return (
    <div>
      <label
        className={
          labelClass()
        }
      >
        {label}

        {required && (
          <span className="ml-1 text-red-500">
            *
          </span>
        )}
      </label>

      {children}

      {help && (
        <p className="mt-1 text-[11px] leading-4 text-slate-400">
          {help}
        </p>
      )}
    </div>
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-5 py-4">
          <h3 className="font-semibold text-slate-950">
            {title}
          </h3>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            ✕
          </button>
        </div>

        <div className="p-5">
          {children}
        </div>
      </div>
    </div>
  );
}

function ModalActions({
  onCancel,
  saving,
  submitLabel,
}: {
  onCancel: () => void;
  saving: boolean;
  submitLabel: string;
}) {
  return (
    <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
      <button
        type="button"
        onClick={onCancel}
        className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
      >
        Cancel
      </button>

      <button
        type="submit"
        disabled={saving}
        className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        {saving
          ? "Saving…"
          : submitLabel}
      </button>
    </div>
  );
}

function Alert({
  tone,
  text,
  onClose,
}: {
  tone:
    | "error"
    | "success";
  text: string;
  onClose: () => void;
}) {
  return (
    <div
      className={`mb-4 flex items-start justify-between gap-4 rounded-xl border p-3 text-sm ${
        tone ===
        "error"
          ? "border-red-100 bg-red-50 text-red-700"
          : "border-emerald-100 bg-emerald-50 text-emerald-700"
      }`}
    >
      <span>
        {text}
      </span>

      <button
        onClick={
          onClose
        }
        className="font-bold opacity-60 hover:opacity-100"
      >
        ✕
      </button>
    </div>
  );
}

function StatusBadge({
  active,
}: {
  active: boolean;
}) {
  return (
    <span
      className={`rounded-full px-2 py-1 text-xs font-semibold ${
        active
          ? "bg-emerald-50 text-emerald-700"
          : "bg-slate-100 text-slate-500"
      }`}
    >
      {active
        ? "Active"
        : "Inactive"}
    </span>
  );
}

function Loading() {
  return (
    <div className="p-8 text-center text-sm text-slate-400">
      Loading live data…
    </div>
  );
}

function EmptyState({
  text,
}: {
  text: string;
}) {
  return (
    <div className="p-8 text-center text-sm text-slate-400">
      {text}
    </div>
  );
}
