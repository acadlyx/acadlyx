"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
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

type TenantEntitlements = {
  id: string;
  plan: string;
  status: string;
  expiresAt: string | null;
  renewsAt: string | null;
  studentLimit: number | null;
  userLimit: number | null;
  facultyLimit: number | null;
  storageLimitMb: number | null;
  entitlements: {
    featureKey: string;
    isEnabled: boolean;
    limitValue: number | null;
  }[];
  usage: {
    users: number;
    students: number;
    faculty: number;
    storageMb: number | null;
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
  role: "SUPER_ADMIN",
};

const assignableRoles = [
  { value: "SUPER_ADMIN", label: "Super Admin" },
  { value: "INSTITUTION_ADMIN", label: "Institution Admin" },
  { value: "CMS", label: "Website CMS Manager" },
] as const;

function formatDate(value: string | null) {
  if (!value) return "Never";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
  }).format(date);
}

function formatDateTime(value: string | null) {
  if (!value) return "Never";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-slate-200 bg-white shadow-2xl">
        <div className="sticky top-0 flex items-center justify-between border-b border-slate-200 bg-white/95 px-6 py-4 backdrop-blur">
          <h2 className="text-lg font-semibold text-slate-950">
            {title}
          </h2>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-3 py-2 text-sm font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
          >
            Close
          </button>
        </div>

        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

function ErrorPanel({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-red-800">
            Unable to load platform data
          </p>

          <p className="mt-1 text-sm text-red-700">
            {message}
          </p>
        </div>

        <button
          type="button"
          onClick={onRetry}
          className="shrink-0 rounded-xl bg-red-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-800"
        >
          Retry
        </button>
      </div>
    </div>
  );
}

export default function SuperAdminPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [users, setUsers] = useState<PlatformUser[]>([]);

  const [search, setSearch] = useState("");
  const [userSearch, setUserSearch] = useState("");

  const [activeSection, setActiveSection] = useState<
    "overview" | "institutions" | "users"
  >(() => searchParams.get("section") === "institutions" ? "institutions" : searchParams.get("section") === "users" ? "users" : "overview");

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

  const [selectedTenant, setSelectedTenant] =
    useState<Institution | null>(null);

  const [tenantEntitlements, setTenantEntitlements] =
    useState<TenantEntitlements | null>(null);

  const [entitlementReason, setEntitlementReason] =
    useState("");

  const filteredInstitutions = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return institutions;
    }

    return institutions.filter(
      (institution) =>
        institution.name.toLowerCase().includes(query) ||
        institution.slug.toLowerCase().includes(query)
    );
  }, [institutions, search]);

  const filteredUsers = useMemo(() => {
    const query = userSearch.trim().toLowerCase();

    if (!query) {
      return users;
    }

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
      const token = getAccessToken();

      if (!token) {
        router.replace("/login");
        return;
      }

      /*
       * SUPER_ADMIN is deliberately platform-level.
       *
       * It must have institutionId === null. We therefore never
       * require an institution scope on this page.
       */
      const currentUser = await getCurrentUser();

      if (!currentUser.roles.includes("SUPER_ADMIN")) {
        router.replace("/login");
        return;
      }

      /*
       * Platform endpoints are intentionally loaded separately.
       *
       * This prevents one tenant-scoped failure from being converted
       * into the generic "Unable to load platform data" state for the
       * whole platform console.
       */
      const [statsResult, institutionsResult] =
        await Promise.allSettled([
          authedFetch<StatsResponse>("/institutions/stats"),
          authedFetch<InstitutionResponse>(
            "/institutions?page=1&pageSize=100"
          ),
        ]);

      const failures: string[] = [];

      if (statsResult.status === "fulfilled") {
        setStats(statsResult.value.data);
      } else {
        failures.push(
          statsResult.reason instanceof Error
            ? `Platform statistics: ${statsResult.reason.message}`
            : "Platform statistics could not be loaded."
        );
      }

      if (institutionsResult.status === "fulfilled") {
        setInstitutions(institutionsResult.value.data);
      } else {
        failures.push(
          institutionsResult.reason instanceof Error
            ? `Institutions: ${institutionsResult.reason.message}`
            : "Institutions could not be loaded."
        );
      }

      if (failures.length > 0) {
        setError(failures.join(" • "));
      }
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

  useEffect(() => {
    const requested = searchParams.get("section");
    if (requested === "institutions" || requested === "users" || requested === "overview") setActiveSection(requested);
  }, [searchParams]);

  useEffect(() => {
    if (activeSection !== "users" || users.length) return;
    authedFetch<UsersResponse>("/users?page=1&pageSize=100").then((response) => setUsers(response.data)).catch((reason: Error) => setError(reason.message || "Users could not be loaded."));
  }, [activeSection, users.length]);

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
          name: institutionForm.name.trim(),
          slug: institutionForm.slug.trim(),
          primaryColor:
            institutionForm.primaryColor.trim(),
          secondaryColor:
            institutionForm.secondaryColor.trim(),
          admin: {
            firstName:
              institutionForm.adminFirstName.trim(),
            lastName:
              institutionForm.adminLastName.trim(),
            email:
              institutionForm.adminEmail.trim(),
            phone:
              institutionForm.adminPhone.trim() ||
              undefined,
            password:
              institutionForm.adminPassword,
          },
        }),
      });

      setShowInstitutionModal(false);
      setInstitutionForm({
        ...emptyInstitutionForm,
      });

      setMessage(
        "Institution created successfully with its Institution Admin."
      );

      await loadAll();
    } catch (err) {
      if (err instanceof AuthRequiredError) {
        clearTokens();
        router.replace("/login");
        return;
      }

      setError(
        err instanceof Error
          ? err.message
          : "Unable to create institution."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateUser(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (userForm.role !== "SUPER_ADMIN" && !userForm.institutionId) {
      setError("An institution is required for this role.");
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      await authedFetch("/users", {
        method: "POST",
        body: JSON.stringify({
          institutionId:
            userForm.institutionId || undefined,
          firstName: userForm.firstName.trim(),
          lastName: userForm.lastName.trim(),
          email: userForm.email.trim(),
          phone:
            userForm.phone.trim() || undefined,
          password: userForm.password,
          role: userForm.role,
        }),
      });

      setShowUserModal(false);
      setUserForm({
        ...emptyUserForm,
      });

      setMessage("Platform user created successfully.");

      await loadAll();
    } catch (err) {
      if (err instanceof AuthRequiredError) {
        clearTokens();
        router.replace("/login");
        return;
      }

      setError(
        err instanceof Error
          ? err.message
          : "Unable to create user."
      );
    } finally {
      setSaving(false);
    }
  }

  async function toggleInstitution(
    institution: Institution
  ) {
    setError(null);
    setMessage(null);

    try {
      await authedFetch(
        `/institutions/${institution.id}/status`,
        {
          method: "PATCH",
          body: JSON.stringify({
            isActive: !institution.isActive,
          }),
        }
      );

      setMessage(
        institution.isActive
          ? `${institution.name} has been deactivated.`
          : `${institution.name} has been activated.`
      );

      await loadAll();
    } catch (err) {
      if (err instanceof AuthRequiredError) {
        clearTokens();
        router.replace("/login");
        return;
      }

      setError(
        err instanceof Error
          ? err.message
          : "Unable to update institution status."
      );
    }
  }

  async function openEntitlements(
    institution: Institution
  ) {
    setSelectedTenant(institution);
    setTenantEntitlements(null);
    setEntitlementReason("");
    setError(null);

    try {
      const response =
        await authedFetch<{
          success: true;
          data: TenantEntitlements;
        }>(
          `/institutions/${institution.id}/entitlements`
        );

      setTenantEntitlements(response.data);
    } catch (err) {
      if (err instanceof AuthRequiredError) {
        clearTokens();
        router.replace("/login");
        return;
      }

      setError(
        err instanceof Error
          ? err.message
          : "Unable to load tenant entitlements."
      );
    }
  }

  async function saveEntitlements() {
    if (!selectedTenant || !tenantEntitlements) {
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      await authedFetch(
        `/institutions/${selectedTenant.id}/entitlements`,
        {
          method: "PUT",
          body: JSON.stringify({
            plan: tenantEntitlements.plan,
            status: tenantEntitlements.status,
            expiresAt:
              tenantEntitlements.expiresAt ||
              null,
            renewsAt:
              tenantEntitlements.renewsAt ||
              null,
            studentLimit:
              tenantEntitlements.studentLimit,
            userLimit:
              tenantEntitlements.userLimit,
            facultyLimit:
              tenantEntitlements.facultyLimit,
            storageLimitMb:
              tenantEntitlements.storageLimitMb,
            entitlements:
              tenantEntitlements.entitlements,
            reason:
              entitlementReason.trim() ||
              "Updated from Super Admin console",
          }),
        }
      );

      setMessage(
        `Entitlements updated for ${selectedTenant.name}.`
      );
    } catch (err) {
      if (err instanceof AuthRequiredError) {
        clearTokens();
        router.replace("/login");
        return;
      }

      setError(
        err instanceof Error
          ? err.message
          : "Unable to update tenant entitlements."
      );
    } finally {
      setSaving(false);
    }
  }

  function updateTenantField<K extends keyof TenantEntitlements>(
    field: K,
    value: TenantEntitlements[K]
  ) {
    setTenantEntitlements((current) =>
      current
        ? {
            ...current,
            [field]: value,
          }
        : current
    );
  }

  function updateFeature(
    featureKey: string,
    field:
      | "isEnabled"
      | "limitValue",
    value: boolean | number | null
  ) {
    setTenantEntitlements((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        entitlements:
          current.entitlements.map((feature) =>
            feature.featureKey === featureKey
              ? {
                  ...feature,
                  [field]: value,
                }
              : feature
          ),
      };
    });
  }

  if (loading) {
    return (
      <DashboardShell
        title="Platform Administration"
        subtitle="Global ACADLYX platform control"
        allowedRoles={["SUPER_ADMIN"]}
      >
        <div className="flex min-h-[55vh] items-center justify-center">
          <div className="rounded-2xl border border-slate-200 bg-white px-6 py-5 text-sm text-slate-500 shadow-sm">
            Loading platform data…
          </div>
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell
      title="Platform Administration"
      subtitle="Global ACADLYX platform control"
      allowedRoles={["SUPER_ADMIN"]}
    >
      <div className="min-h-full rounded-3xl bg-slate-50 pb-16">
        <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
          {error && (
            <ErrorPanel
              message={error}
              onRetry={() => {
                void loadAll();
              }}
            />
          )}

          {message && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-800">
              {message}
            </div>
          )}

          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                Platform control center
              </p>

              <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
                Super Admin
              </h1>

              <p className="mt-1 max-w-2xl text-sm text-slate-500">
                Manage institutions, platform users and tenant
                entitlements from one global workspace.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() =>
                  setShowInstitutionModal(true)
                }
                className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                New institution
              </button>

              <button
                type="button"
                onClick={() =>
                  setShowUserModal(true)
                }
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
              >
                New platform user
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
            {(
              [
                ["overview", "Overview"],
                ["institutions", "Institutions"],
                ["users", "Users"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => { setActiveSection(key); router.replace(key === "overview" ? "/superadmin" : `/superadmin?section=${key}`); }}
                className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                  activeSection === key
                    ? "bg-slate-950 text-white"
                    : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {activeSection === "overview" && (
            <>
              {stats ? (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <StatCard
                    label="Institutions"
                    value={stats.institutions}
                    description="Registered tenants"
                  />

                  <StatCard
                    label="Active institutions"
                    value={stats.activeInstitutions}
                    description="Currently enabled tenants"
                  />

                  <StatCard
                    label="Users"
                    value={stats.users}
                    description="Across the platform"
                  />

                  <StatCard
                    label="Students"
                    value={stats.students}
                    description="Across all institutions"
                  />
                </div>
              ) : (
                <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
                  Platform statistics are unavailable.
                </div>
              )}

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <p className="text-sm font-semibold text-slate-950">
                    Platform users
                  </p>

                  <p className="mt-1 text-sm text-slate-500">
                    Active accounts across every tenant.
                  </p>

                  <div className="mt-5 grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-slate-50 p-4">
                      <p className="text-xs font-medium text-slate-500">
                        Active
                      </p>

                      <p className="mt-1 text-2xl font-bold text-slate-950">
                        {stats?.activeUsers.toLocaleString(
                          "en-IN"
                        ) ?? "—"}
                      </p>
                    </div>

                    <div className="rounded-xl bg-slate-50 p-4">
                      <p className="text-xs font-medium text-slate-500">
                        Faculty
                      </p>

                      <p className="mt-1 text-2xl font-bold text-slate-950">
                        {stats?.faculty.toLocaleString(
                          "en-IN"
                        ) ?? "—"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <p className="text-sm font-semibold text-slate-950">
                    Academic structure
                  </p>

                  <p className="mt-1 text-sm text-slate-500">
                    Global counts across the platform.
                  </p>

                  <div className="mt-5 grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-slate-50 p-4">
                      <p className="text-xs font-medium text-slate-500">
                        Departments
                      </p>

                      <p className="mt-1 text-2xl font-bold text-slate-950">
                        {stats?.departments.toLocaleString(
                          "en-IN"
                        ) ?? "—"}
                      </p>
                    </div>

                    <div className="rounded-xl bg-slate-50 p-4">
                      <p className="text-xs font-medium text-slate-500">
                        Students
                      </p>

                      <p className="mt-1 text-2xl font-bold text-slate-950">
                        {stats?.students.toLocaleString(
                          "en-IN"
                        ) ?? "—"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {activeSection === "institutions" && (
            <section className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-950">
                    Institutions
                  </h2>

                  <p className="text-sm text-slate-500">
                    Manage all ACADLYX tenants.
                  </p>
                </div>

                <input
                  value={search}
                  onChange={(event) =>
                    setSearch(event.target.value)
                  }
                  placeholder="Search institutions…"
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100 sm:max-w-xs"
                />
              </div>

              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="overflow-x-auto">
                  <table className="min-w-[850px] w-full text-left text-sm">
                    <thead className="border-b border-slate-200 bg-slate-50">
                      <tr>
                        <th className="px-5 py-3 font-semibold text-slate-600">
                          Institution
                        </th>
                        <th className="px-5 py-3 font-semibold text-slate-600">
                          Users
                        </th>
                        <th className="px-5 py-3 font-semibold text-slate-600">
                          Students
                        </th>
                        <th className="px-5 py-3 font-semibold text-slate-600">
                          Status
                        </th>
                        <th className="px-5 py-3 text-right font-semibold text-slate-600">
                          Actions
                        </th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100">
                      {filteredInstitutions.map(
                        (institution) => (
                          <tr
                            key={institution.id}
                            className="transition hover:bg-slate-50/70"
                          >
                            <td className="px-5 py-4">
                              <div className="font-semibold text-slate-950">
                                {institution.name}
                              </div>

                              <div className="mt-0.5 text-xs text-slate-500">
                                {institution.slug}
                              </div>
                            </td>

                            <td className="px-5 py-4 text-slate-700">
                              {institution._count.users.toLocaleString(
                                "en-IN"
                              )}
                            </td>

                            <td className="px-5 py-4 text-slate-700">
                              {institution._count.studentEnrollments.toLocaleString(
                                "en-IN"
                              )}
                            </td>

                            <td className="px-5 py-4">
                              <span
                                className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                                  institution.isActive
                                    ? "bg-emerald-100 text-emerald-700"
                                    : "bg-slate-100 text-slate-500"
                                }`}
                              >
                                {institution.isActive
                                  ? "Active"
                                  : "Inactive"}
                              </span>
                            </td>

                            <td className="px-5 py-4">
                              <div className="flex justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    void openEntitlements(
                                      institution
                                    )
                                  }
                                  className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                                >
                                  Entitlements
                                </button>

                                <button
                                  type="button"
                                  onClick={() =>
                                    void toggleInstitution(
                                      institution
                                    )
                                  }
                                  className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${
                                    institution.isActive
                                      ? "bg-red-50 text-red-700 hover:bg-red-100"
                                      : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                  }`}
                                >
                                  {institution.isActive
                                    ? "Deactivate"
                                    : "Activate"}
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      )}

                      {filteredInstitutions.length ===
                        0 && (
                        <tr>
                          <td
                            colSpan={5}
                            className="px-5 py-10 text-center text-sm text-slate-400"
                          >
                            No institutions found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          )}

          {activeSection === "users" && (
            <section className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-950">
                    Platform users
                  </h2>

                  <p className="text-sm text-slate-500">
                    Global user directory across all tenants.
                  </p>
                </div>

                <input
                  value={userSearch}
                  onChange={(event) =>
                    setUserSearch(event.target.value)
                  }
                  placeholder="Search users…"
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100 sm:max-w-xs"
                />
              </div>

              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="overflow-x-auto">
                  <table className="min-w-[1000px] w-full text-left text-sm">
                    <thead className="border-b border-slate-200 bg-slate-50">
                      <tr>
                        <th className="px-5 py-3 font-semibold text-slate-600">
                          User
                        </th>
                        <th className="px-5 py-3 font-semibold text-slate-600">
                          Institution
                        </th>
                        <th className="px-5 py-3 font-semibold text-slate-600">
                          Role
                        </th>
                        <th className="px-5 py-3 font-semibold text-slate-600">
                          Status
                        </th>
                        <th className="px-5 py-3 font-semibold text-slate-600">
                          Last login
                        </th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100">
                      {filteredUsers.map((user) => (
                        <tr
                          key={user.id}
                          className="transition hover:bg-slate-50/70"
                        >
                          <td className="px-5 py-4">
                            <div className="font-semibold text-slate-950">
                              {user.firstName}{" "}
                              {user.lastName}
                            </div>

                            <div className="mt-0.5 text-xs text-slate-500">
                              {user.email}
                            </div>
                          </td>

                          <td className="px-5 py-4 text-slate-700">
                            {user.institution?.name ??
                              "Platform"}
                          </td>

                          <td className="px-5 py-4">
                            <div className="flex flex-wrap gap-1">
                              {user.roles.map(
                                (role) => (
                                  <span
                                    key={role.id}
                                    className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600"
                                  >
                                    {role.name}
                                  </span>
                                )
                              )}
                            </div>
                          </td>

                          <td className="px-5 py-4">
                            <span
                              className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                                user.isActive
                                  ? "bg-emerald-100 text-emerald-700"
                                  : "bg-slate-100 text-slate-500"
                              }`}
                            >
                              {user.isActive
                                ? "Active"
                                : "Inactive"}
                            </span>
                          </td>

                          <td className="px-5 py-4 text-slate-500">
                            {formatDateTime(
                              user.lastLoginAt
                            )}
                          </td>
                        </tr>
                      ))}

                      {filteredUsers.length === 0 && (
                        <tr>
                          <td
                            colSpan={5}
                            className="px-5 py-10 text-center text-sm text-slate-400"
                          >
                            No users found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          )}
        </div>

        {showInstitutionModal && (
          <Modal
            title="Create institution"
            onClose={() =>
              setShowInstitutionModal(false)
            }
          >
            <form
              onSubmit={handleCreateInstitution}
              className="grid gap-4"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-1.5">
                  <span className="text-xs font-semibold text-slate-600">
                    Institution name
                  </span>

                  <input
                    value={institutionForm.name}
                    onChange={(event) =>
                      setInstitutionForm(
                        (current) => ({
                          ...current,
                          name: event.target.value,
                        })
                      )
                    }
                    required
                    className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                  />
                </label>

                <label className="grid gap-1.5">
                  <span className="text-xs font-semibold text-slate-600">
                    Slug
                  </span>

                  <input
                    value={institutionForm.slug}
                    onChange={(event) =>
                      setInstitutionForm(
                        (current) => ({
                          ...current,
                          slug: event.target.value,
                        })
                      )
                    }
                    required
                    className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                  />
                </label>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-1.5">
                  <span className="text-xs font-semibold text-slate-600">
                    Primary color
                  </span>

                  <input
                    value={institutionForm.primaryColor}
                    onChange={(event) =>
                      setInstitutionForm(
                        (current) => ({
                          ...current,
                          primaryColor:
                            event.target.value,
                        })
                      )
                    }
                    className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                  />
                </label>

                <label className="grid gap-1.5">
                  <span className="text-xs font-semibold text-slate-600">
                    Secondary color
                  </span>

                  <input
                    value={institutionForm.secondaryColor}
                    onChange={(event) =>
                      setInstitutionForm(
                        (current) => ({
                          ...current,
                          secondaryColor:
                            event.target.value,
                        })
                      )
                    }
                    className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                  />
                </label>
              </div>

              <div className="border-t border-slate-100 pt-4">
                <p className="text-sm font-semibold text-slate-950">
                  Initial Institution Admin
                </p>

                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <input
                    value={
                      institutionForm.adminFirstName
                    }
                    onChange={(event) =>
                      setInstitutionForm(
                        (current) => ({
                          ...current,
                          adminFirstName:
                            event.target.value,
                        })
                      )
                    }
                    required
                    placeholder="First name"
                    className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                  />

                  <input
                    value={
                      institutionForm.adminLastName
                    }
                    onChange={(event) =>
                      setInstitutionForm(
                        (current) => ({
                          ...current,
                          adminLastName:
                            event.target.value,
                        })
                      )
                    }
                    required
                    placeholder="Last name"
                    className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                  />

                  <input
                    value={institutionForm.adminEmail}
                    onChange={(event) =>
                      setInstitutionForm(
                        (current) => ({
                          ...current,
                          adminEmail:
                            event.target.value,
                        })
                      )
                    }
                    required
                    type="email"
                    placeholder="Admin email"
                    className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                  />

                  <input
                    value={institutionForm.adminPhone}
                    onChange={(event) =>
                      setInstitutionForm(
                        (current) => ({
                          ...current,
                          adminPhone:
                            event.target.value,
                        })
                      )
                    }
                    placeholder="Phone"
                    className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                  />

                  <input
                    value={
                      institutionForm.adminPassword
                    }
                    onChange={(event) =>
                      setInstitutionForm(
                        (current) => ({
                          ...current,
                          adminPassword:
                            event.target.value,
                        })
                      )
                    }
                    required
                    minLength={10}
                    type="password"
                    placeholder="Temporary password"
                    className="sm:col-span-2 rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() =>
                    setShowInstitutionModal(false)
                  }
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {saving
                    ? "Creating…"
                    : "Create institution"}
                </button>
              </div>
            </form>
          </Modal>
        )}

        {showUserModal && (
          <Modal
            title="Create platform user"
            onClose={() =>
              setShowUserModal(false)
            }
          >
            <form
              onSubmit={handleCreateUser}
              className="grid gap-4"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <input
                  value={userForm.firstName}
                  onChange={(event) =>
                    setUserForm((current) => ({
                      ...current,
                      firstName:
                        event.target.value,
                    }))
                  }
                  required
                  placeholder="First name"
                  className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                />

                <input
                  value={userForm.lastName}
                  onChange={(event) =>
                    setUserForm((current) => ({
                      ...current,
                      lastName:
                        event.target.value,
                    }))
                  }
                  required
                  placeholder="Last name"
                  className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                />

                <input
                  value={userForm.email}
                  onChange={(event) =>
                    setUserForm((current) => ({
                      ...current,
                      email: event.target.value,
                    }))
                  }
                  required
                  type="email"
                  placeholder="Email"
                  className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
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
                  className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                />

                <select
                  value={userForm.role}
                  onChange={(event) =>
                    setUserForm((current) => ({
                      ...current,
                      role: event.target.value,
                      institutionId:
                        event.target.value === "SUPER_ADMIN"
                          ? ""
                          : current.institutionId,
                    }))
                  }
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                >
                  {assignableRoles.map((role) => (
                    <option key={role.value} value={role.value}>
                      {role.label}
                    </option>
                  ))}
                </select>

                <select
                  value={userForm.institutionId}
                  onChange={(event) =>
                    setUserForm((current) => ({
                      ...current,
                      institutionId:
                        event.target.value,
                    }))
                  }
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                >
                  <option value="">
                    {userForm.role === "SUPER_ADMIN"
                      ? "Platform scope"
                      : "Select institution"}
                  </option>

                  {institutions.map(
                    (institution) => (
                      <option
                        key={institution.id}
                        value={institution.id}
                      >
                        {institution.name}
                      </option>
                    )
                  )}
                </select>

                <input
                  value={userForm.password}
                  onChange={(event) =>
                    setUserForm((current) => ({
                      ...current,
                      password:
                        event.target.value,
                    }))
                  }
                  required
                  minLength={10}
                  type="password"
                  placeholder="Temporary password"
                  className="sm:col-span-2 rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                />
              </div>

              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-800">
                Super Admin accounts remain platform-level and should
                not be assigned to an institution. Institution roles
                must be assigned to their tenant. The Website CMS
                Manager role is intentionally limited to website content
                management and must be explicitly created or assigned by
                a Super Admin. It does not grant ERP administration access.
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() =>
                    setShowUserModal(false)
                  }
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={
                    saving ||
                    (userForm.role !== "SUPER_ADMIN" &&
                      !userForm.institutionId)
                  }
                  className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving
                    ? "Creating…"
                    : "Create user"}
                </button>
              </div>
            </form>
          </Modal>
        )}

        {selectedTenant && (
          <Modal
            title={`${selectedTenant.name} — Entitlements`}
            onClose={() => {
              setSelectedTenant(null);
              setTenantEntitlements(null);
            }}
          >
            {!tenantEntitlements ? (
              <div className="rounded-xl bg-slate-50 p-5 text-sm text-slate-500">
                Loading tenant entitlements…
              </div>
            ) : (
              <div className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="grid gap-1.5">
                    <span className="text-xs font-semibold text-slate-600">
                      Plan
                    </span>

                    <input
                      value={
                        tenantEntitlements.plan
                      }
                      onChange={(event) =>
                        updateTenantField(
                          "plan",
                          event.target.value
                        )
                      }
                      className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                    />
                  </label>

                  <label className="grid gap-1.5">
                    <span className="text-xs font-semibold text-slate-600">
                      Status
                    </span>

                    <select
                      value={
                        tenantEntitlements.status
                      }
                      onChange={(event) =>
                        updateTenantField(
                          "status",
                          event.target.value
                        )
                      }
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                    >
                      <option value="ACTIVE">
                        ACTIVE
                      </option>
                      <option value="TRIAL">
                        TRIAL
                      </option>
                      <option value="EXPIRED">
                        EXPIRED
                      </option>
                      <option value="SUSPENDED">
                        SUSPENDED
                      </option>
                      <option value="CANCELLED">
                        CANCELLED
                      </option>
                    </select>
                  </label>

                  <label className="grid gap-1.5">
                    <span className="text-xs font-semibold text-slate-600">
                      Student limit
                    </span>

                    <input
                      type="number"
                      min={0}
                      value={
                        tenantEntitlements.studentLimit ??
                        ""
                      }
                      onChange={(event) =>
                        updateTenantField(
                          "studentLimit",
                          event.target.value === ""
                            ? null
                            : Number(
                                event.target.value
                              )
                        )
                      }
                      className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                    />
                  </label>

                  <label className="grid gap-1.5">
                    <span className="text-xs font-semibold text-slate-600">
                      User limit
                    </span>

                    <input
                      type="number"
                      min={0}
                      value={
                        tenantEntitlements.userLimit ??
                        ""
                      }
                      onChange={(event) =>
                        updateTenantField(
                          "userLimit",
                          event.target.value === ""
                            ? null
                            : Number(
                                event.target.value
                              )
                        )
                      }
                      className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                    />
                  </label>

                  <label className="grid gap-1.5">
                    <span className="text-xs font-semibold text-slate-600">
                      Faculty limit
                    </span>

                    <input
                      type="number"
                      min={0}
                      value={
                        tenantEntitlements.facultyLimit ??
                        ""
                      }
                      onChange={(event) =>
                        updateTenantField(
                          "facultyLimit",
                          event.target.value === ""
                            ? null
                            : Number(
                                event.target.value
                              )
                        )
                      }
                      className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                    />
                  </label>

                  <label className="grid gap-1.5">
                    <span className="text-xs font-semibold text-slate-600">
                      Storage limit MB
                    </span>

                    <input
                      type="number"
                      min={0}
                      value={
                        tenantEntitlements.storageLimitMb ??
                        ""
                      }
                      onChange={(event) =>
                        updateTenantField(
                          "storageLimitMb",
                          event.target.value === ""
                            ? null
                            : Number(
                                event.target.value
                              )
                        )
                      }
                      className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                    />
                  </label>
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-950">
                        Feature entitlements
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        Enable or disable tenant-level capabilities.
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 divide-y divide-slate-100 rounded-2xl border border-slate-200">
                    {tenantEntitlements.entitlements.map(
                      (feature) => (
                        <div
                          key={feature.featureKey}
                          className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div>
                            <p className="text-sm font-semibold text-slate-800">
                              {feature.featureKey}
                            </p>

                            <p className="mt-0.5 text-xs text-slate-500">
                              Feature access
                            </p>
                          </div>

                          <div className="flex items-center gap-3">
                            <input
                              type="number"
                              min={0}
                              placeholder="Limit"
                              value={
                                feature.limitValue ??
                                ""
                              }
                              onChange={(event) =>
                                updateFeature(
                                  feature.featureKey,
                                  "limitValue",
                                  event.target.value ===
                                    ""
                                    ? null
                                    : Number(
                                        event.target.value
                                      )
                                )
                              }
                              className="w-24 rounded-lg border border-slate-200 px-2.5 py-2 text-xs outline-none focus:border-slate-400"
                            />

                            <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-slate-600">
                              <input
                                type="checkbox"
                                checked={
                                  feature.isEnabled
                                }
                                onChange={(event) =>
                                  updateFeature(
                                    feature.featureKey,
                                    "isEnabled",
                                    event.target.checked
                                  )
                                }
                                className="h-4 w-4 rounded border-slate-300"
                              />
                              Enabled
                            </label>
                          </div>
                        </div>
                      )
                    )}
                  </div>
                </div>

                <label className="grid gap-1.5">
                  <span className="text-xs font-semibold text-slate-600">
                    Change reason
                  </span>

                  <textarea
                    value={entitlementReason}
                    onChange={(event) =>
                      setEntitlementReason(
                        event.target.value
                      )
                    }
                    rows={3}
                    placeholder="Why are these entitlements being changed?"
                    className="resize-none rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                  />
                </label>

                <div className="grid gap-3 rounded-2xl bg-slate-50 p-4 sm:grid-cols-3">
                  <div>
                    <p className="text-xs text-slate-500">
                      Current users
                    </p>

                    <p className="mt-1 text-lg font-semibold text-slate-950">
                      {tenantEntitlements.usage.users.toLocaleString(
                        "en-IN"
                      )}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-slate-500">
                      Current students
                    </p>

                    <p className="mt-1 text-lg font-semibold text-slate-950">
                      {tenantEntitlements.usage.students.toLocaleString(
                        "en-IN"
                      )}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-slate-500">
                      Current faculty
                    </p>

                    <p className="mt-1 text-lg font-semibold text-slate-950">
                      {tenantEntitlements.usage.faculty.toLocaleString(
                        "en-IN"
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedTenant(null);
                      setTenantEntitlements(null);
                    }}
                    className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600"
                  >
                    Close
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      void saveEntitlements()
                    }
                    disabled={saving}
                    className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    {saving
                      ? "Saving…"
                      : "Save entitlements"}
                  </button>
                </div>
              </div>
            )}
          </Modal>
        )}
      </div>
    </DashboardShell>
  );
}
