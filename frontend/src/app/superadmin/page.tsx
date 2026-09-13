"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AuthRequiredError,
  authedFetch,
  clearTokens,
  getAccessToken,
  getCurrentUser,
} from "@/lib/auth";

type Institution = {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  isActive: boolean;
  createdAt: string;
  _count: {
    users: number;
    departments: number;
    programs: number;
    studentEnrollments: number;
  };
};

type PlatformStats = {
  institutions: number;
  activeInstitutions: number;
  users: number;
  activeUsers: number;
  students: number;
  faculty: number;
  departments: number;
};

type PlatformUser = {
  id: string;
  institutionId: string | null;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  institution: {
    id: string;
    name: string;
    slug: string;
  } | null;
  roles: {
    id: string;
    name: string;
  }[];
};

type InstitutionResponse = {
  success: true;
  data: Institution[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

type StatsResponse = {
  success: true;
  data: PlatformStats;
};

type UsersResponse = {
  success: true;
  data: PlatformUser[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

type InstitutionForm = {
  name: string;
  slug: string;
  primaryColor: string;
  secondaryColor: string;
  adminFirstName: string;
  adminLastName: string;
  adminEmail: string;
  adminPhone: string;
  adminPassword: string;
};

type UserForm = {
  institutionId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
  role: string;
};

const emptyInstitutionForm: InstitutionForm = {
  name: "",
  slug: "",
  primaryColor: "#0f172a",
  secondaryColor: "#64748b",
  adminFirstName: "",
  adminLastName: "",
  adminEmail: "",
  adminPhone: "",
  adminPassword: "",
};

const emptyUserForm: UserForm = {
  institutionId: "",
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  password: "",
  role: "INSTITUTION_ADMIN",
};

function formatDate(value: string | null) {
  if (!value) return "Never";

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
  }).format(new Date(value));
}

function StatCard({
  label,
  value,
  description,
}: {
  label: string;
  value: number;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
        {value.toLocaleString("en-IN")}
      </p>
      <p className="mt-1 text-xs text-slate-500">{description}</p>
    </div>
  );
}

function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="sticky top-0 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-950">{title}</h2>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          >
            Close
          </button>
        </div>

        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

export default function SuperAdminPage() {
  const router = useRouter();

  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [users, setUsers] = useState<PlatformUser[]>([]);

  const [search, setSearch] = useState("");
  const [userSearch, setUserSearch] = useState("");

  const [activeSection, setActiveSection] = useState<
    "overview" | "institutions" | "users"
  >("overview");

  const [showInstitutionModal, setShowInstitutionModal] =
    useState(false);

  const [showUserModal, setShowUserModal] = useState(false);

  const [institutionForm, setInstitutionForm] =
    useState<InstitutionForm>(emptyInstitutionForm);

  const [userForm, setUserForm] =
    useState<UserForm>(emptyUserForm);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const filteredInstitutions = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return institutions;

    return institutions.filter(
      (institution) =>
        institution.name.toLowerCase().includes(query) ||
        institution.slug.toLowerCase().includes(query)
    );
  }, [institutions, search]);

  const filteredUsers = useMemo(() => {
    const query = userSearch.trim().toLowerCase();

    if (!query) return users;

    return users.filter((user) => {
      const fullName =
        `${user.firstName} ${user.lastName}`.toLowerCase();

      const institution =
        user.institution?.name.toLowerCase() || "";

      return (
        fullName.includes(query) ||
        user.email.toLowerCase().includes(query) ||
        institution.includes(query)
      );
    });
  }, [users, userSearch]);

  async function loadAll() {
    setLoading(true);
    setError(null);

    try {
      if (!getAccessToken()) {
        router.replace("/login");
        return;
      }

      const currentUser = await getCurrentUser();
      if (!currentUser.roles.includes("SUPER_ADMIN")) {
        router.replace("/login");
        return;
      }

      const [statsResponse, institutionsResponse, usersResponse] =
        await Promise.all([
          authedFetch<StatsResponse>("/institutions/stats"),

          authedFetch<InstitutionResponse>(
            "/institutions?page=1&pageSize=100"
          ),

          authedFetch<UsersResponse>(
            "/users?page=1&pageSize=100"
          ),
        ]);

      setStats(statsResponse.data);
      setInstitutions(institutionsResponse.data);
      setUsers(usersResponse.data);
    } catch (err) {
      if (err instanceof AuthRequiredError) {
        clearTokens();
        router.replace("/login");
        return;
      }

      setError(
        err instanceof Error
          ? err.message
          : "Unable to load platform data."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAll();
  }, []);

  async function handleCreateInstitution(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      await authedFetch("/institutions", {
        method: "POST",
        body: JSON.stringify({
          name: institutionForm.name,
          slug: institutionForm.slug,
          primaryColor: institutionForm.primaryColor,
          secondaryColor: institutionForm.secondaryColor,
          admin: {
            firstName: institutionForm.adminFirstName,
            lastName: institutionForm.adminLastName,
            email: institutionForm.adminEmail,
            phone: institutionForm.adminPhone,
            password: institutionForm.adminPassword,
          },
        }),
      });

      setShowInstitutionModal(false);
      setInstitutionForm(emptyInstitutionForm);

      setMessage(
        "Institution created successfully with its Institution Admin."
      );

      await loadAll();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to create institution."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      await authedFetch("/users", {
        method: "POST",
        body: JSON.stringify({
          institutionId: userForm.institutionId || null,
          firstName: userForm.firstName,
          lastName: userForm.lastName,
          email: userForm.email,
          phone: userForm.phone,
          password: userForm.password,
          role: userForm.role,
        }),
      });

      setShowUserModal(false);
      setUserForm(emptyUserForm);

      setMessage("User created successfully.");

      await loadAll();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to create user."
      );
    } finally {
      setSaving(false);
    }
  }

  async function toggleInstitution(institution: Institution) {
    setError(null);
    setMessage(null);

    try {
      await authedFetch(`/institutions/${institution.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({
          isActive: !institution.isActive,
        }),
      });

      setMessage(
        `${institution.name} is now ${
          institution.isActive ? "inactive" : "active"
        }.`
      );

      await loadAll();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to update institution."
      );
    }
  }

  async function toggleUser(user: PlatformUser) {
    setError(null);
    setMessage(null);

    try {
      await authedFetch(`/users/${user.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({
          isActive: !user.isActive,
        }),
      });

      setMessage(
        `${user.firstName} ${user.lastName} is now ${
          user.isActive ? "inactive" : "active"
        }.`
      );

      await loadAll();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to update user."
      );
    }
  }

  async function handleLogout() {
    clearTokens();
    router.replace("/login");
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50">
        <div className="mx-auto max-w-7xl px-6 py-10">
          <div className="h-8 w-64 animate-pulse rounded bg-slate-200" />
          <div className="mt-8 grid gap-4 md:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="h-32 animate-pulse rounded-2xl bg-white"
              />
            ))}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              ACADLYX
            </p>

            <h1 className="mt-1 text-xl font-semibold text-slate-950">
              Platform Administration
            </h1>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Sign out
          </button>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl gap-6 px-6 py-8">
        <aside className="hidden w-56 shrink-0 md:block">
          <nav className="sticky top-6 space-y-1">
            {[
              ["overview", "Overview"],
              ["institutions", "Institutions"],
              ["users", "Platform Users"],
            ].map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() =>
                  setActiveSection(
                    key as "overview" | "institutions" | "users"
                  )
                }
                className={`w-full rounded-xl px-4 py-2.5 text-left text-sm font-medium transition ${
                  activeSection === key
                    ? "bg-slate-950 text-white"
                    : "text-slate-600 hover:bg-white hover:text-slate-950"
                }`}
              >
                {label}
              </button>
            ))}
          </nav>
        </aside>

        <section className="min-w-0 flex-1">
          <div className="mb-6 md:hidden">
            <select
              value={activeSection}
              onChange={(event) =>
                setActiveSection(
                  event.target.value as
                    | "overview"
                    | "institutions"
                    | "users"
                )
              }
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm"
            >
              <option value="overview">Overview</option>
              <option value="institutions">Institutions</option>
              <option value="users">Platform Users</option>
            </select>
          </div>

          {error && (
            <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {message && (
            <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {message}
            </div>
          )}

          {activeSection === "overview" && (
            <>
              <div className="mb-6">
                <h2 className="text-2xl font-semibold text-slate-950">
                  Platform overview
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Manage institutions, users, and the ACADLYX platform.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard
                  label="Institutions"
                  value={stats?.institutions ?? 0}
                  description={`${stats?.activeInstitutions ?? 0} active`}
                />

                <StatCard
                  label="Users"
                  value={stats?.users ?? 0}
                  description={`${stats?.activeUsers ?? 0} active`}
                />

                <StatCard
                  label="Students"
                  value={stats?.students ?? 0}
                  description="Across all institutions"
                />

                <StatCard
                  label="Faculty"
                  value={stats?.faculty ?? 0}
                  description="Across all institutions"
                />
              </div>

              <div className="mt-6 grid gap-4 lg:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <h3 className="font-semibold text-slate-950">
                    Institutions
                  </h3>

                  <p className="mt-1 text-sm text-slate-500">
                    Create and manage institution tenants.
                  </p>

                  <button
                    type="button"
                    onClick={() => {
                      setInstitutionForm(emptyInstitutionForm);
                      setShowInstitutionModal(true);
                    }}
                    className="mt-5 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
                  >
                    + Add institution
                  </button>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <h3 className="font-semibold text-slate-950">
                    Platform users
                  </h3>

                  <p className="mt-1 text-sm text-slate-500">
                    Manage administrators and platform accounts.
                  </p>

                  <button
                    type="button"
                    onClick={() => {
                      setUserForm(emptyUserForm);
                      setShowUserModal(true);
                    }}
                    className="mt-5 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
                  >
                    + Add user
                  </button>
                </div>
              </div>
            </>
          )}

          {activeSection === "institutions" && (
            <>
              <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
                <div>
                  <h2 className="text-2xl font-semibold text-slate-950">
                    Institutions
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    Every institution is an isolated ACADLYX tenant.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setInstitutionForm(emptyInstitutionForm);
                    setShowInstitutionModal(true);
                  }}
                  className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
                >
                  + Add institution
                </button>
              </div>

              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search institutions..."
                className="mb-4 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-slate-500"
              />

              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[850px] text-sm">
                    <thead className="border-b border-slate-200 bg-slate-50">
                      <tr>
                        <th className="px-5 py-3 text-left font-medium text-slate-500">
                          Institution
                        </th>
                        <th className="px-5 py-3 text-left font-medium text-slate-500">
                          Users
                        </th>
                        <th className="px-5 py-3 text-left font-medium text-slate-500">
                          Students
                        </th>
                        <th className="px-5 py-3 text-left font-medium text-slate-500">
                          Departments
                        </th>
                        <th className="px-5 py-3 text-left font-medium text-slate-500">
                          Status
                        </th>
                        <th className="px-5 py-3 text-right font-medium text-slate-500">
                          Action
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {filteredInstitutions.map((institution) => (
                        <tr
                          key={institution.id}
                          className="border-b border-slate-100 last:border-0"
                        >
                          <td className="px-5 py-4">
                            <p className="font-medium text-slate-950">
                              {institution.name}
                            </p>

                            <p className="mt-0.5 text-xs text-slate-500">
                              {institution.slug}
                            </p>
                          </td>

                          <td className="px-5 py-4 text-slate-700">
                            {institution._count.users}
                          </td>

                          <td className="px-5 py-4 text-slate-700">
                            {institution._count.studentEnrollments}
                          </td>

                          <td className="px-5 py-4 text-slate-700">
                            {institution._count.departments}
                          </td>

                          <td className="px-5 py-4">
                            <span
                              className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                                institution.isActive
                                  ? "bg-emerald-50 text-emerald-700"
                                  : "bg-slate-100 text-slate-500"
                              }`}
                            >
                              {institution.isActive
                                ? "Active"
                                : "Inactive"}
                            </span>
                          </td>

                          <td className="px-5 py-4 text-right">
                            <button
                              type="button"
                              onClick={() =>
                                toggleInstitution(institution)
                              }
                              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                            >
                              {institution.isActive
                                ? "Deactivate"
                                : "Activate"}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {filteredInstitutions.length === 0 && (
                  <div className="px-6 py-12 text-center">
                    <p className="font-medium text-slate-900">
                      No institutions found
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      Create your first institution to begin.
                    </p>
                  </div>
                )}
              </div>
            </>
          )}

          {activeSection === "users" && (
            <>
              <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
                <div>
                  <h2 className="text-2xl font-semibold text-slate-950">
                    Platform users
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    Manage accounts across the ACADLYX platform.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setUserForm(emptyUserForm);
                    setShowUserModal(true);
                  }}
                  className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
                >
                  + Add user
                </button>
              </div>

              <input
                value={userSearch}
                onChange={(event) => setUserSearch(event.target.value)}
                placeholder="Search users..."
                className="mb-4 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-slate-500"
              />

              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[900px] text-sm">
                    <thead className="border-b border-slate-200 bg-slate-50">
                      <tr>
                        <th className="px-5 py-3 text-left font-medium text-slate-500">
                          User
                        </th>
                        <th className="px-5 py-3 text-left font-medium text-slate-500">
                          Institution
                        </th>
                        <th className="px-5 py-3 text-left font-medium text-slate-500">
                          Role
                        </th>
                        <th className="px-5 py-3 text-left font-medium text-slate-500">
                          Last login
                        </th>
                        <th className="px-5 py-3 text-left font-medium text-slate-500">
                          Status
                        </th>
                        <th className="px-5 py-3 text-right font-medium text-slate-500">
                          Action
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {filteredUsers.map((user) => (
                        <tr
                          key={user.id}
                          className="border-b border-slate-100 last:border-0"
                        >
                          <td className="px-5 py-4">
                            <p className="font-medium text-slate-950">
                              {user.firstName} {user.lastName}
                            </p>

                            <p className="mt-0.5 text-xs text-slate-500">
                              {user.email}
                            </p>
                          </td>

                          <td className="px-5 py-4 text-slate-700">
                            {user.institution?.name || "Platform"}
                          </td>

                          <td className="px-5 py-4">
                            <div className="flex flex-wrap gap-1">
                              {user.roles.map((role) => (
                                <span
                                  key={role.id}
                                  className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700"
                                >
                                  {role.name}
                                </span>
                              ))}
                            </div>
                          </td>

                          <td className="px-5 py-4 text-slate-600">
                            {formatDate(user.lastLoginAt)}
                          </td>

                          <td className="px-5 py-4">
                            <span
                              className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                                user.isActive
                                  ? "bg-emerald-50 text-emerald-700"
                                  : "bg-slate-100 text-slate-500"
                              }`}
                            >
                              {user.isActive
                                ? "Active"
                                : "Inactive"}
                            </span>
                          </td>

                          <td className="px-5 py-4 text-right">
                            <button
                              type="button"
                              onClick={() => toggleUser(user)}
                              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                            >
                              {user.isActive
                                ? "Deactivate"
                                : "Activate"}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {filteredUsers.length === 0 && (
                  <div className="px-6 py-12 text-center">
                    <p className="font-medium text-slate-900">
                      No users found
                    </p>
                  </div>
                )}
              </div>
            </>
          )}
        </section>
      </div>

      {showInstitutionModal && (
        <Modal
          title="Create institution"
          onClose={() => {
            if (!saving) setShowInstitutionModal(false);
          }}
        >
          <form
            onSubmit={handleCreateInstitution}
            className="space-y-6"
          >
            <div>
              <h3 className="mb-3 text-sm font-semibold text-slate-950">
                Institution
              </h3>

              <div className="grid gap-4 sm:grid-cols-2">
                <input
                  required
                  value={institutionForm.name}
                  onChange={(event) =>
                    setInstitutionForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  placeholder="Institution name"
                  className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
                />

                <input
                  required
                  value={institutionForm.slug}
                  onChange={(event) =>
                    setInstitutionForm((current) => ({
                      ...current,
                      slug: event.target.value
                        .toLowerCase()
                        .replace(/\s+/g, "-"),
                    }))
                  }
                  placeholder="institution-slug"
                  className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
                />

                <input
                  value={institutionForm.primaryColor}
                  onChange={(event) =>
                    setInstitutionForm((current) => ({
                      ...current,
                      primaryColor: event.target.value,
                    }))
                  }
                  placeholder="#0f172a"
                  className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
                />

                <input
                  value={institutionForm.secondaryColor}
                  onChange={(event) =>
                    setInstitutionForm((current) => ({
                      ...current,
                      secondaryColor: event.target.value,
                    }))
                  }
                  placeholder="#64748b"
                  className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
                />
              </div>
            </div>

            <div>
              <h3 className="mb-3 text-sm font-semibold text-slate-950">
                Institution administrator
              </h3>

              <div className="grid gap-4 sm:grid-cols-2">
                <input
                  required
                  value={institutionForm.adminFirstName}
                  onChange={(event) =>
                    setInstitutionForm((current) => ({
                      ...current,
                      adminFirstName: event.target.value,
                    }))
                  }
                  placeholder="First name"
                  className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
                />

                <input
                  required
                  value={institutionForm.adminLastName}
                  onChange={(event) =>
                    setInstitutionForm((current) => ({
                      ...current,
                      adminLastName: event.target.value,
                    }))
                  }
                  placeholder="Last name"
                  className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
                />

                <input
                  required
                  type="email"
                  value={institutionForm.adminEmail}
                  onChange={(event) =>
                    setInstitutionForm((current) => ({
                      ...current,
                      adminEmail: event.target.value,
                    }))
                  }
                  placeholder="admin@institution.edu"
                  className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
                />

                <input
                  value={institutionForm.adminPhone}
                  onChange={(event) =>
                    setInstitutionForm((current) => ({
                      ...current,
                      adminPhone: event.target.value,
                    }))
                  }
                  placeholder="Phone"
                  className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
                />

                <input
                  required
                  type="password"
                  minLength={8}
                  value={institutionForm.adminPassword}
                  onChange={(event) =>
                    setInstitutionForm((current) => ({
                      ...current,
                      adminPassword: event.target.value,
                    }))
                  }
                  placeholder="Temporary password"
                  className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm sm:col-span-2"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-200 pt-5">
              <button
                type="button"
                disabled={saving}
                onClick={() => setShowInstitutionModal(false)}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                {saving ? "Creating..." : "Create institution"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {showUserModal && (
        <Modal
          title="Create platform user"
          onClose={() => {
            if (!saving) setShowUserModal(false);
          }}
        >
          <form onSubmit={handleCreateUser} className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <input
                required
                value={userForm.firstName}
                onChange={(event) =>
                  setUserForm((current) => ({
                    ...current,
                    firstName: event.target.value,
                  }))
                }
                placeholder="First name"
                className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
              />

              <input
                required
                value={userForm.lastName}
                onChange={(event) =>
                  setUserForm((current) => ({
                    ...current,
                    lastName: event.target.value,
                  }))
                }
                placeholder="Last name"
                className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
              />

              <input
                required
                type="email"
                value={userForm.email}
                onChange={(event) =>
                  setUserForm((current) => ({
                    ...current,
                    email: event.target.value,
                  }))
                }
                placeholder="Email"
                className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
              />

              <input
                value={userForm.phone}
                onChange={(event) =>
                  setUserForm((current) => ({
                    ...current,
                    phone: event.target.value,
                  }))
                }
                placeholder="Phone"
                className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
              />

              <select
                value={userForm.institutionId}
                onChange={(event) =>
                  setUserForm((current) => ({
                    ...current,
                    institutionId: event.target.value,
                  }))
                }
                className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm"
              >
                <option value="">Platform user</option>

                {institutions
                  .filter((institution) => institution.isActive)
                  .map((institution) => (
                    <option
                      key={institution.id}
                      value={institution.id}
                    >
                      {institution.name}
                    </option>
                  ))}
              </select>

              <select
                value={userForm.role}
                onChange={(event) =>
                  setUserForm((current) => ({
                    ...current,
                    role: event.target.value,
                  }))
                }
                className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm"
              >
                {!userForm.institutionId && (
                  <option value="SUPER_ADMIN">
                    SUPER_ADMIN
                  </option>
                )}

                {userForm.institutionId && (
                  <>
                    <option value="INSTITUTION_ADMIN">
                      INSTITUTION_ADMIN
                    </option>
                    <option value="DIRECTOR">DIRECTOR</option>
                    <option value="MANAGEMENT">MANAGEMENT</option>
                    <option value="HOD">HOD</option>
                    <option value="FACULTY">FACULTY</option>
                    <option value="STAFF">STAFF</option>
                    <option value="STUDENT">STUDENT</option>
                    <option value="PARENT">PARENT</option>
                  </>
                )}
              </select>

              <input
                required
                type="password"
                minLength={8}
                value={userForm.password}
                onChange={(event) =>
                  setUserForm((current) => ({
                    ...current,
                    password: event.target.value,
                  }))
                }
                placeholder="Password"
                className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm sm:col-span-2"
              />
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-200 pt-5">
              <button
                type="button"
                disabled={saving}
                onClick={() => setShowUserModal(false)}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                {saving ? "Creating..." : "Create user"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </main>
  );
}
