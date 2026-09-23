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
} from "@/lib/auth";

import {
  AdminWorkspace,
  getAdminWorkspace,
} from "@/lib/adminApi";

type Module = {
  key: string;
  label: string;
  description: string;
  icon: string;
  href?: string;
  actions?: string[];
};

const MODULES: Module[] = [
  {
    key: "users",
    label: "People & access",
    description:
      "Create institution-scoped accounts, maintain access status and keep the people directory current.",
    icon: "♙",
    href: "/user-management",
    actions: [
      "Create people",
      "Edit account details",
      "Activate / deactivate",
      "Edit profile pictures",
    ],
  },

  {
    key: "students",
    label: "Student administration",
    description:
      "Manage student identities and student records within your institution.",
    icon: "◎",
    href: "/admissions",
    actions: [
      "Create students through the student workflow",
      "Update student records",
    ],
  },

  {
    key: "academicStructure",
    label: "Academic structure",
    description:
      "Institution-level academic master data: departments, programs, academic years, semesters, sections, courses and course offerings.",
    icon: "▦",
    actions: [
      "Create",
      "Update",
      "Deactivate where authorized",
      "Maintain academic structure",
    ],
  },

  {
    key: "campuses",
    label: "Campuses",
    description:
      "Maintain the institution's campus records and campus metadata.",
    icon: "⌂",
    actions: [
      "Create",
      "Update",
      "Deactivate",
    ],
  },

  {
    key: "timetable",
    label: "Timetable",
    description:
      "Manage institutional timetable entries and scheduling changes.",
    icon: "◷",
    href: "/timetable",
    actions: [
      "View",
      "Create",
      "Update",
      "Delete",
    ],
  },

  {
    key: "notices",
    label: "Notices",
    description:
      "Publish and manage institution communications.",
    icon: "◌",
    href: "/notices",
    actions: [
      "View",
      "Publish",
      "Update",
      "Delete",
    ],
  },

  {
    key: "admissions",
    label: "Admissions visibility",
    description:
      "View admission applications. Processing authority is not granted by this role.",
    icon: "↗",
    href: "/admissions",
    actions: [
      "View admission data",
    ],
  },

  {
    key: "reports",
    label: "Reports",
    description:
      "Access institution-level reports available to the administrative role.",
    icon: "▤",
    href: "/reports",
    actions: [
      "View reports",
    ],
  },

  {
    key: "intelligence",
    label: "Institution intelligence",
    description:
      "View institution-level intelligence because this capability is explicitly granted to Institution Admin.",
    icon: "✦",
    href: "/intelligence",
    actions: [
      "View intelligence",
    ],
  },

  {
    key: "parentLinks",
    label: "Parent links",
    description:
      "Manage parent-student relationship links inside the institution.",
    icon: "♧",
    actions: [
      "View links",
      "Create / manage links",
    ],
  },

  {
    key: "notifications",
    label: "Notifications",
    description:
      "Manage institution notifications and notification delivery within scope.",
    icon: "◉",
    href: "/notifications",
    actions: [
      "View",
      "Manage",
    ],
  },

  {
    key: "documents",
    label: "Documents",
    description:
      "Manage institution-scoped documents where the role has document authority.",
    icon: "▱",
    actions: [
      "View",
      "Upload",
      "Remove",
    ],
  },

  {
    key: "calendar",
    label: "Calendar",
    description:
      "Manage institution calendar information.",
    icon: "◫",
    href: "/calendar",
    actions: [
      "View",
      "Create / manage",
    ],
  },

  {
    key: "registration",
    label: "Course registration",
    description:
      "View registration information without receiving registration approval authority.",
    icon: "✓",
    href: "/course-registration",
    actions: [
      "View registration",
    ],
  },

  {
    key: "promotions",
    label: "Student promotions",
    description:
      "View promotion/movement information. Approval authority is not granted here.",
    icon: "↑",
    href: "/student-promotion",
    actions: [
      "View promotion data",
    ],
  },

  {
    key: "certificates",
    label: "Certificates",
    description:
      "View certificate information available within the institution scope.",
    icon: "▣",
    href: "/certificates",
    actions: [
      "View",
    ],
  },

  {
    key: "audit",
    label: "Audit",
    description:
      "Review institution audit information for accountability and operational traceability.",
    icon: "⌁",
    href: "/reports",
    actions: [
      "View audit information",
    ],
  },

  {
    key: "operations",
    label: "Operations",
    description:
      "Use the operational controls explicitly granted to Institution Admin.",
    icon: "⚙",
    href: "/operations",
    actions: [
      "View",
      "Manage",
    ],
  },

  {
    key: "maintenance",
    label: "Maintenance",
    description:
      "Raise maintenance/support requests without gaining platform administration authority.",
    icon: "⌘",
    href: "/operations",
    actions: [
      "Raise request",
    ],
  },
];

const METRICS = [
  [
    "users",
    "People",
    "All institution accounts",
  ],
  [
    "students",
    "Students",
    "Active student accounts",
  ],
  [
    "faculty",
    "Faculty",
    "Active faculty accounts",
  ],
  [
    "departments",
    "Departments",
    "Active departments",
  ],
  [
    "programs",
    "Programs",
    "Active programs",
  ],
  [
    "sections",
    "Sections",
    "Active sections",
  ],
  [
    "courses",
    "Courses",
    "Active courses",
  ],
  [
    "offerings",
    "Course offerings",
    "Active offerings",
  ],
  [
    "campuses",
    "Campuses",
    "Active campuses",
  ],
  [
    "usersMissingProfilePhoto",
    "Photos missing",
    "People who still need a profile picture",
  ],
] as const;

