"use client";

import Link from "next/link";
import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useSearchParams } from "next/navigation";

import { DashboardShell } from "@/components/dashboard/DashboardShell";

import {
  AdminUser,
  UserDeletionRequest,
  approveAdminUserDeletionRequest,
  createAdminUser,
  listAdminUserDeletionRequests,
  listAdminUsers,
  listAdminDepartments,
  updateAdminUser,
  rejectAdminUserDeletionRequest,
  requestAdminUserPermanentDeletion,
  setAdminUserActive,
} from "@/lib/adminApi";

import {
  AuthRequiredError,
  AuthUser,
  getCachedCurrentUser,
  getCurrentUser,
} from "@/lib/auth";

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

const CATEGORIES: Array<{
  key: Category;
  label: string;
  description: string;
  color: string;
}> = [
  {
    key: "students",
    label: "Students",
    description:
      "Student records, enrolments, guardians and academic history.",
    color:
      "from-blue-600 to-indigo-600",
  },

  {
    key: "faculty",
    label: "Faculty",
    description:
      "Teaching accounts, contact details and account status.",
    color:
      "from-violet-600 to-fuchsia-600",
  },

  {
    key: "administrators",
    label: "Administrators",
    description:
      "Institution administrators responsible for the tenant workspace.",
    color:
      "from-cyan-600 to-blue-600",
  },

  {
    key: "leadership",
    label: "Leadership",
    description:
      "Chairman, director, dean, registrar and HOD accounts.",
    color:
      "from-amber-500 to-orange-600",
  },

  {
    key: "operations",
    label: "Operations",
    description:
      "Accounts, HR, admissions, examinations, library, placement and IT.",
    color:
      "from-emerald-600 to-teal-600",
  },

  {
    key: "parents",
    label: "Parents",
    description:
      "Parent accounts linked to the institution's students.",
    color:
      "from-rose-500 to-pink-600",
  },
];

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
    `${user.firstName?.[0] || ""}${
      user.lastName?.[0] || ""
    }`
  )
    .toUpperCase() || "?";
}

function getCategory(
  value: string | null,
): Category | null {
  return value &&
    CATEGORIES.some(
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
      user.roles.some(
        (role) =>
          roles.has(
            role.name,
          ),
      ),
  );
}

