"use client";

import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
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
};

type ListResponse<T> = {
  success?: boolean;
  data?: T[];
  meta?: {
    total?: number;
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
    endpoint: "/users?role=STUDENT&page=1&pageSize=100",
    description:
      "Student accounts and institutional identities.",
    canCreate: true,
  },
  {
    key: "faculty",
    label: "Faculty",
    endpoint: "/users?role=FACULTY&page=1&pageSize=100",
    description:
      "Faculty accounts and teaching staff.",
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
      "Academic calendars and current academic year.",
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
      "Student sections within semesters.",
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
      "Assign courses to semesters, sections and faculty.",
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
  return "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-100";
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

export function AdminPortal() {
  const router = useRouter();

  const [activeModule, setActiveModule] =
    useState<ModuleKey>("overview");

  const [user, setUser] =
    useState<Awaited<
      ReturnType<typeof getCurrentUser>
    > | null>(null);

  const [records, setRecords] =
    useState<RecordItem[]>([]);

  const [users, setUsers] =
    useState<User[]>([]);

  const [loading, setLoading] =
    useState(false);

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  const [search, setSearch] =
    useState("");

  const [editing, setEditing] =
    useState<RecordItem | null>(null);

  const [showCreate, setShowCreate] =
    useState(false);

  const [showUserCreate, setShowUserCreate] =
    useState(false);

  const [stats, setStats] = useState({
    users: 0,
    students: 0,
    faculty: 0,
    departments: 0,
    programs: 0,
    courses: 0,
    sections: 0,
    offerings: 0,
  });

  const [userForm, setUserForm] =
    useState({
      email: "",
      firstName: "",
      lastName: "",
      phone: "",
      password: "",
      role: "STUDENT",
    });

  const [form, setForm] =
    useState<Record<string, string>>({});

  const currentModule = useMemo(
    () =>
      modules.find(
        (module) =>
          module.key === activeModule
      ) || modules[0],
    [activeModule]
  );

  useEffect(() => {
    async function initialize() {
      try {
        if (!isAuthenticated()) {
          router.replace("/login");
          return;
        }

        const currentUser =
          await getCurrentUser();

        if (
          !currentUser.roles.includes(
            "INSTITUTION_ADMIN"
          )
        ) {
          router.replace("/login");
          return;
        }

        setUser(currentUser);
        await loadOverview();
      } catch (err) {
        if (err instanceof AuthRequiredError) {
          router.replace("/login");
        } else {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to initialize admin portal."
          );
        }
      }
    }

    void initialize();
  }, [router]);

  useEffect(() => {
    if (
      activeModule !== "overview" &&
      currentModule.endpoint
    ) {
      void loadModule();
    }
  }, [activeModule]);

  async function loadOverview() {
    setLoading(true);
    setError("");

    try {
      const [
        userResponse,
        departmentResponse,
        programResponse,
        courseResponse,
        sectionResponse,
        offeringResponse,
      ] = await Promise.all([
        authedFetch<UserListResponse>(
          "/users?page=1&pageSize=100"
        ),
        authedFetch<ListResponse<RecordItem>>(
          "/departments?page=1&pageSize=100"
        ),
        authedFetch<ListResponse<RecordItem>>(
          "/programs?page=1&pageSize=100"
        ),
        authedFetch<ListResponse<RecordItem>>(
          "/courses?page=1&pageSize=100"
        ),
        authedFetch<ListResponse<RecordItem>>(
          "/sections?page=1&pageSize=100"
        ),
        authedFetch<ListResponse<RecordItem>>(
          "/course-offerings?page=1&pageSize=100"
        ),
      ]);

      const loadedUsers =
        userResponse.data?.items || [];

      setUsers(loadedUsers);

      setStats({
        users:
          userResponse.data?.total ||
          loadedUsers.length,
        students: loadedUsers.filter((item) =>
          item.roles?.some(
            (role) =>
              role.name === "STUDENT"
          )
        ).length,
        faculty: loadedUsers.filter((item) =>
          item.roles?.some(
            (role) =>
              role.name === "FACULTY"
          )
        ).length,
        departments:
          normalizeList(
            departmentResponse
          ).length,
        programs:
          normalizeList(
            programResponse
          ).length,
        courses:
          normalizeList(
            courseResponse
          ).length,
        sections:
          normalizeList(
            sectionResponse
          ).length,
        offerings:
          normalizeList(
            offeringResponse
          ).length,
      });
    } catch (err) {
      handleError(err);
    } finally {
      setLoading(false);
    }
  }

  async function loadModule() {
    if (
      !currentModule.endpoint ||
      activeModule === "overview"
    ) {
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      if (
        activeModule === "users" ||
        activeModule === "students" ||
        activeModule === "faculty"
      ) {
        const response =
          await authedFetch<UserListResponse>(
            currentModule.endpoint
          );

        setUsers(
          response.data?.items || []
        );
        setRecords([]);
      } else {
        const response =
          await authedFetch<
            ListResponse<RecordItem>
          >(
            currentModule.endpoint +
              (currentModule.endpoint.includes("?")
                ? "&page=1&pageSize=100"
                : "?page=1&pageSize=100")
          );

        setRecords(
          normalizeList(response)
        );
        setUsers([]);
      }
    } catch (err) {
      handleError(err);
    } finally {
      setLoading(false);
    }
  }

  function handleError(err: unknown) {
    if (
      err instanceof AuthRequiredError
    ) {
      router.replace("/login");
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

  function openModule(key: ModuleKey) {
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
    setForm({});
    setShowCreate(true);
  }

  function startEdit(item: RecordItem) {
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
          typeof value !== "object"
        ) {
          next[key] = String(value);
        }
      }
    );

    setForm(next);
  }

  function setField(
    key: string,
    value: string
  ) {
    setForm((previous) => ({
      ...previous,
      [key]: value,
    }));
  }

  function numberValue(
    value: string
  ) {
    const parsed = Number(value);
    return Number.isFinite(parsed)
      ? parsed
      : 0;
  }

  function buildPayload() {
    const payload: Record<
      string,
      unknown
    > = {};

    Object.entries(form).forEach(
      ([key, value]) => {
        if (value === "") {
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
          payload[key] =
            numberValue(value);
          return;
        }

        if (
          [
            "isCurrent",
            "isActive",
          ].includes(key)
        ) {
          payload[key] = value === "true";
          return;
        }

        payload[key] = value;
      }
    );

    return payload;
  }

  async function saveRecord(
    event: FormEvent
  ) {
    event.preventDefault();

    if (!currentModule.endpoint) {
      return;
    }

    setSaving(true);
    clearMessages();

    try {
      const payload =
        buildPayload();

      const endpoint =
        editing
          ? `${currentModule.endpoint}/${editing.id}`
          : currentModule.endpoint;

      await authedFetch(endpoint, {
        method: editing
          ? "PATCH"
          : "POST",
        body: JSON.stringify(payload),
      });

      setSuccess(
        editing
          ? `${currentModule.label.slice(
              0,
              -1
            )} updated successfully.`
          : `${currentModule.label.slice(
              0,
              -1
            )} created successfully.`
      );

      setEditing(null);
      setShowCreate(false);
      setForm({});

      await loadModule();
      await loadOverview();
    } catch (err) {
      handleError(err);
    } finally {
      setSaving(false);
    }
  }

  async function deactivate(
    item: RecordItem
  ) {
    if (!currentModule.endpoint) {
      return;
    }

    const confirmed =
      window.confirm(
        `Deactivate "${getRecordName(
          item
        )}"?`
      );

    if (!confirmed) {
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

      await loadModule();
      await loadOverview();
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
      await authedFetch("/users", {
        method: "POST",
        body: JSON.stringify({
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
      });

      setSuccess(
        `${userForm.role.replace(
          "_",
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

      setShowUserCreate(false);

      await loadModule();
      await loadOverview();
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
          body: JSON.stringify({
            isActive: !item.isActive,
          }),
        }
      );

      setSuccess(
        item.isActive
          ? "User deactivated."
          : "User activated."
      );

      await loadModule();
      await loadOverview();
    } catch (err) {
      handleError(err);
    } finally {
      setSaving(false);
    }
  }

  const filteredRecords =
    records.filter((item) => {
      if (!search.trim()) {
        return true;
      }

      const text =
        `${item.name || ""} ${
          item.code || ""
        } ${item.title || ""} ${
          item.id
        }`.toLowerCase();

      return text.includes(
        search.toLowerCase()
      );
    });

  const filteredUsers =
    users.filter((item) => {
      if (!search.trim()) {
        return true;
      }

      const text =
        `${item.firstName} ${
          item.lastName
        } ${item.email} ${
          item.roles
            ?.map((role) => role.name)
            .join(" ") || ""
        }`.toLowerCase();

      return text.includes(
        search.toLowerCase()
      );
    });

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
                {user.firstName}{" "}
                {user.lastName} ·{" "}
                Institution Admin
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                void loadOverview();
                if (
                  activeModule !==
                  "overview"
                ) {
                  void loadModule();
                }
              }}
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

      <div className="mx-auto grid max-w-[1500px] gap-5 p-5 lg:grid-cols-[245px_1fr]">
        <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-2 lg:sticky lg:top-[90px]">
          <p className="px-3 pb-2 pt-2 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
            Administration
          </p>

          <nav className="space-y-1">
            {modules.map((module) => (
              <button
                key={module.key}
                onClick={() =>
                  openModule(
                    module.key
                  )
                }
                className={`w-full rounded-xl px-3 py-2.5 text-left text-sm font-medium transition ${
                  activeModule ===
                  module.key
                    ? "bg-slate-950 text-white"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {module.label}
              </button>
            ))}
          </nav>
        </aside>

        <section className="min-w-0">
          {error && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {success}
            </div>
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
              <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Administration
                  </p>

                  <h2 className="mt-1 text-2xl font-bold text-slate-950">
                    {currentModule.label}
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    {
                      currentModule.description
                    }
                  </p>
                </div>

                <div className="flex gap-2">
                  {currentModule.canCreate &&
                    activeModule !==
                      "users" &&
                    activeModule !==
                      "students" &&
                    activeModule !==
                      "faculty" && (
                      <button
                        onClick={
                          startCreate
                        }
                        className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
                      >
                        + Add{" "}
                        {
                          currentModule.label
                        }
                      </button>
                    )}

                  {(activeModule ===
                    "users" ||
                    activeModule ===
                      "students" ||
                    activeModule ===
                      "faculty") && (
                    <button
                      onClick={() =>
                        setShowUserCreate(
                          true
                        )
                      }
                      className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
                    >
                      + Create User
                    </button>
                  )}
                </div>
              </div>

              {(activeModule ===
                "users" ||
                activeModule ===
                  "students" ||
                activeModule ===
                  "faculty") && (
                <UserTable
                  users={
                    filteredUsers
                  }
                  search={search}
                  setSearch={
                    setSearch
                  }
                  loading={loading}
                  onToggle={
                    toggleUser
                  }
                />
              )}

              {activeModule !==
                "users" &&
                activeModule !==
                  "students" &&
                activeModule !==
                  "faculty" && (
                  <RecordTable
                    records={
                      filteredRecords
                    }
                    search={search}
                    setSearch={
                      setSearch
                    }
                    loading={loading}
                    onEdit={
                      startEdit
                    }
                    onDeactivate={
                      deactivate
                    }
                  />
                )}
            </div>
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
                onSubmit={createUser}
                className="space-y-4"
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
                      onChange={(event) =>
                        setUserForm(
                          (previous) => ({
                            ...previous,
                            firstName:
                              event.target
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
                      onChange={(event) =>
                        setUserForm(
                          (previous) => ({
                            ...previous,
                            lastName:
                              event.target
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
                      onChange={(event) =>
                        setUserForm(
                          (previous) => ({
                            ...previous,
                            email:
                              event.target
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
                      onChange={(event) =>
                        setUserForm(
                          (previous) => ({
                            ...previous,
                            phone:
                              event.target
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
                      onChange={(event) =>
                        setUserForm(
                          (previous) => ({
                            ...previous,
                            password:
                              event.target
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
                      onChange={(event) =>
                        setUserForm(
                          (previous) => ({
                            ...previous,
                            role:
                              event.target
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
                            key={role}
                            value={role}
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
            currentModule.endpoint && (
              <Modal
                title={
                  editing
                    ? `Edit ${currentModule.label}`
                    : `Add ${currentModule.label}`
                }
                onClose={() => {
                  setShowCreate(
                    false
                  );
                  setEditing(null);
                }}
              >
                <RecordForm
                  module={
                    currentModule.key
                  }
                  form={form}
                  setField={setField}
                  onSubmit={
                    saveRecord
                  }
                  onCancel={() => {
                    setShowCreate(
                      false
                    );
                    setEditing(null);
                  }}
                  saving={saving}
                  editing={Boolean(
                    editing
                  )}
                />
              </Modal>
            )}
        </section>
      </div>
    </main>
  );
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
    departments: number;
    programs: number;
    courses: number;
    sections: number;
    offerings: number;
  };
  loading: boolean;
  onOpen: (
    module: ModuleKey
  ) => void;
}) {
  const cards = [
    {
      label: "Total Users",
      value: stats.users,
      module: "users" as ModuleKey,
    },
    {
      label: "Students",
      value: stats.students,
      module: "students" as ModuleKey,
    },
    {
      label: "Faculty",
      value: stats.faculty,
      module: "faculty" as ModuleKey,
    },
    {
      label: "Departments",
      value: stats.departments,
      module: "departments" as ModuleKey,
    },
    {
      label: "Programs",
      value: stats.programs,
      module: "programs" as ModuleKey,
    },
    {
      label: "Courses",
      value: stats.courses,
      module: "courses" as ModuleKey,
    },
    {
      label: "Sections",
      value: stats.sections,
      module: "sections" as ModuleKey,
    },
    {
      label: "Course Offerings",
      value: stats.offerings,
      module:
        "course-offerings" as ModuleKey,
    },
  ];

  return (
    <div>
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Institution overview
        </p>

        <h2 className="mt-1 text-2xl font-bold text-slate-950">
          Administration Dashboard
        </h2>

        <p className="mt-1 max-w-2xl text-sm text-slate-500">
          Manage the institution's
          people, academic structure
          and teaching configuration
          from one place.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <button
            key={card.label}
            onClick={() =>
              onOpen(card.module)
            }
            className="rounded-2xl border border-slate-200 bg-white p-5 text-left transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-sm"
          >
            <p className="text-sm font-medium text-slate-500">
              {card.label}
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
        ))}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <QuickCard
          title="People"
          description="Create student, faculty, staff and administrative accounts."
          button="Manage Users"
          onClick={() =>
            onOpen("users")
          }
        />

        <QuickCard
          title="Academic Structure"
          description="Build departments, programs, years, semesters, sections and courses."
          button="Manage Departments"
          onClick={() =>
            onOpen(
              "departments"
            )
          }
        />

        <QuickCard
          title="Teaching Setup"
          description="Connect courses, sections and faculty through course offerings."
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
              event.target.value
            )
          }
          placeholder="Search by name, email or role..."
          className={inputClass()}
        />
      </div>

      {loading ? (
        <Loading />
      ) : users.length === 0 ? (
        <EmptyState text="No users found." />
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-4 py-3">
                  User
                </th>
                <th className="px-4 py-3">
                  Role
                </th>
                <th className="px-4 py-3">
                  Status
                </th>
                <th className="px-4 py-3 text-right">
                  Action
                </th>
              </tr>
            </thead>

            <tbody>
              {users.map((item) => (
                <tr
                  key={item.id}
                  className="border-t border-slate-100"
                >
                  <td className="px-4 py-4">
                    <p className="font-semibold text-slate-900">
                      {
                        item.firstName
                      }{" "}
                      {
                        item.lastName
                      }
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {item.email}
                    </p>
                  </td>

                  <td className="px-4 py-4">
                    <div className="flex flex-wrap gap-1">
                      {(
                        item.roles ||
                        []
                      ).map(
                        (role) => (
                          <span
                            key={
                              role.id
                            }
                            className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600"
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

                  <td className="px-4 py-4">
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-semibold ${
                        item.isActive
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-red-50 text-red-700"
                      }`}
                    >
                      {item.isActive
                        ? "Active"
                        : "Inactive"}
                    </span>
                  </td>

                  <td className="px-4 py-4 text-right">
                    <button
                      onClick={() =>
                        onToggle(
                          item
                        )
                      }
                      className="text-xs font-semibold text-slate-700 underline underline-offset-4"
                    >
                      {item.isActive
                        ? "Deactivate"
                        : "Activate"}
                    </button>
                  </td>
                </tr>
              ))}
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
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="border-b border-slate-100 p-4">
        <input
          value={search}
          onChange={(event) =>
            setSearch(
              event.target.value
            )
          }
          placeholder="Search records..."
          className={inputClass()}
        />
      </div>

      {loading ? (
        <Loading />
      ) : records.length === 0 ? (
        <EmptyState text="No records found." />
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-4 py-3">
                  Record
                </th>
                <th className="px-4 py-3">
                  Code / ID
                </th>
                <th className="px-4 py-3">
                  Status
                </th>
                <th className="px-4 py-3 text-right">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody>
              {records.map(
                (item) => (
                  <tr
                    key={item.id}
                    className="border-t border-slate-100"
                  >
                    <td className="px-4 py-4">
                      <p className="font-semibold text-slate-900">
                        {getRecordName(
                          item
                        )}
                      </p>
                    </td>

                    <td className="px-4 py-4 text-xs text-slate-500">
                      {item.code
                        ? String(
                            item.code
                          )
                        : item.id}
                    </td>

                    <td className="px-4 py-4">
                      {item.isActive ===
                      false ? (
                        <span className="rounded-full bg-red-50 px-2 py-1 text-xs font-semibold text-red-700">
                          Inactive
                        </span>
                      ) : (
                        <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">
                          Active
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-4 text-right">
                      <button
                        onClick={() =>
                          onEdit(
                            item
                          )
                        }
                        className="mr-4 text-xs font-semibold text-slate-700 underline underline-offset-4"
                      >
                        Edit
                      </button>

                      <button
                        onClick={() =>
                          onDeactivate(
                            item
                          )
                        }
                        className="text-xs font-semibold text-red-600 underline underline-offset-4"
                      >
                        Deactivate
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

function RecordForm({
  module,
  form,
  setField,
  onSubmit,
  onCancel,
  saving,
  editing,
}: {
  module: ModuleKey;
  form: Record<string, string>;
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
}) {
  const fields =
    getFieldsForModule(module);

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-5"
    >
      <div className="grid gap-4 md:grid-cols-2">
        {fields.map((field) => (
          <Field
            key={field.key}
            label={field.label}
            required={field.required}
          >
            {field.type ===
            "select" ? (
              <select
                required={
                  field.required
                }
                value={
                  form[field.key] ||
                  field.defaultValue ||
                  ""
                }
                onChange={(event) =>
                  setField(
                    field.key,
                    event.target
                      .value
                  )
                }
                className={
                  inputClass()
                }
              >
                <option value="">
                  Select{" "}
                  {field.label}
                </option>

                {field.options?.map(
                  (option) => (
                    <option
                      key={
                        option.value
                      }
                      value={
                        option.value
                      }
                    >
                      {option.label}
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
                  field.type || "text"
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
                  form[field.key] ||
                  ""
                }
                onChange={(event) =>
                  setField(
                    field.key,
                    event.target
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
        ))}
      </div>

      <div className="rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-500">
        {editing
          ? "Changes are validated by the backend before being saved."
          : "The record will be created inside your institution. Tenant boundaries are enforced by the backend."}
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
  defaultValue?: string;
  options?: {
    value: string;
    label: string;
  }[];
};

function getFieldsForModule(
  module: ModuleKey
): FormField[] {
  switch (module) {
    case "departments":
      return [
        {
          key: "name",
          label: "Department name",
          required: true,
        },
        {
          key: "code",
          label: "Department code",
          required: true,
        },
        {
          key: "campusId",
          label: "Campus ID",
          placeholder:
            "Optional campus UUID",
        },
      ];

    case "programs":
      return [
        {
          key: "departmentId",
          label: "Department ID",
          required: true,
          placeholder:
            "Department UUID",
        },
        {
          key: "name",
          label: "Program name",
          required: true,
        },
        {
          key: "code",
          label: "Program code",
          required: true,
        },
        {
          key: "level",
          label: "Level",
          required: true,
          placeholder:
            "UG / PG / Diploma",
        },
        {
          key: "durationYears",
          label: "Duration in years",
          required: true,
          type: "number",
          min: 1,
        },
      ];

    case "academic-years":
      return [
        {
          key: "name",
          label: "Academic year",
          required: true,
          placeholder:
            "2026-27",
        },
        {
          key: "startDate",
          label: "Start date",
          required: true,
          type: "date",
        },
        {
          key: "endDate",
          label: "End date",
          required: true,
          type: "date",
        },
        {
          key: "isCurrent",
          label: "Current",
          type: "select",
          options: [
            {
              value: "true",
              label: "Yes",
            },
            {
              value: "false",
              label: "No",
            },
          ],
        },
      ];

    case "semesters":
      return [
        {
          key: "programId",
          label: "Program ID",
          required: true,
        },
        {
          key: "academicYearId",
          label: "Academic year ID",
          required: true,
        },
        {
          key: "number",
          label: "Semester number",
          required: true,
          type: "number",
          min: 1,
        },
        {
          key: "name",
          label: "Semester name",
          required: true,
          placeholder:
            "Semester 1",
        },
        {
          key: "startDate",
          label: "Start date",
          type: "date",
        },
        {
          key: "endDate",
          label: "End date",
          type: "date",
        },
      ];

    case "sections":
      return [
        {
          key: "semesterId",
          label: "Semester ID",
          required: true,
        },
        {
          key: "name",
          label: "Section name",
          required: true,
          placeholder:
            "A",
        },
        {
          key: "capacity",
          label: "Capacity",
          type: "number",
          min: 1,
        },
      ];

    case "courses":
      return [
        {
          key: "departmentId",
          label: "Department ID",
          required: true,
        },
        {
          key: "code",
          label: "Course code",
          required: true,
        },
        {
          key: "name",
          label: "Course name",
          required: true,
        },
        {
          key: "credits",
          label: "Credits",
          required: true,
          type: "number",
          min: 1,
        },
        {
          key: "description",
          label: "Description",
        },
      ];

    case "course-offerings":
      return [
        {
          key: "courseId",
          label: "Course ID",
          required: true,
        },
        {
          key: "semesterId",
          label: "Semester ID",
          required: true,
        },
        {
          key: "sectionId",
          label: "Section ID",
          required: true,
        },
        {
          key: "facultyId",
          label: "Faculty ID",
          placeholder:
            "Optional faculty UUID",
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
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className={labelClass()}>
        {label}
        {required && (
          <span className="ml-1 text-red-500">
            *
          </span>
        )}
      </label>

      {children}
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
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="sticky top-0 flex items-center justify-between border-b border-slate-100 bg-white px-5 py-4">
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
          ? "Saving..."
          : submitLabel}
      </button>
    </div>
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
