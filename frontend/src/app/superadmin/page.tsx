"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { DashboardShell } from "@/components/dashboard/DashboardShell";
import {
  AuthRequiredError,
  authedFetch,
} from "@/lib/auth";

type SuperAdminStats = {
  institutions?: number;
  users?: number;
  students?: number;
  faculty?: number;
  courses?: number;
  activeInstitutions?: number;
  subscriptions?: number;
  notices?: number;
};

type PlatformWorkspace = {
  stats?: SuperAdminStats;
  institutions?: Array<{
    id?: string;
    name?: string;
    slug?: string;
    status?: string;
  }>;
  notices?: Array<{
    id: string;
    title: string;
    body: string;
  }>;
};

type SuperAdminSection =
  | "overview"
  | "institutions"
  | "users"
  | "platform"
  | "security";

type SectionConfig = {
  title: string;
  description: string;
};

const sectionConfig: Record<
  SuperAdminSection,
  SectionConfig
> = {
  overview: {
    title: "Platform Overview",
    description:
      "Monitor the ACADLYX platform from a single administrative workspace.",
  },

  institutions: {
    title: "Institutions",
    description:
      "Review and manage institutions connected to the platform.",
  },

  users: {
    title: "Users",
    description:
      "Review platform-level user activity and access.",
  },

  platform: {
    title: "Platform Operations",
    description:
      "Access platform-wide operational and configuration workflows.",
  },

  security: {
    title: "Security",
    description:
      "Access security-sensitive account and platform workflows.",
  },
};

type PlatformMetric = {
  label: string;
  value: number;
  description: string;
};

type PlatformAction = {
  label: string;
  description: string;
  href: string;
};

function safeNumber(
  value: unknown,
): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value)
  ) {
    return 0;
  }

  return value;
}

function formatNumber(
  value: number,
): string {
  return value.toLocaleString("en-IN");
}

function getMetrics(
  data: PlatformWorkspace | null,
): PlatformMetric[] {
  const stats = data?.stats ?? {};

  return [
    {
      label: "Institutions",
      value: safeNumber(
        stats.institutions,
      ),
      description:
        "Institution records represented on the platform.",
    },
    {
      label: "Active institutions",
      value: safeNumber(
        stats.activeInstitutions,
      ),
      description:
        "Institutions currently represented as active.",
    },
    {
      label: "Users",
      value: safeNumber(
        stats.users,
      ),
      description:
        "Users represented across the platform.",
    },
    {
      label: "Students",
      value: safeNumber(
        stats.students,
      ),
      description:
        "Student records represented across institutions.",
    },
    {
      label: "Faculty",
      value: safeNumber(
        stats.faculty,
      ),
      description:
        "Faculty records represented across institutions.",
    },
    {
      label: "Courses",
      value: safeNumber(
        stats.courses,
      ),
      description:
        "Courses represented across the platform.",
    },
    {
      label: "Subscriptions",
      value: safeNumber(
        stats.subscriptions,
      ),
      description:
        "Subscription records available to platform administration.",
    },
    {
      label: "Notices",
      value: safeNumber(
        stats.notices,
      ),
      description:
        "Platform-level notices represented in the workspace.",
    },
  ];
}