function formatDate(
  value?: string | null,
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

function Input({
  name,
  label,
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
        {label}
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

function AdminPeopleManagerContent() {
  const searchParams =
    useSearchParams();

  const category =
    getCategory(
      searchParams.get(
        "category",
      ),
    );

  const [user, setUser] =
    useState<AuthUser | null>(
      () =>
        getCachedCurrentUser(),
    );

  const [users, setUsers] =
    useState<AdminUser[]>(
      [],
    );

  const [
    requests,
    setRequests,
  ] = useState<
    UserDeletionRequest[]
  >([]);

  const [
    selected,
    setSelected,
  ] = useState<
    AdminUser | null
  >(null);

  const [query, setQuery] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [busyId, setBusyId] =
    useState<string | null>(
      null,
    );

  const [
    approvalId,
    setApprovalId,
  ] = useState<
    string | null
  >(null);

  const [
    showCreate,
    setShowCreate,
  ] = useState(false);

  const [
    creating,
    setCreating,
  ] = useState(false);

  const [
    editing,
    setEditing,
  ] = useState(false);

  const [
    savingEdit,
    setSavingEdit,
  ] = useState(false);

  const [
    departments,
    setDepartments,
  ] = useState<Array<{
    id: string;
    name: string;
    code?: string | null;
  }>>([]);

  const [error, setError] =
    useState("");

  const [message, setMessage] =
    useState("");

  useEffect(() => {
    let alive = true;

    getCurrentUser({
      background:
        Boolean(
          getCachedCurrentUser(),
        ),
    })
      .then((currentUser) => {
        if (!alive) {
          return;
        }

        setUser(currentUser);
      })
      .catch((reason) => {
        if (!alive) {
          return;
        }

        if (
          reason instanceof
          AuthRequiredError
        ) {
          window.location.replace(
            "/login",
          );

          return;
        }

        setError(
          reason instanceof
            Error
            ? reason.message
            : "Unable to load authorization.",
        );
      });

    return () => {
      alive = false;
    };
  }, []);

  const canRead = Boolean(
    user?.permissions.includes(
      "users.read",
    ),
  );

  const canCreate = Boolean(
    user?.permissions.includes(
      "users.create",
    ),
  );

  const canUpdate = Boolean(
    user?.permissions.includes(
      "users.update",
    ),
  );

  const canDelete = Boolean(
    user?.permissions.includes(
      "users.delete",
    ),
  );

  const canImport = Boolean(
    user?.permissions.includes(
      "imports.manage",
    ),
  );

  const isInstitutionAdmin =
    Boolean(
      user?.roles.includes(
        "INSTITUTION_ADMIN",
      ),
    );

  const canPermanentDelete =
    canDelete &&
    isInstitutionAdmin;

  async function loadPeople() {
    if (!canRead) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const people =
        await listAdminUsers({
          pageSize: 200,
        });

      setUsers(people);

      if (canUpdate) {
        try {
          setDepartments(await listAdminDepartments());
        } catch {
          setDepartments([]);
        }
      }

      try {
        setRequests(
          await listAdminUserDeletionRequests(),
        );
      } catch {
        setRequests([]);
      }
    } catch (reason) {
      setError(
        reason instanceof
          Error
          ? reason.message
          : "Unable to load institutional users.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (user) {
      void loadPeople();
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    user?.id,
    canRead,
  ]);

  const counts =
    useMemo(() => {
      const result =
        {} as Record<
          Category,
          number
        >;

      for (
        const item of CATEGORIES
      ) {
        result[item.key] =
          inCategory(
            users,
            item.key,
          ).length;
      }

      return result;
    }, [users]);

  const visible =
    useMemo(() => {
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
      ).filter(
        (person) => {
          if (!term) {
            return true;
          }

          return [
            person.firstName,
            person.lastName,
            person.email,
            person.phone || "",
            person.roles
              .map(
                (role) =>
                  role.name,
              )
              .join(" "),
          ]
            .join(" ")
            .toLowerCase()
            .includes(term);
        },
      );
    }, [
      category,
      query,
      users,
    ]);

  async function toggleActive(
    person: AdminUser,
  ) {
    if (!canUpdate) {
      return;
    }

    const next =
      !person.isActive;

    if (
      !window.confirm(
        `${
          next
            ? "Reactivate"
            : "Deactivate"
        } ${person.firstName} ${person.lastName}?`,
      )
    ) {
      return;
    }

    setBusyId(person.id);
    setError("");

    try {
      const updated =
        await setAdminUserActive(
          person.id,
          next,
        );

      setUsers(
        (current) =>
          current.map(
            (item) =>
              item.id ===
              updated.id
                ? {
                    ...item,
                    ...updated,
                  }
                : item,
          ),
      );

      setSelected(
        (current) =>
          current?.id ===
          updated.id
            ? updated
            : current,
      );

      setMessage(
        next
          ? "User reactivated."
          : "User deactivated. The account remains in the database.",
      );
    } catch (reason) {
      setError(
        reason instanceof
          Error
          ? reason.message
          : "Unable to change account status.",
      );
    } finally {
      setBusyId(null);
    }
  }

  async function permanentlyDelete(
    person: AdminUser,
  ) {
    if (!canPermanentDelete) {
      return;
    }

    if (
      !window.confirm(
        `Permanently delete ${person.firstName} ${person.lastName}?\n\nThis action cannot be undone. If the server requires higher authority, a deletion approval request will be created instead.`,
      )
    ) {
      return;
    }

    const reason =
      window
        .prompt(
          "Optional reason for permanent deletion:",
          "",
        )
        ?.trim() ||
      undefined;

    setBusyId(person.id);
    setError("");

    try {
      const result =
        await requestAdminUserPermanentDeletion(
          person.id,
          reason,
        );

      if (
        result.permanentlyDeleted
      ) {
        setUsers(
          (current) =>
            current.filter(
              (item) =>
                item.id !==
                person.id,
            ),
        );

        setRequests(
          (current) =>
            current.filter(
              (request) =>
                request.targetUserId !==
                person.id,
            ),
        );

        setSelected(null);
      } else {
        setRequests(
          await listAdminUserDeletionRequests(),
        );

        setSelected(null);
      }

      setMessage(
        result.message ||
          (result.permanentlyDeleted
            ? "User permanently deleted."
            : "Permanent deletion request submitted for approval."),
      );
    } catch (reason) {
      setError(
        reason instanceof
          Error
          ? reason.message
          : "Unable to process permanent deletion.",
      );
    } finally {
      setBusyId(null);
    }
  }

  async function reviewRequest(
    request: UserDeletionRequest,
    action:
      | "approve"
      | "reject",
  ) {
    if (!request.canApprove) {
      return;
    }

    const label =
      action === "approve"
        ? "approve permanent deletion of"
        : "reject permanent deletion of";

    if (
      !window.confirm(
        `Are you sure you want to ${label} ${request.targetUser.firstName} ${request.targetUser.lastName}?`,
      )
    ) {
      return;
    }

    setApprovalId(
      request.id,
    );

    setError("");

    try {
      if (
        action === "approve"
      ) {
        await approveAdminUserDeletionRequest(
          request.id,
        );

        setUsers(
          (current) =>
            current.filter(
              (item) =>
                item.id !==
                request.targetUserId,
            ),
        );

        if (
          selected?.id ===
          request.targetUserId
        ) {
          setSelected(null);
        }
      } else {
        await rejectAdminUserDeletionRequest(
          request.id,
        );
      }

      setRequests(
        await listAdminUserDeletionRequests(),
      );

      setMessage(
        action === "approve"
          ? "Permanent deletion approved."
          : "Permanent deletion request rejected.",
      );
    } catch (reason) {
      setError(
        reason instanceof
          Error
          ? reason.message
          : "Unable to review the deletion request.",
      );
    } finally {
      setApprovalId(null);
    }
  }

  async function savePerson(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canUpdate || !selected) {
      return;
    }

    setSavingEdit(true);
    setError("");
    setMessage("");

    try {
      const form = new FormData(event.currentTarget);
      const role = String(form.get("role") || "").toUpperCase();
      const departmentId = String(form.get("departmentId") || "").trim();

      const departmentIds =
        role === "HOD"
          ? departmentId
            ? [departmentId]
            : []
          : [];

      if (role === "HOD" && departmentIds.length !== 1) {
        throw new Error("Select the department assigned to this HOD.");
      }

      const updated = await updateAdminUser(selected.id, {
        firstName: String(form.get("firstName") || "").trim(),
        lastName: String(form.get("lastName") || "").trim(),
        email: String(form.get("email") || "").trim(),
        phone: String(form.get("phone") || "").trim(),
        role,
        departmentIds,
      });

      setUsers((current) =>
        current.map((person) =>
          person.id === updated.id ? updated : person,
        ),
      );
      setSelected(updated);
      setEditing(false);
      setMessage("User details updated successfully.");
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Unable to update the user.",
      );
    } finally {
      setSavingEdit(false);
    }
  }

  async function createPerson(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!canCreate) {
      return;
    }

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
          role as
            (typeof CREATION_ROLES)[number],
        )
      ) {
        throw new Error(
          "Select a valid institutional role.",
        );
      }

      const departmentId = String(form.get("departmentId") || "").trim();

      if (role === "HOD" && !departmentId) {
        throw new Error(
          "Select the department assigned to this HOD.",
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
          departmentIds:
            role === "HOD"
              ? [String(form.get("departmentId") || "").trim()].filter(Boolean)
              : [],
        });

      setUsers(
        (current) => [
          created,
          ...current,
        ],
      );

      setSelected(created);
      setShowCreate(false);

      event.currentTarget.reset();

      setMessage(
        "User account created successfully.",
      );
    } catch (reason) {
      setError(
        reason instanceof
          Error
          ? reason.message
          : "Unable to create the account.",
      );
    } finally {
      setCreating(false);
    }
  }

  if (!user) {
    return (
      <div className="rounded-[30px] border border-slate-200 bg-white p-8 text-sm text-slate-500">
        Loading authorization…
      </div>
    );
  }

  if (!canRead) {
    return (
      <div className="rounded-[30px] border border-amber-200 bg-amber-50 p-8">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-700">
          Access restricted
        </p>

        <h1 className="mt-2 text-2xl font-black text-slate-950">
          Users
        </h1>

        <p className="mt-2 text-sm leading-6 text-slate-600">
          Your authenticated account does not
          have{" "}
          <code>users.read</code>{" "}
          permission for this workspace.
        </p>
      </div>
    );
  }

  const pendingApprovals =
    requests.filter(
      (request) =>
        request.canApprove &&
        request.status ===
          "PENDING",
    );

  const pageTitle =
    category
      ? CATEGORIES.find(
          (item) =>
            item.key ===
            category,
        )?.label ||
        "People"
      : "People";

  return (
    <div className="mx-auto max-w-[1320px] space-y-6 pb-10">
      {error ? (
        <div className="flex items-center justify-between gap-3 rounded-[20px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>{error}</span>

          <button
            type="button"
            onClick={() =>
              void loadPeople()
            }
            className="rounded-xl bg-red-700 px-3 py-2 text-xs font-bold text-white"
          >
            Retry
          </button>
        </div>
      ) : null}

      {message ? (
        <div className="flex items-center justify-between gap-3 rounded-[20px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          <span>{message}</span>

          <button
            type="button"
            onClick={() =>
              setMessage("")
            }
            className="font-bold"
          >
            Dismiss
          </button>
        </div>
      ) : null}

      {pendingApprovals.length ? (
        <section className="rounded-[26px] border border-amber-200 bg-amber-50 p-5 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-700">
                DELETION APPROVALS
              </p>

              <h2 className="mt-1 text-xl font-black text-slate-950">
                Permanent deletion requests
              </h2>

              <p className="mt-1 text-sm text-slate-600">
                Only requests for which your
                authenticated account has approval
                authority are shown.
              </p>
            </div>

            <span className="rounded-full bg-white px-3 py-1.5 text-xs font-black text-amber-700">
              {pendingApprovals.length}{" "}
              pending
            </span>
          </div>

          <div className="mt-4 space-y-3">
            {pendingApprovals.map(
              (request) => (
                <div
                  key={request.id}
                  className="rounded-[20px] border border-amber-200 bg-white p-4"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <p className="font-extrabold text-slate-950">
                        {
                          request
                            .targetUser
                            .firstName
                        }{" "}
                        {
                          request
                            .targetUser
                            .lastName
                        }
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        {
                          request
                            .targetUser
                            .email
                        }{" "}
                        ·{" "}
                        {roleLabel(
                          request
                            .targetUser
                            .role,
                        )}
                      </p>

                      <p className="mt-2 text-xs text-slate-500">
                        Requested by{" "}
                        <span className="font-bold text-slate-700">
                          {
                            request
                              .requester
                              .firstName
                          }{" "}
                          {
                            request
                              .requester
                              .lastName
                          }
                        </span>{" "}
                        ·{" "}
                        {formatDate(
                          request.createdAt,
                        )}
                      </p>

                      {request.reason ? (
                        <p className="mt-2 text-sm text-slate-600">
                          Reason:{" "}
                          {request.reason}
                        </p>
                      ) : null}
                    </div>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          void reviewRequest(
                            request,
                            "reject",
                          )
                        }
                        disabled={
                          approvalId ===
                          request.id
                        }
                        className="rounded-[13px] border border-slate-200 bg-white px-4 py-2.5 text-xs font-extrabold text-slate-700 disabled:opacity-50"
                      >
                        Reject
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          void reviewRequest(
                            request,
                            "approve",
                          )
                        }
                        disabled={
                          approvalId ===
                          request.id
                        }
                        className="rounded-[13px] bg-red-600 px-4 py-2.5 text-xs font-extrabold text-white disabled:opacity-50"
                      >
                        {approvalId ===
                        request.id
                          ? "Processing…"
                          : "Approve permanent delete"}
                      </button>
                    </div>
                  </div>
                </div>
              ),
            )}
          </div>
        </section>
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
              Choose a people category instead of
              loading one large institution-wide
              directory. All records remain scoped to
              the authenticated institution.
            </p>
          </section>

          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {CATEGORIES.map(
              (item) => (
                <Link
                  key={item.key}
                  href={
                    item.key ===
                    "students"
                      ? "/admin/students"
                      : `/admin/users?category=${item.key}`
                  }
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

          {canCreate &&
          canImport ? (
            <div className="rounded-[24px] border border-blue-100 bg-blue-50 p-5 text-sm text-blue-800">
              Bulk people import remains available
              through the dedicated import workflow when
              your account has{" "}
              <code>
                imports.manage
              </code>{" "}
              permission.
            </div>
          ) : null}

          {canCreate ? (
            <section className="flex flex-col gap-4 rounded-[24px] border border-slate-200 bg-[#f8fafc] p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                  ACCOUNT CONTROL
                </p>

                <h2 className="mt-1 text-lg font-black">
                  Add institution staff
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Create staff accounts only when the
                  authenticated user has{" "}
                  <code>
                    users.create
                  </code>{" "}
                  permission.
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setShowCreate(true)
                }
                className="rounded-[14px] bg-blue-600 px-4 py-2.5 text-sm font-extrabold text-white hover:bg-blue-700"
              >
                Add staff account
              </button>
            </section>
          ) : null}
        </>
      ) : (
        <>
          <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <Link
              href="/admin/users"
              className="text-xs font-extrabold text-blue-600"
            >
              ← All people
            </Link>

            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h1 className="text-2xl font-black">
                  {pageTitle}
                </h1>

                <p className="mt-1 text-sm text-slate-500">
                  {visible.length} matching account
                  {visible.length ===
                  1
                    ? ""
                    : "s"}
                </p>
              </div>

              <div className="flex gap-2">
                <input
                  value={query}
                  onChange={(event) =>
                    setQuery(
                      event.target.value,
                    )
                  }
                  placeholder="Search…"
                  className="w-full rounded-[14px] border border-slate-200 bg-[#f8fafc] px-4 py-2.5 text-sm outline-none focus:border-blue-400 sm:w-64"
                />

                {category !==
                  "students" &&
                category !==
                  "parents" &&
                canCreate ? (
                  <button
                    type="button"
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
              }).map(
                (_, index) => (
                  <div
                    key={index}
                    className="h-36 animate-pulse rounded-[22px] bg-white"
                  />
                ),
              )
            ) : visible.length ? (
              visible.map(
                (person) => (
                  <button
                    key={person.id}
                    type="button"
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
                        <p className="truncate font-black text-slate-950">
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

                        <div className="mt-3 flex items-center gap-2">
                          <span
                            className={`h-2.5 w-2.5 rounded-full ${
                              person.isActive
                                ? "bg-emerald-500"
                                : "bg-slate-300"
                            }`}
                          />

                          <span className="text-xs font-bold text-slate-500">
                            {person.isActive
                              ? "Active"
                              : "Inactive"}
                          </span>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-1.5">
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
                    {
                      selected.firstName
                    }{" "}
                    {
                      selected.lastName
                    }
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    {selected.email}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  setSelected(null)
                }
                className="grid h-10 w-10 place-items-center rounded-[14px] border border-slate-200"
              >
                ×
              </button>
            </div>

            <div className="grid gap-3 p-5 sm:grid-cols-2">
              <Info
                label="Email"
                value={
                  selected.email
                }
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

            <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 bg-white p-5">
              {canUpdate ? (
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="rounded-[13px] bg-blue-600 px-4 py-2.5 text-sm font-extrabold text-white"
                >
                  Edit user
                </button>
              ) : null}

              {canUpdate ? (
                <button
                  type="button"
                  onClick={() =>
                    void toggleActive(
                      selected,
                    )
                  }
                  disabled={
                    busyId ===
                    selected.id
                  }
                  className={`rounded-[13px] px-4 py-2.5 text-sm font-extrabold ${
                    selected.isActive
                      ? "border border-red-200 bg-red-50 text-red-700"
                      : "bg-emerald-600 text-white"
                  }`}
                >
                  {busyId ===
                  selected.id
                    ? "Saving…"
                    : selected.isActive
                      ? "Deactivate"
                      : "Reactivate"}
                </button>
              ) : null}

              {canPermanentDelete ? (
                <button
                  type="button"
                  onClick={() =>
                    void permanentlyDelete(
                      selected,
                    )
                  }
                  disabled={
                    busyId ===
                    selected.id
                  }
                  className="rounded-[13px] border border-red-300 bg-red-600 px-4 py-2.5 text-sm font-extrabold text-white disabled:opacity-50"
                >
                  {busyId ===
                  selected.id
                    ? "Processing…"
                    : "Permanent Delete"}
                </button>
              ) : null}

              <button
                type="button"
                onClick={() =>
                  setSelected(null)
                }
                className="rounded-[13px] border border-slate-200 bg-white px-4 py-2.5 text-sm font-extrabold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {editing && selected ? (
        <div className="fixed inset-0 z-[90] overflow-y-auto bg-slate-950/30 p-4 backdrop-blur-sm">
          <div className="mx-auto my-8 max-w-2xl rounded-[28px] bg-[#f8fafc] shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 bg-white p-6">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-600">
                  Edit user
                </p>
                <h2 className="mt-1 text-xl font-black">Update account</h2>
              </div>
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="grid h-10 w-10 place-items-center rounded-[14px] border border-slate-200"
              >
                ×
              </button>
            </div>

            <form onSubmit={savePerson} className="space-y-4 p-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <label>
                  <span className="mb-1.5 block text-xs font-bold text-slate-600">First name *</span>
                  <input name="firstName" defaultValue={selected.firstName} required className="w-full rounded-[13px] border border-slate-200 bg-white px-3.5 py-3 text-sm outline-none focus:border-blue-400" />
                </label>
                <label>
                  <span className="mb-1.5 block text-xs font-bold text-slate-600">Last name *</span>
                  <input name="lastName" defaultValue={selected.lastName} required className="w-full rounded-[13px] border border-slate-200 bg-white px-3.5 py-3 text-sm outline-none focus:border-blue-400" />
                </label>
                <label>
                  <span className="mb-1.5 block text-xs font-bold text-slate-600">Email *</span>
                  <input name="email" type="email" defaultValue={selected.email} required className="w-full rounded-[13px] border border-slate-200 bg-white px-3.5 py-3 text-sm outline-none focus:border-blue-400" />
                </label>
                <label>
                  <span className="mb-1.5 block text-xs font-bold text-slate-600">Phone</span>
                  <input name="phone" defaultValue={selected.phone || ""} className="w-full rounded-[13px] border border-slate-200 bg-white px-3.5 py-3 text-sm outline-none focus:border-blue-400" />
                </label>
                <label>
                  <span className="mb-1.5 block text-xs font-bold text-slate-600">Role *</span>
                  <select
                    name="role"
                    defaultValue={selected.roles[0]?.name || ""}
                    required
                    className="w-full rounded-[13px] border border-slate-200 bg-white px-3.5 py-3 text-sm outline-none focus:border-blue-400"
                  >
                    {CREATION_ROLES.map((role) => (
                      <option key={role} value={role}>{roleLabel(role)}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span className="mb-1.5 block text-xs font-bold text-slate-600">HOD department</span>
                  <select
                    name="departmentId"
                    defaultValue={selected.departmentAccesses?.[0]?.departmentId || ""}
                    className="w-full rounded-[13px] border border-slate-200 bg-white px-3.5 py-3 text-sm outline-none focus:border-blue-400"
                  >
                    <option value="">Select department</option>
                    {departments.map((department) => (
                      <option key={department.id} value={department.id}>
                        {department.code ? `${department.code} — ` : ""}{department.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="rounded-[16px] border border-blue-100 bg-blue-50 p-3 text-xs leading-5 text-blue-800">
                Department assignment is used for HOD data scoping. An HOD must have exactly one department. Changing the user away from HOD removes HOD department access.
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
                <button type="button" onClick={() => setEditing(false)} className="rounded-[13px] border border-slate-200 bg-white px-4 py-2.5 text-sm font-extrabold">Cancel</button>
                <button type="submit" disabled={savingEdit} className="rounded-[13px] bg-blue-600 px-5 py-2.5 text-sm font-extrabold text-white disabled:opacity-50">
                  {savingEdit ? "Saving…" : "Save changes"}
                </button>
              </div>
            </form>
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
                type="button"
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
                    defaultValue="FACULTY"
                    className="w-full rounded-[13px] border border-slate-200 bg-white px-3.5 py-3 text-sm outline-none focus:border-blue-400"
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
                          {roleLabel(role)}
                        </option>
                      ),
                    )}
                  </select>
                </label>

                <label>
                  <span className="mb-1.5 block text-xs font-bold text-slate-600">HOD department</span>
                  <select
                    name="departmentId"
                    className="w-full rounded-[13px] border border-slate-200 bg-white px-3.5 py-3 text-sm outline-none focus:border-blue-400"
                    defaultValue=""
                  >
                    <option value="">Select department for HOD</option>
                    {departments.map((department) => (
                      <option key={department.id} value={department.id}>
                        {department.code ? `${department.code} — ` : ""}{department.name}
                      </option>
                    ))}
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
                  type="submit"
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
    </div>
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


export function AdminPeopleManager() {
  return (
    <DashboardShell
      title="People & Users"
      subtitle="Institution-scoped administration"
      allowedRoles={["INSTITUTION_ADMIN"]}
    >
      <AdminPeopleManagerContent />
    </DashboardShell>
  );
}
