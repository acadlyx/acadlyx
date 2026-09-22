"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { DashboardShell } from "./DashboardShell";
import {
  AuthRequiredError,
  authedFetch,
} from "@/lib/auth";

type AdminStats = {
  students?: number;
  faculty?: number;
  departments?: number;
  courses?: number;
  assignments?: number;
  exams?: number;
  documents?: number;
  notifications?: number;
  users?: number;
};

type Notice = {
  id: string;
  title: string;
  body: string;
  createdAt?: string;
};

type WorkspaceData = {
  stats?: AdminStats;
  notices?: Notice[];
  students?: unknown[];
  facultyOfferings?: unknown[];
  departments?: unknown[];
  fees?: unknown[];
  exams?: unknown[];
};

type AdminSection =
  | "overview"
  | "students"
  | "faculty"
  | "academics"
  | "finance"
  | "operations"
  | "intelligence";

type AdminAction = {
  label: string;
  description: string;
  href: string;
};

type Metric = {
  label: string;
  value: number;
  description: string;
};

const sectionConfig: Record<
  AdminSection,
  {
    title: string;
    description: string;
  }
> = {
  overview: {
    title: "Institution Overview",
    description:
      "Monitor the most important institutional activity from one workspace.",
  },
  students: {
    title: "Students",
    description:
      "Access student records, academic activity, and student operations.",
  },
  faculty: {
    title: "Faculty",
    description:
      "Manage faculty-facing academic and operational workflows.",
  },
  academics: {
    title: "Academics",
    description:
      "Open examinations, results, registrations, courses, and academic services.",
  },
  finance: {
    title: "Finance",
    description:
      "Access fees, receipts, and institution financial workflows.",
  },
  operations: {
    title: "Operations",
    description:
      "Manage institutional operational services and workflows.",
  },
  intelligence: {
    title: "Institution Intelligence",
    description:
      "Review institutional intelligence and performance information.",
  },
};

function numberValue(
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
  data: WorkspaceData | null,
): Metric[] {
  const stats = data?.stats ?? {};

  return [
    {
      label: "Students",
      value: numberValue(stats.students),
      description:
        "Students currently represented in the institution workspace.",
    },
    {
      label: "Faculty",
      value: numberValue(stats.faculty),
      description:
        "Faculty records available to institutional workflows.",
    },
    {
      label: "Departments",
      value: numberValue(stats.departments),
      description:
        "Departments available across the institution.",
    },
    {
      label: "Courses",
      value: numberValue(stats.courses),
      description:
        "Courses currently available in the academic workspace.",
    },
    {
      label: "Assignments",
      value: numberValue(stats.assignments),
      description:
        "Assignments available across supported academic workflows.",
    },
    {
      label: "Exams",
      value: numberValue(stats.exams),
      description:
        "Examination records available to the workspace.",
    },
    {
      label: "Documents",
      value: numberValue(stats.documents),
      description:
        "Documents currently represented in the system.",
    },
    {
      label: "Notifications",
      value: numberValue(stats.notifications),
      description:
        "Notifications currently available to institutional users.",
    },
  ];
}

function getActions(): AdminAction[] {
  return [
    {
      label: "Open ERP Operations",
      description:
        "Access institutional ERP modules and operational workflows.",
      href: "/erp",
    },
    {
      label: "Open Intelligence",
      description:
        "Review institutional performance and intelligence.",
      href: "/intelligence",
    },
    {
      label: "Import Institutional Data",
      description:
        "Open the controlled institutional data-import workspace.",
      href: "/imports",
    },
    {
      label: "User lifecycle",
      description: "Safely deactivate or reactivate institutional accounts.",
      href: "/user-management",
    },
    {
      label: "Admissions",
      description:
        "Open admissions and applicant workflows.",
      href: "/admissions",
    },
    {
      label: "HR",
      description:
        "Open institutional HR workflows.",
      href: "/hr",
    },
    {
      label: "Fees",
      description:
        "Review fees and receipt workflows.",
      href: "/fees",
    },
    {
      label: "Operations",
      description:
        "Open institutional operations.",
      href: "/operations",
    },
  ];
}

