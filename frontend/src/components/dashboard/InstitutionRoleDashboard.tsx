"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { DashboardShell } from "./DashboardShell";
import {
  authedFetch,
  AuthRequiredError,
} from "@/lib/auth";

type InstitutionRole =
  | "DIRECTOR"
  | "MANAGEMENT"
  | "HOD"
  | "PARENT"
  | "STAFF";

type Notice = {
  id: string;
  title: string;
  body: string;
};

type Workspace = {
  stats: Record<string, number>;
  notices: Notice[];
  students?: unknown[];
  facultyOfferings?: unknown[];
  departments?: unknown[];
  fees?: unknown[];
  exams?: unknown[];
};

type RoleConfig = {
  title: string;
  subtitle: string;
  eyebrow: string;
  focus: string[];
};

type StatCard = {
  label: string;
  value: number;
};

type ActionItem = {
  label: string;
  description: string;
  href: string;
};

const roleConfig: Record<
  InstitutionRole,
  RoleConfig
> = {
  DIRECTOR: {
    title: "Director Dashboard",
    subtitle:
      "Institution-wide performance and strategic oversight",
    eyebrow:
      "Institution leadership · Strategic overview",
    focus: [
      "Institution KPIs",
      "Department performance",
      "Academic risk",
      "Placements",
      "Strategic actions",
    ],
  },

  MANAGEMENT: {
    title: "Management Home",
    subtitle:
      "Executive control centre for your institution",
    eyebrow:
      "Executive workspace · Institutional control",
    focus: [
      "Institution KPIs",
      "Growth & operations",
      "Academic health",
      "Placement outcomes",
      "Decision support",
    ],
  },

  HOD: {
    title: "HOD Dashboard",
    subtitle:
      "Department performance and academic operations",
    eyebrow:
      "Department leadership · Academic operations",
    focus: [
      "Department KPIs",
      "Faculty workload",
      "Student risk",
      "Course performance",
      "Academic actions",
    ],
  },

  PARENT: {
    title: "Parent Dashboard",
    subtitle:
      "Your child’s academic and campus progress",
    eyebrow:
      "Family workspace · Student progress",
    focus: [
      "Child overview",
      "Attendance",
      "Marks",
      "Fees",
      "Notices",
    ],
  },

  STAFF: {
    title: "Staff Dashboard",
    subtitle:
      "Institutional operations workspace",
    eyebrow:
      "Operations workspace · Institutional services",
    focus: [
      "Operations",
      "Students",
      "Academics",
      "Notices",
      "Reports",
    ],
  },
};

function getNumber(
  stats: Record<string, number>,
  key: string,
): number {
  const value = stats[key];

  if (
    typeof value !== "number" ||
    !Number.isFinite(value)
  ) {
    return 0;
  }

  return value;
}

function formatNumber(value: number): string {
  return value.toLocaleString("en-IN");
}

function getStatCards(
  role: InstitutionRole,
  data: Workspace | null,
): StatCard[] {
  if (role === "PARENT") {
    return [
      {
        label: "Children",
        value: data?.students?.length ?? 0,
      },
      {
        label: "Fees",
        value: data?.fees?.length ?? 0,
      },
      {
        label: "Exam results",
        value: data?.exams?.length ?? 0,
      },
      {
        label: "Notices",
        value: data?.notices?.length ?? 0,
      },
    ];
  }

  const stats = data?.stats ?? {};

  return [
    {
      label: "Students",
      value: getNumber(stats, "students"),
    },
    {
      label: "Faculty",
      value: getNumber(stats, "faculty"),
    },
    {
      label: "Departments",
      value: getNumber(stats, "departments"),
    },
    {
      label: "Courses",
      value: getNumber(stats, "courses"),
    },
    {
      label: "Assignments",
      value: getNumber(stats, "assignments"),
    },
    {
      label: "Exams",
      value: getNumber(stats, "exams"),
    },
    {
      label: "Documents",
      value: getNumber(stats, "documents"),
    },
    {
      label: "Notifications",
      value: getNumber(
        stats,
        "notifications",
      ),
    },
  ];
}

