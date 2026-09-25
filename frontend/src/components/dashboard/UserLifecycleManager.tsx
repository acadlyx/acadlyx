"use client";

import Link from "next/link";
import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  useRouter,
  useSearchParams,
} from "next/navigation";

import { DashboardShell } from "./DashboardShell";

import { AuthRequiredError } from "@/lib/auth";

import {
  AdminUser,
  AdminWorkspace,
  createAdminUser,
  getAdminWorkspace,
  listAdminUsers,
  setAdminUserActive,
} from "@/lib/adminApi";

type Category =
  | "students"
  | "faculty"
  | "administrators"
  | "leadership"
  | "operations"
  | "parents";

const ROLES: Record<Category, string[]> = {
  students: ["STUDENT"],
  faculty: ["FACULTY"],
  administrators: ["INSTITUTION_ADMIN"],
  leadership: [
    "CHAIRMAN",
    "DIRECTOR",
    "DEAN",
    "REGISTRAR",
    "HOD",
  ],
  operations: [
    "ACCOUNTS",
    "HR",
    "ADMISSIONS",
    "EXAMINATION",
    "LIBRARIAN",
    "PLACEMENT",
    "IT",
  ],
  parents: ["PARENT"],
};

const CREATION_ROLES = [
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
] as const;

const META: Array<{
  key: Category;
  label: string;
  description: string;
  href: string;
  color: string;
}> = [
  {
    key: "students",
    label: "Students",
    description:
      "Student records, enrolments, guardians and academic history.",
    href: "/students",
    color: "from-blue-600 to-indigo-600",
  },
  {
    key: "faculty",
    label: "Faculty",
    description:
      "Teaching accounts, contact details and account status.",
    href: "/user-management?category=faculty",
    color: "from-violet-600 to-fuchsia-600",
  },
  {
    key: "administrators",
    label: "Administrators",
    description:
      "Institution administrators responsible for the tenant workspace.",
    href: "/user-management?category=administrators",
    color: "from-cyan-600 to-blue-600",
  },
  {
    key: "leadership",
    label: "Leadership",
    description:
      "Chairman, director, dean, registrar and HOD accounts.",
    href: "/user-management?category=leadership",
    color: "from-amber-500 to-orange-600",
  },
  {
    key: "operations",
    label: "Operations",
    description:
      "Accounts, HR, admissions, examinations, library, placement and IT.",
    href: "/user-management?category=operations",
    color: "from-emerald-600 to-teal-600",
  },
  {
    key: "parents",
    label: "Parents",
    description:
      "Parent accounts linked to the institution's students.",
    href: "/user-management?category=parents",
    color: "from-rose-500 to-pink-600",
  },
];

const DEFAULT_ROLE: Record<
  Category,
  string
> = {
  students: "FACULTY",
  faculty: "FACULTY",
  administrators: "INSTITUTION_ADMIN",
  leadership: "HOD",
  operations: "ACCOUNTS",
  parents: "FACULTY",
};

function roleLabel(role: string) {
  return role
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(
      /\b\w/g,
      (letter) =>
        letter.toUpperCase(),
    );
}

function initials(user: AdminUser) {
  return (
    `${user.firstName?.[0] || ""}${user.lastName?.[0] || ""}`
      .toUpperCase() || "?"
  );
}

function getCategory(
  value: string | null,
): Category | null {
  return value &&
    META.some(
      (item) =>
        item.key === value,
    )
    ? (value as Category)
    : null;
}

function inCategory(
  users: AdminUser[],
  category: Category,
) {
  const roles = new Set(
    ROLES[category],
  );

  return users.filter(
    (user) =>
      user.roles.some((role) =>
        roles.has(role.name),
      ),
  );
}

function formatDate(
  value?: string,
) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleDateString(
    "en-IN",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    },
  );
}