function getSectionActions(
  section: AdminSection,
): AdminAction[] {
  switch (section) {
    case "students":
      return [
        {
          label: "Student management",
          description:
            "Open student records and institutional student workflows.",
          href: "/students",
        },
        {
          label: "Student movement",
          description:
            "Manage promotion and student movement workflows.",
          href: "/student-promotion",
        },
        {
          label: "Attendance",
          description:
            "Review attendance workflows.",
          href: "/attendance",
        },
      ];

    case "faculty":
      return [
        {
          label: "Faculty management",
          description:
            "Open faculty management.",
          href: "/faculty-management",
        },
        {
          label: "Assignments",
          description:
            "Review faculty assignment workflows.",
          href: "/faculty/assignments",
        },
        {
          label: "Leave management",
          description:
            "Review leave workflows.",
          href: "/leave-management",
        },
      ];

    case "academics":
      return [
        {
          label: "Examinations",
          description:
            "Open examination workflows.",
          href: "/examinations",
        },
        {
          label: "Results",
          description:
            "Review academic results.",
          href: "/results",
        },
        {
          label: "Course registration",
          description:
            "Manage course registration.",
          href: "/course-registration",
        },
        {
          label: "Timetable",
          description:
            "Open academic timetable workflows.",
          href: "/timetable",
        },
      ];

    case "finance":
      return [
        {
          label: "Fees",
          description:
            "Open fee management.",
          href: "/fees",
        },
        {
          label: "Receipts",
          description:
            "Review fee receipts.",
          href: "/fees/receipts",
        },
      ];

    case "operations":
      return [
        {
          label: "ERP Operations",
          description:
            "Open institutional ERP operations.",
          href: "/erp",
        },
        {
          label: "Admissions",
          description:
            "Open admissions.",
          href: "/admissions",
        },
        {
          label: "HR",
          description:
            "Open human-resources workflows.",
          href: "/hr",
        },
        {
          label: "Leave management",
          description:
            "Open leave workflows.",
          href: "/leave-management",
        },
        {
          label: "Library",
          description:
            "Open library management.",
          href: "/library",
        },
      ];

    case "intelligence":
      return [
        {
          label: "Institution Intelligence",
          description:
            "Open institutional intelligence.",
          href: "/intelligence",
        },
        {
          label: "Reports",
          description:
            "Review institution reports.",
          href: "/reports",
        },
        {
          label: "Placements",
          description:
            "Review placement workflows.",
          href: "/placements",
        },
      ];

    case "overview":
    default:
      return getActions();
  }
}