function getActionItems(
  role: InstitutionRole,
): ActionItem[] {
  if (role === "PARENT") {
    return [
      {
        label: "View children",
        description:
          "Review your linked student profiles.",
        href: "/parent/children",
      },
      {
        label: "Open calendar",
        description:
          "Check important academic and campus dates.",
        href: "/calendar",
      },
      {
        label: "Review notices",
        description:
          "Stay up to date with institution announcements.",
        href: "/notifications",
      },
    ];
  }

  if (role === "HOD") {
    return [
      {
        label: "Open Intelligence",
        description:
          "Review department and institutional insights.",
        href: "/intelligence",
      },
      {
        label: "Review registrations",
        description:
          "Manage course-registration workflows.",
        href: "/course-registration",
      },
      {
        label: "Review student movement",
        description:
          "Manage promotion and student movement.",
        href: "/student-promotion",
      },
      {
        label: "Review leave",
        description:
          "Handle department leave workflows.",
        href: "/leave-management",
      },
    ];
  }

  if (role === "STAFF") {
    return [
      {
        label: "Open ERP Operations",
        description:
          "Access institutional operational modules.",
        href: "/erp",
      },
      {
        label: "Import institutional data",
        description:
          "Work with approved data-import workflows.",
        href: "/imports",
      },
      {
        label: "Manage admissions",
        description:
          "Open the admissions workspace.",
        href: "/admissions",
      },
      {
        label: "Open operations",
        description:
          "Review operational services and tasks.",
        href: "/operations",
      },
    ];
  }

  return [
    {
      label: "Open Intelligence",
      description:
        "Review institutional performance and insights.",
      href: "/intelligence",
    },
    {
      label: "Import institutional data",
      description:
        "Open the controlled data-import workspace.",
      href: "/imports",
    },
    {
      label: "Review placement readiness",
      description:
        "Open placement and career-readiness workflows.",
      href: "/placements",
    },
  ];
}

function DashboardStatCard({
  label,
  value,
}: StatCard) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">
        {label}
      </p>

      <p className="mt-2 text-3xl font-black tracking-tight text-slate-950">
        {formatNumber(value)}
      </p>

      <div className="mt-4 h-1 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full w-1/3 rounded-full bg-gradient-to-r from-sky-500 to-violet-500" />
      </div>
    </article>
  );
}

function DashboardStatSkeleton() {
  return (
    <div className="h-[139px] animate-pulse rounded-2xl border border-slate-200 bg-white" />
  );
}

