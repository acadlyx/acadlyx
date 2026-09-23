"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";

import { DashboardShell } from "./DashboardShell";
import {
  AuthRequiredError,
  authedFetch,
} from "@/lib/auth";

type AdminStats = {
  users?: number;
  students?: number;
  faculty?: number;
  departments?: number;
  programs?: number;
  courses?: number;
};

type WorkspaceData = {
  stats?: AdminStats;
};

type Metric = {
  label: string;
  value: number;
  description: string;
};

type AdminModule = {
  title: string;
  description: string;
  href: string;
  icon: string;
  eyebrow: string;
};

const ADMIN_MODULES: AdminModule[] = [
  {
    title: "People & access",
    description:
      "Manage institution-scoped accounts and keep access aligned with each stakeholder's assigned responsibility.",
    href: "/user-management",
    icon: "♙",
    eyebrow: "Users",
  },
  {
    title: "Account security",
    description:
      "Review your own sign-in and account-security controls without entering operational workspaces.",
    href: "/account-security",
    icon: "◉",
    eyebrow: "Security",
  },
];

const ADMIN_BOUNDARIES = [
  "Institution users and account lifecycle",
  "Institution profile and administrative configuration",
  "Academic master-data visibility such as departments, programs and courses",
  "Tenant-scoped access administration",
];

const DELEGATED_WORK = [
  "Fees and financial operations belong to Accounts",
  "Assignments and marks belong to Faculty / academic roles",
  "Examinations and results belong to the Examination Cell and academic leadership",
  "Attendance operations belong to Faculty, HOD and designated academic roles",
  "Admissions, HR, library, placements and IT use their own role workspaces",
];

function safeNumber(
  value: unknown,
): number {
  return (
    typeof value === "number" &&
    Number.isFinite(value)
      ? value
      : 0
  );
}

function formatNumber(
  value: number,
): string {
  return value.toLocaleString(
    "en-IN",
  );
}

function getMetrics(
  data: WorkspaceData | null,
): Metric[] {
  const stats =
    data?.stats ?? {};

  return [
    {
      label: "Users",
      value: safeNumber(
        stats.users,
      ),
      description:
        "Institution-scoped user accounts visible to administration.",
    },
    {
      label: "Students",
      value: safeNumber(
        stats.students,
      ),
      description:
        "Student identities represented inside this institution.",
    },
    {
      label: "Faculty",
      value: safeNumber(
        stats.faculty,
      ),
      description:
        "Faculty identities represented inside this institution.",
    },
    {
      label: "Departments",
      value: safeNumber(
        stats.departments,
      ),
      description:
        "Academic departments configured for this institution.",
    },
    {
      label: "Programs",
      value: safeNumber(
        stats.programs,
      ),
      description:
        "Programs configured in the institution's academic structure.",
    },
    {
      label: "Courses",
      value: safeNumber(
        stats.courses,
      ),
      description:
        "Courses configured as academic master data.",
    },
  ];
}

function MetricCard({
  metric,
}: {
  metric: Metric;
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
        {metric.label}
      </p>

      <p className="mt-3 text-3xl font-black tracking-tight text-slate-950">
        {formatNumber(
          metric.value,
        )}
      </p>

      <p className="mt-2 text-xs leading-5 text-slate-500">
        {
          metric.description
        }
      </p>
    </article>
  );
}

function MetricSkeleton() {
  return (
    <div className="h-[148px] animate-pulse rounded-2xl border border-slate-200 bg-white" />
  );
}