function MetricCard({
  metric,
}: {
  metric: Metric;
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
          {metric.label}
        </p>

        <span className="h-2 w-2 shrink-0 rounded-full bg-sky-500" />
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

function NoticeList({
  notices,
}: {
  notices: Notice[];
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
            Communication
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
              No active notices
            </p>

            <p className="mt-1 text-xs text-slate-400">
              Institutional notices will appear here when published.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

function ActionPanel({
  actions,
  onOpen,
}: {
  actions: AdminAction[];
  onOpen: (href: string) => void;
}) {
  return (
    <section className="rounded-2xl border border-slate-900 bg-slate-950 p-5 text-white shadow-sm">
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
        Quick access
      </p>

      <h2 className="mt-1 text-lg font-black tracking-tight">
        Institutional actions
      </h2>

      <p className="mt-1 text-sm leading-6 text-slate-400">
        Open the most commonly used administrative workspaces.
      </p>

      <div className="mt-5 space-y-2">
        {actions.slice(0, 6).map((action) => (
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

function SectionSwitcher({
  active,
  onChange,
}: {
  active: AdminSection;
  onChange: (section: AdminSection) => void;
}) {
  const sections: Array<{
    id: AdminSection;
    label: string;
    icon: string;
  }> = [
    {
      id: "overview",
      label: "Overview",
      icon: "⌂",
    },
    {
      id: "students",
      label: "Students",
      icon: "♙",
    },
    {
      id: "faculty",
      label: "Faculty",
      icon: "♟",
    },
    {
      id: "academics",
      label: "Academics",
      icon: "▦",
    },
    {
      id: "finance",
      label: "Finance",
      icon: "₹",
    },
    {
      id: "operations",
      label: "Operations",
      icon: "⚒",
    },
    {
      id: "intelligence",
      label: "Intelligence",
      icon: "✦",
    },
  ];

  return (
    <div className="mb-6 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
      <div className="flex min-w-max gap-1">
        {sections.map((section) => {
          const isActive =
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
                isActive
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

function SectionActions({
  actions,
  onOpen,
}: {
  actions: AdminAction[];
  onOpen: (href: string) => void;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
          Available modules
        </p>

        <h2 className="mt-1 text-lg font-black tracking-tight text-slate-950">
          {actions.length} workspace
          {actions.length === 1
            ? ""
            : "s"}
        </h2>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {actions.map((action) => (
          <button
            key={action.href}
            type="button"
            onClick={() =>
              onOpen(action.href)
            }
            className="group rounded-xl border border-slate-200 bg-slate-50 p-4 text-left transition hover:border-slate-300 hover:bg-white hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20"
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
              {action.description}
            </p>
          </button>
        ))}
      </div>
    </section>
  );
}

function AdminLoadingState() {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="h-3 w-44 animate-pulse rounded bg-slate-200" />
        <div className="h-9 w-72 animate-pulse rounded-lg bg-slate-200" />
        <div className="h-4 w-[500px] max-w-full animate-pulse rounded bg-slate-100" />
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

export function AdminPortal() {
  const router = useRouter();

  const [data, setData] =
    useState<WorkspaceData | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [section, setSection] =
    useState<AdminSection>("overview");

  const loadWorkspace =
    useCallback(async () => {
      setLoading(true);
      setError("");

      try {
        const response =
          await authedFetch<{
            success: true;
            data: WorkspaceData;
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
            : "Unable to load the institution workspace.",
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
    () =>
      section === "overview"
        ? getActions()
        : getSectionActions(section),
    [section],
  );

  const sectionInfo =
    sectionConfig[section];

  const open = (href: string) => {
    router.push(href);
  };

  return (
    <DashboardShell
      title="Institution Admin"
      subtitle="Institution administration workspace"
      allowedRoles={[
        "INSTITUTION_ADMIN",
      ]}
    >
      <div className="mx-auto w-full max-w-7xl">
        {/* =====================================================
            INTRO
            ===================================================== */}
        <section className="mb-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                Institution administration · Control centre
              </p>

              <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
                {sectionInfo.title}
              </h1>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                {sectionInfo.description}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Workspace active
              </span>
            </div>
          </div>
        </section>

        {/* =====================================================
            SECTION SWITCHER
            ===================================================== */}
        <SectionSwitcher
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
                  Unable to load institution data
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
            KPI AREA
            ===================================================== */}
        {section === "overview" ? (
          <>
            <section aria-label="Institution statistics">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {loading
                  ? Array.from({
                      length: 4,
                    }).map((_, index) => (
                      <MetricSkeleton
                        key={index}
                      />
                    ))
                  : metrics
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
                {loading
                  ? Array.from({
                      length: 4,
                    }).map((_, index) => (
                      <MetricSkeleton
                        key={index}
                      />
                    ))
                  : metrics
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
              <NoticeList
                notices={
                  data?.notices ?? []
                }
              />

              <ActionPanel
                actions={getActions()}
                onOpen={open}
              />
            </div>
          </>
        ) : (
          <div className="grid gap-5 xl:grid-cols-[1.35fr_1fr]">
            <SectionActions
              actions={actions}
              onOpen={open}
            />

            <ActionPanel
              actions={actions}
              onOpen={open}
            />
          </div>
        )}

        {/* =====================================================
            FOOTER STATUS
            ===================================================== */}
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-bold text-slate-800">
                ACADLYX Institution Admin
              </p>

              <p className="mt-1 text-xs leading-5 text-slate-400">
                Administrative access is controlled by your
                authenticated institution role.
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