function NoticesPanel({
  notices,
}: {
  notices: Notice[];
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
            Communication
          </p>

          <h2 className="mt-1 text-lg font-bold tracking-tight text-slate-950">
            Current notices
          </h2>
        </div>

        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          Live
        </span>
      </div>

      <div className="mt-5 space-y-3">
        {notices.length > 0 ? (
          notices.map((notice) => (
            <article
              key={notice.id}
              className="rounded-xl border border-slate-100 bg-slate-50 p-4 transition hover:border-slate-200 hover:bg-white"
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
              No active notices
            </p>

            <p className="mt-1 text-xs text-slate-400">
              New institutional notices will appear here.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

function NextActionsPanel({
  actions,
  onNavigate,
}: {
  actions: ActionItem[];
  onNavigate: (href: string) => void;
}) {
  return (
    <section className="rounded-2xl border border-slate-900 bg-slate-950 p-5 text-white shadow-sm">
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
        Workspace
      </p>

      <h2 className="mt-2 text-xl font-bold tracking-tight">
        Next actions
      </h2>

      <p className="mt-1 text-sm leading-6 text-slate-400">
        Move directly into the operational areas available to your role.
      </p>

      <div className="mt-5 space-y-2">
        {actions.map((action) => (
          <button
            key={action.href}
            type="button"
            onClick={() =>
              onNavigate(action.href)
            }
            className="group flex w-full items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3 text-left transition hover:border-white/20 hover:bg-white/[0.1] focus:outline-none focus:ring-2 focus:ring-white/20"
          >
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-white">
                {action.label}
              </span>

              <span className="mt-0.5 block text-xs leading-5 text-slate-400">
                {action.description}
              </span>
            </span>

            <span
              aria-hidden="true"
              className="shrink-0 text-slate-500 transition-transform group-hover:translate-x-0.5 group-hover:text-white"
            >
              →
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

export function InstitutionRoleDashboard({
  role,
}: {
  role: InstitutionRole;
}) {
  const router = useRouter();

  const [data, setData] =
    useState<Workspace | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const config = roleConfig[role];

  useEffect(() => {
    let mounted = true;

    setLoading(true);
    setError("");

    authedFetch<{
      success: true;
      data: Workspace;
    }>("/erp/me/workspace")
      .then((response) => {
        if (!mounted) {
          return;
        }

        setData(response.data);
      })
      .catch((requestError) => {
        if (!mounted) {
          return;
        }

        if (
          requestError instanceof AuthRequiredError
        ) {
          router.replace("/login");
          return;
        }

        setError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to load the dashboard workspace.",
        );
      })
      .finally(() => {
        if (mounted) {
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [router, role]);

  const stats = useMemo(
    () => getStatCards(role, data),
    [data, role],
  );

  const actions = useMemo(
    () => getActionItems(role),
    [role],
  );

  const handleAction = (href: string) => {
    router.push(href);
  };

  return (
    <DashboardShell
      title={config.title}
      subtitle={config.subtitle}
      allowedRoles={[role]}
    >
      <div className="mx-auto w-full max-w-7xl">
        {/* =====================================================
            PAGE INTRO
            ===================================================== */}
        <section className="mb-7">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                {config.eyebrow}
              </p>

              <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
                {config.title}
              </h1>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                {config.subtitle}
              </p>
            </div>

            <div className="flex max-w-3xl flex-wrap gap-2">
              {config.focus.map((item) => (
                <span
                  key={item}
                  className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-600 shadow-sm"
                >
                  {item}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* =====================================================
            ERROR
            ===================================================== */}
        {error ? (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-red-100 text-sm text-red-700">
                !
              </div>

              <div className="min-w-0">
                <p className="text-sm font-bold text-red-900">
                  Dashboard data could not be loaded
                </p>

                <p className="mt-1 text-sm leading-6 text-red-700">
                  {error}
                </p>

                <button
                  type="button"
                  onClick={() =>
                    window.location.reload()
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
            KPI CARDS
            ===================================================== */}
        <section aria-label="Dashboard statistics">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {loading
              ? Array.from({ length: 4 }).map(
                  (_, index) => (
                    <DashboardStatSkeleton
                      key={index}
                    />
                  ),
                )
              : stats.map((stat) => (
                  <DashboardStatCard
                    key={stat.label}
                    {...stat}
                  />
                ))}
          </div>
        </section>

        {/* =====================================================
            MAIN WORKSPACE
            ===================================================== */}
        <div className="mt-6 grid gap-5 xl:grid-cols-[1.45fr_1fr]">
          <NoticesPanel
            notices={data?.notices ?? []}
          />

          <NextActionsPanel
            actions={actions}
            onNavigate={handleAction}
          />
        </div>

        {/* =====================================================
            WORKSPACE FOOTER
            ===================================================== */}
        <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-bold text-slate-800">
              ACADLYX Institutional Workspace
            </p>

            <p className="mt-1 text-xs text-slate-400">
              Your available modules are controlled by your
              authenticated role.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />

            <span className="text-[11px] font-semibold text-slate-500">
              Workspace connected
            </span>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}