export function AdminPortal() {
  const router =
    useRouter();

  const [
    data,
    setData,
  ] =
    useState<WorkspaceData | null>(
      null,
    );

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    error,
    setError,
  ] =
    useState("");

  const loadWorkspace =
    useCallback(async () => {
      setLoading(true);
      setError("");

      try {
        const response =
          await authedFetch<{
            success: true;
            data: WorkspaceData;
          }>(
            "/erp/me/workspace",
          );

        setData(
          response.data,
        );
      } catch (
        requestError
      ) {
        if (
          requestError instanceof
          AuthRequiredError
        ) {
          router.replace(
            "/login",
          );
          return;
        }

        setError(
          requestError instanceof
            Error
            ? requestError.message
            : "Unable to load institution administration data.",
        );
      } finally {
        setLoading(false);
      }
    }, [router]);

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  const metrics =
    useMemo(
      () =>
        getMetrics(data),
      [data],
    );

  return (
    <DashboardShell
      title="Institution Admin"
      subtitle="Institution administration and access control"
      allowedRoles={[
        "INSTITUTION_ADMIN",
      ]}
    >
      <div className="mx-auto w-full max-w-7xl space-y-6">
        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="relative overflow-hidden bg-slate-950 px-6 py-8 text-white sm:px-8 lg:px-10 lg:py-10">
            <div className="absolute -right-24 -top-28 h-72 w-72 rounded-full bg-indigo-400/10 blur-3xl" />

            <div className="relative max-w-3xl">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-indigo-300">
                Institution
                administration
              </p>

              <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
                Administration
                Control Centre
              </h1>

              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
                Configure the
                institution and
                control
                institution-scoped
                access. Operational
                work such as fees,
                assignments,
                attendance and
                examinations is
                intentionally kept
                out of this
                workspace.
              </p>
            </div>
          </div>
        </section>

        {error ? (
          <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-bold text-amber-900">
                  Administration
                  summary could not
                  be refreshed
                </p>

                <p className="mt-1 text-sm text-amber-700">
                  {error}
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  void loadWorkspace()
                }
                className="rounded-xl border border-amber-300 bg-white px-4 py-2 text-sm font-bold text-amber-800 hover:bg-amber-100"
              >
                Retry
              </button>
            </div>
          </section>
        ) : null}

        <section
          aria-labelledby="admin-overview-heading"
        >
          <div className="mb-4">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
              Administrative
              overview
            </p>

            <h2
              id="admin-overview-heading"
              className="mt-1 text-xl font-black tracking-tight text-slate-950"
            >
              Institution
              structure
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Read-only summary
              information for
              administration. No
              finance, assessment
              or examination KPIs
              are shown here.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {loading
              ? Array.from({
                  length: 6,
                }).map(
                  (
                    _,
                    index,
                  ) => (
                    <MetricSkeleton
                      key={
                        index
                      }
                    />
                  ),
                )
              : metrics.map(
                  (
                    metric,
                  ) => (
                    <MetricCard
                      key={
                        metric.label
                      }
                      metric={
                        metric
                      }
                    />
                  ),
                )}
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-2">
          {ADMIN_MODULES.map(
            (module) => (
              <Link
                key={
                  module.href
                }
                href={
                  module.href
                }
                className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md"
              >
                <div className="flex items-start gap-4">
                  <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-slate-950 text-lg font-black text-white">
                    {
                      module.icon
                    }
                  </div>

                  <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                      {
                        module.eyebrow
                      }
                    </p>

                    <div className="mt-1 flex items-center gap-2">
                      <h2 className="text-lg font-black text-slate-950">
                        {
                          module.title
                        }
                      </h2>

                      <span className="text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-indigo-600">
                        →
                      </span>
                    </div>

                    <p className="mt-2 text-sm leading-6 text-slate-500">
                      {
                        module.description
                      }
                    </p>
                  </div>
                </div>
              </Link>
            ),
          )}
        </section>

        <section className="grid gap-5 xl:grid-cols-2">
          <article className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-6">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700">
              Institution Admin
              scope
            </p>

            <h2 className="mt-2 text-lg font-black text-slate-950">
              What belongs in this
              workspace
            </h2>

            <ul className="mt-4 space-y-3">
              {ADMIN_BOUNDARIES.map(
                (item) => (
                  <li
                    key={
                      item
                    }
                    className="flex gap-3 text-sm leading-6 text-slate-700"
                  >
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />

                    <span>
                      {item}
                    </span>
                  </li>
                ),
              )}
            </ul>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
              Delegated
              responsibilities
            </p>

            <h2 className="mt-2 text-lg font-black text-slate-950">
              What is
              intentionally not
              shown
            </h2>

            <ul className="mt-4 space-y-3">
              {DELEGATED_WORK.map(
                (item) => (
                  <li
                    key={
                      item
                    }
                    className="flex gap-3 text-sm leading-6 text-slate-600"
                  >
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-300" />

                    <span>
                      {item}
                    </span>
                  </li>
                ),
              )}
            </ul>
          </article>
        </section>
      </div>
    </DashboardShell>
  );
}
