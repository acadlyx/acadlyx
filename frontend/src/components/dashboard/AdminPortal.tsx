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
import { AuthRequiredError } from "@/lib/auth";
import {
  AdminWorkspace,
  getAdminWorkspace,
} from "@/lib/adminApi";

type WorkspaceCard = {
  key: keyof AdminWorkspace["modules"];
  label: string;
  description: string;
  href: string;
  icon: string;
};

const WORKSPACE_CARDS: WorkspaceCard[] = [
  {
    key: "users",
    label: "People",
    description:
      "Manage institution users, roles and account status.",
    href: "/user-management",
    icon: "people",
  },
  {
    key: "timetable",
    label: "Timetable",
    description:
      "Manage institution timetable information and schedules.",
    href: "/timetable",
    icon: "calendar",
  },
  {
    key: "notices",
    label: "Notices",
    description:
      "Publish and maintain institution-wide notices.",
    href: "/notices",
    icon: "notice",
  },
  {
    key: "calendar",
    label: "Calendar",
    description:
      "Manage academic and institutional dates.",
    href: "/calendar",
    icon: "date",
  },
  {
    key: "notifications",
    label: "Notifications",
    description:
      "Manage permitted institution notifications.",
    href: "/notifications",
    icon: "bell",
  },
  {
    key: "operations",
    label: "Operations",
    description:
      "Manage institution operational records and requests.",
    href: "/operations",
    icon: "settings",
  },
  {
    key: "documents",
    label: "Documents",
    description:
      "Manage institution-scoped administrative documents.",
    href: "/forms",
    icon: "document",
  },
];

const ICON_PATHS: Record<string, string> = {
  people:
    "M16 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 18.5V20M10 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM15.5 7.5a3 3 0 0 1 0 5.8M17 15h1.5A3.5 3.5 0 0 1 22 18.5V20",

  calendar:
    "M5 4v3M19 4v3M4 8.5h16M6 3.5h12A2 2 0 0 1 20 5.5v13A2 2 0 0 1 18 20.5H6a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2ZM8 12h3M13 12h3M8 15.5h3",

  notice:
    "M5 8.5a7 7 0 0 1 14 0v4l2 2H3l2-2v-4ZM9 17h6M10 20h4",

  date:
    "M6 3.5v3M18 3.5v3M4 8.5h16M6 5h12a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2ZM8 12h.01M12 12h.01M16 12h.01M8 16h.01M12 16h.01",

  bell:
    "M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M9.5 21h5",

  settings:
    "M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7ZM19 12a7.4 7.4 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7.8 7.8 0 0 0-2-1.2L14.2 3h-4.4l-.3 2.6a7.8 7.8 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6A7.4 7.4 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.6 2 3.4 2.4-1 2 1.2.3 2.6h4.4l.3-2.6a7.8 7.8 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2Z",

  document:
    "M7 3.5h7l4 4v13H7a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2ZM14 3.5v5h4M8.5 12h7M8.5 15.5h7",
};

function Icon({
  name,
}: {
  name: string;
}) {
  return (
    <span className="grid h-11 w-11 place-items-center rounded-[15px] bg-[#edf3ff] text-blue-600">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-[19px] w-[19px]"
        aria-hidden="true"
      >
        <path
          d={
            ICON_PATHS[name] ||
            ICON_PATHS.document
          }
        />
      </svg>
    </span>
  );
}

const METRICS: Array<{
  key: keyof AdminWorkspace["stats"];
  label: string;
  helper: string;
}> = [
  {
    key: "users",
    label: "People",
    helper: "institution accounts",
  },
  {
    key: "students",
    label: "Students",
    helper: "active students",
  },
  {
    key: "faculty",
    label: "Faculty",
    helper: "active faculty",
  },
  {
    key: "departments",
    label: "Departments",
    helper: "active departments",
  },
  {
    key: "programs",
    label: "Programs",
    helper: "active programs",
  },
  {
    key: "courses",
    label: "Courses",
    helper: "active courses",
  },
  {
    key: "offerings",
    label: "Offerings",
    helper: "course offerings",
  },
  {
    key: "campuses",
    label: "Campuses",
    helper: "active campuses",
  },
];