function getActions(
  section: SuperAdminSection,
): PlatformAction[] {
  switch (section) {
    case "institutions":
      return [
        {
          label: "Institution management",
          description:
            "Open institution administration workflows.",
          href: "/institution-settings",
        },
        {
          label: "Institution users",
          description:
            "Review institution-level user management.",
          href: "/user-management",
        },
        {
          label: "Data imports",
          description:
            "Review platform data-import workflows.",
          href: "/imports",
        },
      ];

    case "users":
      return [
        {
          label: "User management",
          description:
            "Review and manage user accounts.",
          href: "/user-management",
        },
        {
          label: "Account security",
          description:
            "Open account security workflows.",
          href: "/account-security",
        },
      ];

    case "platform":
      return [
        {
          label: "Institution settings",
          description:
            "Open platform institution configuration.",
          href: "/institution-settings",
        },
        {
          label: "Reports",
          description:
            "Review platform reporting workflows.",
          href: "/reports",
        },
        {
          label: "Intelligence",
          description:
            "Open institutional intelligence.",
          href: "/intelligence",
        },
        {
          label: "Website CMS",
          description:
            "Review supported CMS workflows.",
          href: "/site-content",
        },
      ];

    case "security":
      return [
        {
          label: "Account security",
          description:
            "Open account security settings.",
          href: "/account-security",
        },
        {
          label: "User management",
          description:
            "Review platform access management.",
          href: "/user-management",
        },
      ];

    case "overview":
    default:
      return [
        {
          label: "Institution management",
          description:
            "Review institution administration.",
          href: "/institution-settings",
        },
        {
          label: "User management",
          description:
            "Review platform users and access.",
          href: "/user-management",
        },
        {
          label: "Platform intelligence",
          description:
            "Review platform-level intelligence.",
          href: "/intelligence",
        },
        {
          label: "Reports",
          description:
            "Review platform reporting.",
          href: "/reports",
        },
      ];
  }
}

function MetricCard({
  metric,
}: {
  metric: PlatformMetric;
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
          {metric.label}
        </p>

        <span className="h-2 w-2 shrink-0 rounded-full bg-violet-500" />
      </div>

      <p className="mt-3 text-3xl font-black tracking-tight text-slate-950">
        {formatNumber(metric.value)}
      </p>

      <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-400">
        {metric.description}
      </p>
    </article>
  );
}

function MetricSkeleton() {
  return (
    <div className="h-[164px] animate-pulse rounded-2xl border border-slate-200 bg-white" />
  );
}