export function AdminPortal() {
  const router =
    useRouter();

  const [
    workspace,
    setWorkspace,
  ] =
    useState<AdminWorkspace | null>(
      null
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

  const load =
    useCallback(
      async () => {
        setLoading(
          true
        );
        setError("");

        try {
          setWorkspace(
            await getAdminWorkspace()
          );
        } catch (
          reason
        ) {
          if (
            reason instanceof
            AuthRequiredError
          ) {
            router.replace(
              "/login"
            );
          } else {
            setError(
              reason instanceof
                Error
                ? reason.message
                : "Unable to load the administration workspace."
            );
          }
        } finally {
          setLoading(
            false
          );
        }
      },
      [router]
    );

  useEffect(() => {
    void load();
  }, [load]);

  const visibleModules =
    useMemo(() => {
      if (!workspace) {
        return [];
      }

      return MODULES.filter(
        (module) =>
          workspace.modules[
            module.key
          ] === true
      );
    }, [workspace]);

  return (
    <DashboardShell
      title="Institution Admin"
      subtitle="Institution administration, people and configuration"
      allowedRoles={[
        "INSTITUTION_ADMIN",
      ]}
    >
      <main className="mx-auto max-w-7xl space-y-6">
        <section className="overflow-hidden rounded-3xl bg-slate-950 p-7 text-white shadow-sm sm:p-9">
          <div className="max-w-4xl">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-indigo-300">
              Institution
              administration
            </p>

            <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
              Your institution.
              Your people.
              Your structure.
            </h1>

            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300 sm:text-base">
              This workspace is
              generated from the
              Institution Admin's
              actual backend
              permissions.
              Operational areas
              such as fees,
              assignments,
              examinations,
              results and
              attendance
              operations are
              deliberately
              absent.
            </p>

            <div className="mt-6 flex flex-wrap gap-2">
              <Link
                href="/user-management"
                className="rounded-xl bg-white px-4 py-2.5 text-sm font-black text-slate-950 hover:bg-slate-100"
              >
                + Add people
              </Link>

              <Link
                href="/account-security"
                className="rounded-xl border border-white/15 bg-white/10 px-4 py-2.5 text-sm font-bold text-white hover:bg-white/15"
              >
                Account security
              </Link>
            </div>
          </div>
        </section>

        {error && (
          <div
            role="alert"
            className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700"
          >
            {error}

            <button
              onClick={() =>
                void load()
              }
              className="ml-3 font-black underline"
            >
              Retry
            </button>
          </div>
        )}

        <section>
          <div className="mb-4">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
              Institution snapshot
            </p>

            <h2 className="mt-1 text-xl font-black tracking-tight text-slate-950">
              Administrative
              structure
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Only metrics backed by
              the Institution
              Admin's granted read
              permissions are
              loaded.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {METRICS.map(
              ([
                key,
                label,
                description,
              ]) => (
                <article
                  key={key}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">
                    {label}
                  </p>

                  <p className="mt-3 text-3xl font-black text-slate-950">
                    {loading
                      ? "…"
                      : workspace
                          ?.stats[
                            key
                          ] ??
                        0}
                  </p>

                  <p className="mt-1 text-xs text-slate-500">
                    {description}
                  </p>
                </article>
              )
            )}
          </div>
        </section>

        <section>
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-indigo-500">
                Authorized modules
              </p>

              <h2 className="mt-1 text-xl font-black tracking-tight text-slate-950">
                What Institution
                Admin can access
              </h2>
            </div>

            <p className="hidden text-xs font-semibold text-slate-400 sm:block">
              Permission-driven ·
              tenant-scoped
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {visibleModules.map(
              (module) => {
                const body = (
                  <article className="group h-full rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md">
                    <div className="flex items-start gap-4">
                      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-slate-950 text-lg font-black text-white">
                        {module.icon}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-black text-slate-950">
                            {module.label}
                          </h3>

                          {module.href && (
                            <span className="text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-indigo-600">
                              →
                            </span>
                          )}
                        </div>

                        <p className="mt-2 text-sm leading-6 text-slate-500">
                          {
                            module.description
                          }
                        </p>

                        <div className="mt-4 flex flex-wrap gap-1.5">
                          {module.actions?.map(
                            (
                              action
                            ) => (
                              <span
                                key={
                                  action
                                }
                                className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-600"
                              >
                                {
                                  action
                                }
                              </span>
                            )
                          )}
                        </div>
                      </div>
                    </div>
                  </article>
                );

                return module.href ? (
                  <Link
                    key={
                      module.key
                    }
                    href={
                      module.href
                    }
                  >
                    {body}
                  </Link>
                ) : (
                  <div
                    key={
                      module.key
                    }
                  >
                    {body}
                  </div>
                );
              }
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
            Explicitly outside
            this workspace
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            {[
              "Fees",
              "Assignments",
              "Exams",
              "Results",
              "Attendance operations",
              "HR operations",
              "Library operations",
              "Payroll",
              "Platform administration",
            ].map(
              (item) => (
                <span
                  key={item}
                  className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-500"
                >
                  {item}
                </span>
              )
            )}
          </div>
        </section>
      </main>
    </DashboardShell>
  );
}