function number(
  value: unknown,
) {
  return new Intl.NumberFormat(
    "en-IN",
  ).format(
    typeof value === "number" &&
      Number.isFinite(value)
      ? value
      : 0,
  );
}

export function AdminPortal() {
  const router =
    useRouter();

  const [
    workspace,
    setWorkspace,
  ] =
    useState<
      AdminWorkspace | null
    >(null);

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

  const load =
    useCallback(
      async () => {
        setLoading(true);
        setError("");

        try {
          const data =
            await getAdminWorkspace();

          setWorkspace(
            data,
          );
        } catch (
          reason
        ) {
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
            reason instanceof
              Error
              ? reason.message
              : "Unable to load the administration workspace.",
          );
        } finally {
          setLoading(
            false,
          );
        }
      },
      [router],
    );

  useEffect(() => {
    void load();
  }, [load]);

  const visibleCards =
    useMemo(
      () =>
        WORKSPACE_CARDS.filter(
          (card) =>
            workspace?.modules[
              card.key
            ] === true,
        ),
      [workspace],
    );

  return (
    <DashboardShell
      title="Institution Admin"
      subtitle="Institution administration workspace"
      allowedRoles={[
        "INSTITUTION_ADMIN",
      ]}
    >
      <main className="mx-auto max-w-[1320px] space-y-6 pb-10">
        <section className="relative overflow-hidden rounded-[30px] border border-slate-200 bg-white px-5 py-6 shadow-[0_14px_40px_rgba(15,23,42,0.06)] sm:px-7 sm:py-8 lg:px-9">
          <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-blue-100/70 blur-3xl" />

          <div className="pointer-events-none absolute -bottom-32 left-1/3 h-72 w-72 rounded-full bg-indigo-50 blur-3xl" />

          <div className="relative flex flex-col gap-7 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-blue-700">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />

                Institution administration
              </div>

              <h1 className="mt-4 text-3xl font-black tracking-[-0.035em] text-slate-950 sm:text-4xl">
                Your institution,
                <br className="hidden sm:block" />
                all in one place.
              </h1>

              <p className="mt-3 max-w-xl text-sm leading-6 text-slate-500 sm:text-[15px]">
                Manage people, academic operations and institution
                services from one focused workspace. Specialist
                teams keep ownership of their own operational modules.
              </p>

              <div className="mt-6 flex flex-wrap gap-2.5">
                {workspace?.modules.users ? (
                  <Link
                    href="/user-management"
                    className="rounded-[14px] bg-blue-600 px-4 py-2.5 text-sm font-extrabold text-white shadow-[0_8px_18px_rgba(37,99,235,0.20)] transition hover:bg-blue-700"
                  >
                    Manage people
                  </Link>
                ) : null}

                {workspace?.modules.operations ? (
                  <Link
                    href="/operations"
                    className="rounded-[14px] border border-slate-200 bg-white px-4 py-2.5 text-sm font-extrabold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                  >
                    Open operations
                  </Link>
                ) : null}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2.5 xl:min-w-[390px]">
              <MiniMetric
                label="People"
                value={
                  workspace?.stats
                    .users
                }
                loading={
                  loading
                }
              />

              <MiniMetric
                label="Students"
                value={
                  workspace?.stats
                    .students
                }
                loading={
                  loading
                }
              />

              <MiniMetric
                label="Faculty"
                value={
                  workspace?.stats
                    .faculty
                }
                loading={
                  loading
                }
              />
            </div>
          </div>
        </section>

        {error ? (
          <section className="flex flex-wrap items-center justify-between gap-3 rounded-[20px] border border-red-200 bg-red-50 px-4 py-3.5 text-sm text-red-700">
            <span>
              {error}
            </span>

            <button
              type="button"
              onClick={() =>
                void load()
              }
              className="rounded-[12px] bg-red-700 px-3.5 py-2 text-xs font-extrabold text-white"
            >
              Retry
            </button>
          </section>
        ) : null}

        <section className="rounded-[26px] border border-slate-200 bg-[#f8fafc] p-4 shadow-[0_10px_30px_rgba(15,23,42,0.03)] sm:p-5">
          <div className="flex items-end justify-between gap-4 px-1 pb-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600">
                Institution snapshot
              </p>

              <h2 className="mt-1 text-xl font-black tracking-tight text-slate-950">
                At a glance
              </h2>
            </div>

            <span className="hidden rounded-full bg-white px-3 py-1.5 text-[10px] font-bold text-slate-400 shadow-sm sm:inline-flex">
              Live institution counts
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {METRICS.map(
              (metric) => (
                <article
                  key={
                    metric.key
                  }
                  className="rounded-[19px] border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                    {
                      metric.label
                    }
                  </p>

                  <p className="mt-2 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
                    {loading
                      ? "—"
                      : number(
                          workspace
                            ?.stats[
                            metric.key
                          ],
                        )}
                  </p>

                  <p className="mt-1 text-[11px] font-medium text-slate-400">
                    {
                      metric.helper
                    }
                  </p>
                </article>
              ),
            )}
          </div>
        </section>

        <section>
          <div className="mb-4 px-1">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600">
              Your workspace
            </p>

            <div className="mt-1 flex flex-col justify-between gap-1 sm:flex-row sm:items-end">
              <h2 className="text-xl font-black tracking-tight text-slate-950 sm:text-2xl">
                Administration tools
              </h2>

              <p className="text-xs font-medium text-slate-400">
                Only role-owned operational areas are shown here.
              </p>
            </div>
          </div>

          {visibleCards.length >
          0 ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {visibleCards.map(
                (card) => (
                  <Link
                    key={
                      card.key
                    }
                    href={
                      card.href
                    }
                    className="group rounded-[22px] border border-slate-200 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.04)] transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-[0_14px_30px_rgba(15,23,42,0.08)]"
                  >
                    <div className="flex items-start gap-3.5">
                      <Icon
                        name={
                          card.icon
                        }
                      />

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-3">
                          <h3 className="font-extrabold text-slate-950">
                            {
                              card.label
                            }
                          </h3>

                          <span className="text-lg font-light text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-blue-600">
                            →
                          </span>
                        </div>

                        <p className="mt-1.5 text-sm leading-5 text-slate-500">
                          {
                            card.description
                          }
                        </p>
                      </div>
                    </div>
                  </Link>
                ),
              )}
            </div>
          ) : (
            <div className="rounded-[22px] border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
              No administrative module is currently enabled for this account.
            </div>
          )}
        </section>

        <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                Access boundary
              </p>

              <h2 className="mt-1 text-lg font-black text-slate-950">
                Specialist operations stay with specialist teams.
              </h2>

              <p className="mt-1.5 max-w-2xl text-sm leading-6 text-slate-500">
                Fees, examination operations, attendance, HR, library,
                placement and similar specialist workflows are not presented
                as Institution Admin tools.
              </p>
            </div>

            <Link
              href="/account-security"
              className="shrink-0 rounded-[14px] border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-extrabold text-slate-700 transition hover:bg-white"
            >
              Account security
            </Link>
          </div>
        </section>
      </main>
    </DashboardShell>
  );
}

function MiniMetric({
  label,
  value,
  loading,
}: {
  label: string;
  value?: number;
  loading: boolean;
}) {
  return (
    <div className="rounded-[18px] border border-slate-200 bg-[#f8fafc] px-3 py-3.5">
      <p className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-400">
        {label}
      </p>

      <p className="mt-1 text-xl font-black text-slate-950">
        {loading
          ? "—"
          : number(value)}
      </p>
    </div>
  );
}