function SectionNavigation({
  active,
  onChange,
}: {
  active: SuperAdminSection;
  onChange: (
    section: SuperAdminSection,
  ) => void;
}) {
  const sections: Array<{
    id: SuperAdminSection;
    label: string;
    icon: string;
  }> = [
    {
      id: "overview",
      label: "Overview",
      icon: "⌂",
    },
    {
      id: "institutions",
      label: "Institutions",
      icon: "▦",
    },
    {
      id: "users",
      label: "Users",
      icon: "♙",
    },
    {
      id: "platform",
      label: "Platform",
      icon: "✦",
    },
    {
      id: "security",
      label: "Security",
      icon: "⛨",
    },
  ];

  return (
    <div className="mb-6 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
      <div className="flex min-w-max gap-1">
        {sections.map((section) => {
          const selected =
            active === section.id;

          return (
            <button
              key={section.id}
              type="button"
              onClick={() =>
                onChange(section.id)
              }
              className={[
                "inline-flex items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-bold transition",
                selected
                  ? "bg-slate-950 text-white shadow-sm"
                  : "text-slate-500 hover:bg-slate-100 hover:text-slate-900",
              ].join(" ")}
            >
              <span aria-hidden="true">
                {section.icon}
              </span>

              {section.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function PlatformActionPanel({
  actions,
  onOpen,
}: {
  actions: PlatformAction[];
  onOpen: (href: string) => void;
}) {
  return (
    <section className="rounded-2xl border border-slate-900 bg-slate-950 p-5 text-white shadow-sm">
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
        Platform workspace
      </p>

      <h2 className="mt-1 text-lg font-black tracking-tight">
        Administrative actions
      </h2>

      <p className="mt-1 text-sm leading-6 text-slate-400">
        Open platform-level management areas available to this role.
      </p>

      <div className="mt-5 space-y-2">
        {actions.map((action) => (
          <button
            key={action.href}
            type="button"
            onClick={() =>
              onOpen(action.href)
            }
            className="group flex w-full items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/[0.05] px-4 py-3 text-left transition hover:border-white/20 hover:bg-white/[0.1] focus:outline-none focus:ring-2 focus:ring-white/20"
          >
            <span className="min-w-0">
              <span className="block text-sm font-bold text-white">
                {action.label}
              </span>

              <span className="mt-0.5 block text-xs leading-5 text-slate-500">
                {action.description}
              </span>
            </span>

            <span
              aria-hidden="true"
              className="shrink-0 text-slate-500 transition group-hover:translate-x-0.5 group-hover:text-white"
            >
              →
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

function PlatformNoticePanel({
  notices,
}: {
  notices: Array<{
    id: string;
    title: string;
    body: string;
  }>;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
            Platform communication
          </p>

          <h2 className="mt-1 text-lg font-black tracking-tight text-slate-950">
            Current notices
          </h2>
        </div>

        <span className="rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
          Live
        </span>
      </div>

      <div className="mt-5 space-y-3">
        {notices.length > 0 ? (
          notices.map((notice) => (
            <article
              key={notice.id}
              className="rounded-xl border border-slate-100 bg-slate-50 p-4"
            >
              <p className="text-sm font-bold text-slate-900">
                {notice.title}
              </p>

              <p className="mt-1 text-sm leading-6 text-slate-500">
                {notice.body}
              </p>
            </article>
          ))
        ) : (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
            <p className="text-sm font-semibold text-slate-600">
              No active platform notices
            </p>

            <p className="mt-1 text-xs text-slate-400">
              Platform announcements will appear here.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

function PlatformEntityList({
  institutions,
}: {
  institutions: NonNullable<
    PlatformWorkspace["institutions"]
  >;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
          Platform entities
        </p>

        <h2 className="mt-1 text-lg font-black tracking-tight text-slate-950">
          Institutions
        </h2>
      </div>

      <div className="mt-5 overflow-hidden rounded-xl border border-slate-200">
        {institutions.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {institutions.slice(0, 8).map(
              (institution, index) => (
                <div
                  key={
                    institution.id ||
                    institution.slug ||
                    `institution-${index}`
                  }
                  className="flex items-center justify-between gap-4 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-slate-900">
                      {institution.name ||
                        institution.slug ||
                        "Institution"}
                    </p>

                    {institution.slug ? (
                      <p className="mt-0.5 truncate text-xs text-slate-400">
                        {institution.slug}
                      </p>
                    ) : null}
                  </div>

                  <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    {institution.status ||
                      "Active"}
                  </span>
                </div>
              ),
            )}
          </div>
        ) : (
          <div className="p-6 text-center">
            <p className="text-sm font-semibold text-slate-600">
              No institution records available
            </p>

            <p className="mt-1 text-xs text-slate-400">
              Institution information will appear here when available.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

function LoadingState() {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="h-3 w-48 animate-pulse rounded bg-slate-200" />
        <div className="h-9 w-72 animate-pulse rounded-lg bg-slate-200" />
        <div className="h-4 w-[520px] max-w-full animate-pulse rounded bg-slate-100" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map(
          (_, index) => (
            <MetricSkeleton key={index} />
          ),
        )}
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.45fr_1fr]">
        <div className="h-72 animate-pulse rounded-2xl bg-white" />
        <div className="h-72 animate-pulse rounded-2xl bg-slate-950" />
      </div>
    </div>
  );
}

export default function SuperAdminPage() {
  const router = useRouter();

  const [data, setData] =
    useState<PlatformWorkspace | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [section, setSection] =
    useState<SuperAdminSection>(
      "overview",
    );

  const loadWorkspace =
    useCallback(async () => {
      setLoading(true);
      setError("");

      try {
        const response =
          await authedFetch<{
            success: true;
            data: PlatformWorkspace;
          }>("/erp/me/workspace");

        setData(response.data);
      } catch (requestError) {
        if (
          requestError instanceof AuthRequiredError
        ) {
          router.replace("/login");
          return;
        }

        setError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to load the platform workspace.",
        );
      } finally {
        setLoading(false);
      }
    }, [router]);

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  const metrics = useMemo(
    () => getMetrics(data),
    [data],
  );

  const actions = useMemo(
    () => getActions(section),
    [section],
  );

  const sectionInfo =
    sectionConfig[section];

  const open = (href: string) => {
    router.push(href);
  };

  return (
    <DashboardShell
      title="Super Admin"
      subtitle="Platform administration workspace"
      allowedRoles={[
        "SUPER_ADMIN",
      ]}
    >
      <div className="mx-auto w-full max-w-7xl">
        {/* =====================================================
            PAGE INTRO
            ===================================================== */}
        <section className="mb-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                ACADLYX platform · Super administration
              </p>

              <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
                {sectionInfo.title}
              </h1>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                {sectionInfo.description}
              </p>
            </div>

            <span className="inline-flex w-fit items-center gap-2 rounded-full border border-violet-100 bg-violet-50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-violet-700">
              <span className="h-1.5 w-1.5 rounded-full bg-violet-500" />
              Super Admin
            </span>
          </div>
        </section>

        {/* =====================================================
            SECTION NAVIGATION
            ===================================================== */}
        <SectionNavigation
          active={section}
          onChange={setSection}
        />

        {/* =====================================================
            ERROR
            ===================================================== */}
        {error ? (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-red-100 text-sm font-black text-red-700">
                !
              </div>

              <div>
                <p className="text-sm font-bold text-red-900">
                  Unable to load platform data
                </p>

                <p className="mt-1 text-sm leading-6 text-red-700">
                  {error}
                </p>

                <button
                  type="button"
                  onClick={() =>
                    void loadWorkspace()
                  }
                  className="mt-3 rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-bold text-red-700 transition hover:bg-red-50"
                >
                  Retry
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {/* =====================================================
            OVERVIEW
            ===================================================== */}
        {loading ? (
          <LoadingState />
        ) : (
          <>
            {section === "overview" ? (
              <>
                <section aria-label="Platform statistics">
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    {metrics
                      .slice(0, 4)
                      .map((metric) => (
                        <MetricCard
                          key={metric.label}
                          metric={metric}
                        />
                      ))}
                  </div>
                </section>

                <section className="mt-4">
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    {metrics
                      .slice(4)
                      .map((metric) => (
                        <MetricCard
                          key={metric.label}
                          metric={metric}
                        />
                      ))}
                  </div>
                </section>

                <div className="mt-6 grid gap-5 xl:grid-cols-[1.45fr_1fr]">
                  <PlatformEntityList
                    institutions={
                      data?.institutions ?? []
                    }
                  />

                  <PlatformActionPanel
                    actions={actions}
                    onOpen={open}
                  />
                </div>

                <div className="mt-5">
                  <PlatformNoticePanel
                    notices={
                      data?.notices ?? []
                    }
                  />
                </div>
              </>
            ) : (
              <div className="grid gap-5 xl:grid-cols-[1.35fr_1fr]">
                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                    Available modules
                  </p>

                  <h2 className="mt-1 text-lg font-black tracking-tight text-slate-950">
                    {actions.length} platform action
                    {actions.length === 1
                      ? ""
                      : "s"}
                  </h2>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    {actions.map(
                      (action) => (
                        <button
                          key={action.href}
                          type="button"
                          onClick={() =>
                            open(
                              action.href,
                            )
                          }
                          className="group rounded-xl border border-slate-200 bg-slate-50 p-4 text-left transition hover:border-slate-300 hover:bg-white hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-sm font-bold text-slate-900">
                              {action.label}
                            </p>

                            <span className="text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-slate-700">
                              →
                            </span>
                          </div>

                          <p className="mt-1 text-xs leading-5 text-slate-500">
                            {
                              action.description
                            }
                          </p>
                        </button>
                      ),
                    )}
                  </div>
                </section>

                <PlatformActionPanel
                  actions={actions}
                  onOpen={open}
                />
              </div>
            )}
          </>
        )}

        {/* =====================================================
            FOOTER
            ===================================================== */}
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-bold text-slate-800">
                ACADLYX Platform Administration
              </p>

              <p className="mt-1 text-xs leading-5 text-slate-400">
                Platform-level access is controlled by the authenticated
                Super Admin role.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />

              <span className="text-[11px] font-semibold text-slate-500">
                Connected
              </span>
            </div>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