export function UserLifecycleManager() {
  const router = useRouter();
  const searchParams =
    useSearchParams();

  const category = getCategory(
    searchParams.get(
      "category",
    ),
  );

  const [users, setUsers] =
    useState<AdminUser[]>([]);

  const [workspace, setWorkspace] =
    useState<AdminWorkspace | null>(
      null,
    );

  const [selected, setSelected] =
    useState<AdminUser | null>(
      null,
    );

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [query, setQuery] =
    useState("");

  const [showCreate, setShowCreate] =
    useState(false);

  const [creating, setCreating] =
    useState(false);

  const [pending, setPending] =
    useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError("");

    try {
      const [
        workspaceData,
        people,
      ] = await Promise.all([
        getAdminWorkspace(),
        listAdminUsers(),
      ]);

      setWorkspace(
        workspaceData,
      );

      setUsers(people);
    } catch (reason) {
      if (
        reason instanceof
        AuthRequiredError
      ) {
        router.replace(
          "/login",
        );

        return;
      }

      setError(
        reason instanceof Error
          ? reason.message
          : "Unable to load people.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const counts = useMemo(() => {
    const result: Record<
      Category,
      number
    > = {
      students:
        workspace?.stats.students ||
        0,
      faculty:
        workspace?.stats.faculty ||
        0,
      administrators: 0,
      leadership: 0,
      operations: 0,
      parents: 0,
    };

    (
      Object.keys(
        result,
      ) as Category[]
    )
      .filter(
        (key) =>
          key !== "students" &&
          key !== "faculty",
      )
      .forEach((key) => {
        result[key] =
          inCategory(
            users,
            key,
          ).length;
      });

    return result;
  }, [
    users,
    workspace,
  ]);

  const visible = useMemo(() => {
    if (!category) {
      return [];
    }

    const term =
      query
        .trim()
        .toLowerCase();

    return inCategory(
      users,
      category,
    ).filter((user) => {
      if (!term) {
        return true;
      }

      return [
        user.firstName,
        user.lastName,
        user.email,
        user.phone || "",
        user.roles
          .map(
            (role) =>
              role.name,
          )
          .join(" "),
      ]
        .join(" ")
        .toLowerCase()
        .includes(term);
    });
  }, [
    category,
    query,
    users,
  ]);

  async function toggle(
    user: AdminUser,
  ) {
    const next =
      !user.isActive;

    if (
      !window.confirm(
        `${
          next
            ? "Reactivate"
            : "Deactivate"
        } ${user.firstName} ${user.lastName}?`,
      )
    ) {
      return;
    }

    setPending(
      user.id,
    );

    setError("");

    try {
      const updated =
        await setAdminUserActive(
          user.id,
          next,
        );

      setUsers((current) =>
        current.map((item) =>
          item.id === updated.id
            ? {
                ...item,
                ...updated,
              }
            : item,
        ),
      );

      setSelected(
        (current) =>
          current?.id === updated.id
            ? updated
            : current,
      );
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Unable to change account status.",
      );
    } finally {
      setPending(null);
    }
  }

  async function createPerson(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setCreating(true);
    setError("");

    try {
      const form =
        new FormData(
          event.currentTarget,
        );

      const role =
        String(
          form.get("role") ||
            "",
        ).toUpperCase();

      if (
        !CREATION_ROLES.includes(
          role as (typeof CREATION_ROLES)[number],
        )
      ) {
        throw new Error(
          "Select a valid institutional role.",
        );
      }

      const created =
        await createAdminUser({
          firstName:
            String(
              form.get(
                "firstName",
              ) || "",
            ).trim(),

          lastName:
            String(
              form.get(
                "lastName",
              ) || "",
            ).trim(),

          email:
            String(
              form.get(
                "email",
              ) || "",
            ).trim(),

          phone:
            String(
              form.get(
                "phone",
              ) || "",
            ).trim(),

          password:
            String(
              form.get(
                "password",
              ) || "",
            ),

          role,
        });

      setUsers(
        (current) => [
          created,
          ...current,
        ],
      );

      setSelected(
        created,
      );

      setShowCreate(false);

      event.currentTarget.reset();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Unable to create the account.",
      );
    } finally {
      setCreating(false);
    }
  }

  const pageTitle =
    category
      ? META.find(
          (item) =>
            item.key ===
            category,
        )?.label ||
        "People"
      : "People";

  return (
    <DashboardShell
      title={pageTitle}
      subtitle={
        category
          ? "Institution-scoped people records"
          : "People organized by responsibility"
      }
      allowedRoles={[
        "INSTITUTION_ADMIN",
      ]}
    >
      <main className="mx-auto max-w-[1320px] space-y-6 pb-10">
        {error ? (
          <div className="flex items-center justify-between gap-3 rounded-[20px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <span>{error}</span>

            <button
              onClick={() =>
                void load()
              }
              className="rounded-xl bg-red-700 px-3 py-2 text-xs font-bold text-white"
            >
              Retry
            </button>
          </div>
        ) : null}

        {!category ? (
          <>
            <section className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600">
                PEOPLE
              </p>

              <h1 className="mt-3 text-3xl font-black tracking-[-0.035em] text-slate-950 sm:text-4xl">
                People, organized by responsibility.
              </h1>

              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">
                Choose a people category instead of loading one large institution-wide directory. Students use the dedicated academic workflow; staff records use focused account views.
              </p>
            </section>

            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {META.map(
                (item) => (
                  <Link
                    key={item.key}
                    href={item.href}
                    className="group relative overflow-hidden rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-lg"
                  >
                    <div
                      className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${item.color}`}
                    />

                    <div className="flex items-start justify-between">
                      <span className="grid h-12 w-12 place-items-center rounded-[17px] bg-slate-100 text-lg font-black text-slate-700">
                        {item.label[0]}
                      </span>

                      <span className="rounded-full bg-slate-50 px-3 py-1.5 text-xs font-black text-slate-500">
                        {loading
                          ? "—"
                          : counts[
                              item.key
                            ]}
                      </span>
                    </div>

                    <p className="mt-5 text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">
                      {item.key}
                    </p>

                    <h2 className="mt-1 text-xl font-black text-slate-950">
                      {item.label}
                    </h2>

                    <p className="mt-2 min-h-[48px] text-sm leading-6 text-slate-500">
                      {item.description}
                    </p>

                    <div className="mt-5 flex justify-between text-sm font-extrabold text-blue-600">
                      <span>
                        Open{" "}
                        {item.label.toLowerCase()}
                      </span>

                      <span className="transition group-hover:translate-x-1">
                        →
                      </span>
                    </div>
                  </Link>
                ),
              )}
            </section>

            <section className="flex flex-col gap-4 rounded-[24px] border border-slate-200 bg-[#f8fafc] p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                  ACCOUNT CONTROL
                </p>

                <h2 className="mt-1 text-lg font-black">
                  Add institution staff
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Student creation stays in the Students workflow so account, profile and enrolment are created together.
                </p>
              </div>

              <button
                onClick={() =>
                  setShowCreate(true)
                }
                className="rounded-[14px] bg-blue-600 px-4 py-2.5 text-sm font-extrabold text-white hover:bg-blue-700"
              >
                Add staff account
              </button>
            </section>
          </>
        ) : (
          <>
            <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <button
                onClick={() =>
                  router.push(
                    "/user-management",
                  )
                }
                className="text-xs font-extrabold text-blue-600"
              >
                ← All people
              </button>

              <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h1 className="text-2xl font-black">
                    {pageTitle}
                  </h1>

                  <p className="mt-1 text-sm text-slate-500">
                    {visible.length} matching account
                    {visible.length === 1
                      ? ""
                      : "s"}
                  </p>
                </div>

                <div className="flex gap-2">
                  <input
                    value={query}
                    onChange={(event) =>
                      setQuery(
                        event.target
                          .value,
                      )
                    }
                    placeholder="Search…"
                    className="w-full rounded-[14px] border border-slate-200 bg-[#f8fafc] px-4 py-2.5 text-sm outline-none focus:border-blue-400 sm:w-64"
                  />

                  {category !==
                    "students" &&
                  category !==
                    "parents" ? (
                    <button
                      onClick={() =>
                        setShowCreate(
                          true,
                        )
                      }
                      className="rounded-[14px] bg-blue-600 px-4 py-2.5 text-sm font-extrabold text-white"
                    >
                      Add
                    </button>
                  ) : null}
                </div>
              </div>
            </section>

            <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {loading ? (
                Array.from({
                  length: 6,
                }).map((_, index) => (
                  <div
                    key={index}
                    className="h-36 animate-pulse rounded-[22px] bg-white"
                  />
                ))
              ) : visible.length ? (
                visible.map(
                  (person) => (
                    <button
                      key={person.id}
                      onClick={() =>
                        setSelected(
                          person,
                        )
                      }
                      className="group rounded-[22px] border border-slate-200 bg-white p-4 text-left shadow-sm hover:-translate-y-0.5 hover:border-blue-200"
                    >
                      <div className="flex gap-3">
                        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-[16px] bg-slate-950 text-sm font-black text-white">
                          {initials(
                            person,
                          )}
                        </span>

                        <div className="min-w-0 flex-1">
                          <div className="flex justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate font-extrabold">
                                {
                                  person.firstName
                                }{" "}
                                {
                                  person.lastName
                                }
                              </p>

                              <p className="mt-1 truncate text-xs text-slate-500">
                                {
                                  person.email
                                }
                              </p>
                            </div>

                            <span
                              className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                                person.isActive
                                  ? "bg-emerald-500"
                                  : "bg-slate-300"
                              }`}
                            />
                          </div>

                          <div className="mt-4 flex flex-wrap gap-1.5">
                            {person.roles.map(
                              (role) => (
                                <span
                                  key={
                                    role.id
                                  }
                                  className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-600"
                                >
                                  {roleLabel(
                                    role.name,
                                  )}
                                </span>
                              ),
                            )}
                          </div>
                        </div>
                      </div>
                    </button>
                  ),
                )
              ) : (
                <div className="md:col-span-2 xl:col-span-3 rounded-[22px] border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
                  No records found.
                </div>
              )}
            </section>
          </>
        )}

        {selected ? (
          <div className="fixed inset-0 z-[70] overflow-y-auto bg-slate-950/30 p-4 backdrop-blur-sm">
            <div className="mx-auto my-8 max-w-2xl overflow-hidden rounded-[28px] bg-[#f8fafc] shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-200 bg-white p-6">
                <div className="flex items-center gap-3">
                  <span className="grid h-14 w-14 place-items-center rounded-[18px] bg-slate-950 font-black text-white">
                    {initials(
                      selected,
                    )}
                  </span>

                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                      People record
                    </p>

                    <h2 className="mt-1 text-xl font-black">
                      {selected.firstName}{" "}
                      {selected.lastName}
                    </h2>

                    <p className="mt-1 text-sm text-slate-500">
                      {selected.email}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() =>
                    setSelected(
                      null,
                    )
                  }
                  className="grid h-10 w-10 place-items-center rounded-[14px] border border-slate-200"
                >
                  ×
                </button>
              </div>

              <div className="grid gap-3 p-5 sm:grid-cols-2">
                <Info
                  label="Email"
                  value={selected.email}
                />

                <Info
                  label="Phone"
                  value={
                    selected.phone ||
                    "—"
                  }
                />

                <Info
                  label="Role"
                  value={
                    selected.roles
                      .map(
                        (role) =>
                          roleLabel(
                            role.name,
                          ),
                      )
                      .join(", ") ||
                    "—"
                  }
                />

                <Info
                  label="Status"
                  value={
                    selected.isActive
                      ? "Active"
                      : "Inactive"
                  }
                />

                <Info
                  label="Created"
                  value={formatDate(
                    selected.createdAt,
                  )}
                />

                <Info
                  label="Updated"
                  value={formatDate(
                    selected.updatedAt,
                  )}
                />
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-200 bg-white p-5">
                <button
                  onClick={() =>
                    void toggle(
                      selected,
                    )
                  }
                  disabled={
                    pending ===
                    selected.id
                  }
                  className={`rounded-[13px] px-4 py-2.5 text-sm font-extrabold ${
                    selected.isActive
                      ? "border border-red-200 bg-red-50 text-red-700"
                      : "bg-emerald-600 text-white"
                  }`}
                >
                  {pending ===
                  selected.id
                    ? "Saving…"
                    : selected.isActive
                      ? "Deactivate"
                      : "Reactivate"}
                </button>

                <button
                  onClick={() =>
                    setSelected(
                      null,
                    )
                  }
                  className="rounded-[13px] border border-slate-200 bg-white px-4 py-2.5 text-sm font-extrabold"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {showCreate ? (
          <div className="fixed inset-0 z-[80] overflow-y-auto bg-slate-950/30 p-4 backdrop-blur-sm">
            <div className="mx-auto my-8 max-w-2xl rounded-[28px] bg-[#f8fafc] shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-200 bg-white p-6">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-600">
                    Create account
                  </p>

                  <h2 className="mt-1 text-xl font-black">
                    Add institution staff
                  </h2>
                </div>

                <button
                  onClick={() =>
                    setShowCreate(
                      false,
                    )
                  }
                  className="grid h-10 w-10 place-items-center rounded-[14px] border border-slate-200"
                >
                  ×
                </button>
              </div>

              <form
                onSubmit={
                  createPerson
                }
                className="space-y-4 p-6"
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input
                    name="firstName"
                    label="First name"
                    required
                  />

                  <Input
                    name="lastName"
                    label="Last name"
                    required
                  />

                  <Input
                    name="email"
                    label="Email"
                    type="email"
                    required
                  />

                  <Input
                    name="phone"
                    label="Phone"
                  />

                  <Input
                    name="password"
                    label="Temporary password"
                    type="password"
                    required
                  />

                  <label>
                    <span className="mb-1.5 block text-xs font-bold text-slate-600">
                      Role *
                    </span>

                    <select
                      name="role"
                      required
                      defaultValue={
                        category
                          ? DEFAULT_ROLE[
                              category
                            ]
                          : "FACULTY"
                      }
                      className="w-full rounded-[13px] border border-slate-200 bg-white px-3.5 py-3 text-sm outline-none"
                    >
                      <option value="">
                        Select role
                      </option>

                      {CREATION_ROLES.map(
                        (role) => (
                          <option
                            key={role}
                            value={role}
                          >
                            {roleLabel(
                              role,
                            )}
                          </option>
                        ),
                      )}
                    </select>
                  </label>
                </div>

                <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
                  <button
                    type="button"
                    onClick={() =>
                      setShowCreate(
                        false,
                      )
                    }
                    className="rounded-[13px] border border-slate-200 bg-white px-4 py-2.5 text-sm font-extrabold"
                  >
                    Cancel
                  </button>

                  <button
                    disabled={
                      creating
                    }
                    className="rounded-[13px] bg-blue-600 px-5 py-2.5 text-sm font-extrabold text-white disabled:opacity-50"
                  >
                    {creating
                      ? "Creating…"
                      : "Create account"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        ) : null}
      </main>
    </DashboardShell>
  );
}

function Info({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[16px] border border-slate-200 bg-white p-4">
      <p className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-400">
        {label}
      </p>

      <p className="mt-1 text-sm font-bold text-slate-800">
        {value}
      </p>
    </div>
  );
}

function Input({
  name,
  label: fieldLabel,
  type = "text",
  required = false,
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <label>
      <span className="mb-1.5 block text-xs font-bold text-slate-600">
        {fieldLabel}
        {required ? " *" : ""}
      </span>

      <input
        name={name}
        type={type}
        required={required}
        className="w-full rounded-[13px] border border-slate-200 bg-white px-3.5 py-3 text-sm outline-none focus:border-blue-400"
      />
    </label>
  );
}
