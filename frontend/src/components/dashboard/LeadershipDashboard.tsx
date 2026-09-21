"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import {
  authedFetch,
  AuthRequiredError,
} from "@/lib/auth";
import { DashboardShell } from "@/components/dashboard/DashboardShell";

type LeadershipRole =
  | "CHAIRMAN"
  | "DIRECTOR"
  | "DEAN"
  | "REGISTRAR";

type WorkspaceStats = Record<string, number>;

type Notice = {
  id: string;
  title: string;
  body: string;
};

type WorkspaceResponse = {
  workspaceType: string;
  stats: WorkspaceStats;
  notices: Notice[];
};

type DashboardAction = {
  label: string;
  description: string;
  href: string;
  permissions: string[];
};

type RoleMeta = {
  title: string;
  subtitle: string;
  eyebrow: string;
  description: string;
  stats: Array<{
    key: string;
    label: string;
  }>;
  actions: DashboardAction[];
};

const ROLE_META: Record<LeadershipRole, RoleMeta> = {
  CHAIRMAN: {
    title: "Chairman Dashboard",
    subtitle: "Executive oversight and institutional intelligence",
    eyebrow: "Executive leadership",
    description:
      "Review institution-wide performance indicators, financial visibility and strategic reports without entering operational workflows that belong to specialist teams.",
    stats: [
      { key: "students", label: "Students" },
      { key: "faculty", label: "Faculty" },
      { key: "departments", label: "Departments" },
      { key: "totalInvoiced", label: "Invoiced" },
      { key: "paidInvoices", label: "Paid invoices" },
      { key: "examResults", label: "Exam results" },
    ],
    actions: [
      {
        label: "Institution intelligence",
        description: "Review institutional KPIs and available strategic indicators.",
        href: "/intelligence",
        permissions: ["intelligence.read"],
      },
      {
        label: "Reports",
        description: "Review reports available to executive oversight.",
        href: "/reports",
        permissions: ["reports.read"],
      },
      {
        label: "Financial overview",
        description: "Review financial information without entering Accounts operations.",
        href: "/fees",
        permissions: ["fees.read"],
      },
      {
        label: "Examination overview",
        description: "Review examination and result information available to management.",
        href: "/examinations",
        permissions: ["exams.read", "results.read"],
      },
    ],
  },

  DIRECTOR: {
    title: "Director Dashboard",
    subtitle: "Institution-wide academic and operational oversight",
    eyebrow: "Institution leadership",
    description:
      "Monitor institution performance and move into authorized academic, admissions, registration and operational workflows.",
    stats: [
      { key: "students", label: "Students" },
      { key: "faculty", label: "Faculty" },
      { key: "departments", label: "Departments" },
      { key: "courses", label: "Courses" },
      { key: "exams", label: "Exams" },
      { key: "examResults", label: "Exam results" },
    ],
    actions: [
      {
        label: "Institution intelligence",
        description: "Review institution-wide performance and risk indicators.",
        href: "/intelligence",
        permissions: ["intelligence.read"],
      },
      {
        label: "Admissions",
        description: "Review or operate admissions workflows assigned to Director authority.",
        href: "/admissions",
        permissions: ["admissions.manage"],
      },
      {
        label: "Registration",
        description: "Review authorized registration approvals.",
        href: "/course-registration",
        permissions: ["registration.read", "registration.approve"],
      },
      {
        label: "Student movement",
        description: "Review promotion and movement workflows assigned to Director authority.",
        href: "/student-promotion",
        permissions: ["promotions.read", "promotions.approve"],
      },
      {
        label: "Examinations",
        description: "Review examination approvals and official academic processing.",
        href: "/examinations",
        permissions: ["exams.read", "exams.approve"],
      },
      {
        label: "Operations",
        description: "Review institution operational services.",
        href: "/operations",
        permissions: ["operations.read"],
      },
    ],
  },

  DEAN: {
    title: "Dean Dashboard",
    subtitle: "Academic leadership, performance and school operations",
    eyebrow: "Academic leadership",
    description:
      "Review academic indicators and open the academic workflows permitted to the Dean role. School-specific record access must remain enforced by the underlying APIs.",
    stats: [
      { key: "students", label: "Students" },
      { key: "faculty", label: "Faculty" },
      { key: "departments", label: "Departments" },
      { key: "courses", label: "Courses" },
      { key: "assignments", label: "Assignments" },
      { key: "exams", label: "Exams" },
    ],
    actions: [
      {
        label: "Academic intelligence",
        description: "Review academic performance and available institutional indicators.",
        href: "/intelligence",
        permissions: ["intelligence.read"],
      },
      {
        label: "Students",
        description: "Open student information available to your authorized scope.",
        href: "/students",
        permissions: ["students.read"],
      },
      {
        label: "Examinations",
        description: "Review examination and result information.",
        href: "/examinations",
        permissions: ["exams.read", "results.read"],
      },
      {
        label: "Registration",
        description: "Review authorized registration workflows.",
        href: "/course-registration",
        permissions: ["registration.read", "registration.approve"],
      },
      {
        label: "Student movement",
        description: "Review authorized promotion and transfer workflows.",
        href: "/student-promotion",
        permissions: ["promotions.read", "promotions.approve"],
      },
      {
        label: "Academic calendar",
        description: "Review academic dates and institution events.",
        href: "/calendar",
        permissions: ["calendar.read"],
      },
    ],
  },

  REGISTRAR: {
    title: "Registrar Dashboard",
    subtitle: "Official registration, student lifecycle and academic records",
    eyebrow: "Academic records authority",
    description:
      "Manage the official academic-record workflows assigned to the Registrar role, while specialist financial, HR and technical operations remain outside this workspace.",
    stats: [
      { key: "students", label: "Students" },
      { key: "departments", label: "Departments" },
      { key: "programs", label: "Programs" },
      { key: "courses", label: "Courses" },
      { key: "offerings", label: "Offerings" },
      { key: "examResults", label: "Exam results" },
    ],
    actions: [
      {
        label: "Enrollment",
        description: "Open authorized enrollment and student-lifecycle workflows.",
        href: "/enrollment",
        permissions: ["registration.manage", "students.update"],
      },
      {
        label: "Course registration",
        description: "Review and process official registration workflows.",
        href: "/course-registration",
        permissions: ["registration.read", "registration.approve"],
      },
      {
        label: "Student movement",
        description: "Manage authorized promotion and transfer workflows.",
        href: "/student-promotion",
        permissions: ["promotions.read", "promotions.manage"],
      },
      {
        label: "Certificates",
        description: "Issue authorized academic certificates and records.",
        href: "/certificates",
        permissions: ["certificates.read", "certificates.issue"],
      },
      {
        label: "Examination records",
        description: "Review examination and result records.",
        href: "/examinations",
        permissions: ["exams.read", "results.read"],
      },
      {
        label: "Academic masters",
        description: "Open the academic administration area available to your role.",
        href: "/erp",
        permissions: ["academic-masters.read", "students.read"],
      },
    ],
  },
};

function formatValue(value: number | undefined, key: string): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "0";
  }

  if (key === "totalInvoiced") {
    return `₹${value.toLocaleString("en-IN", {
      maximumFractionDigits: 2,
    })}`;
  }

  return value.toLocaleString("en-IN");
}

function StatCard({
  label,
  value,
  keyName,
}: {
  label: string;
  value: number | undefined;
  keyName: string;
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
        {label}
      </p>
      <p className="mt-2 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
        {formatValue(value, keyName)}
      </p>
    </article>
  );
}

export function LeadershipDashboard({
  role,
}: {
  role: LeadershipRole;
}) {
  const router = useRouter();
  const meta = ROLE_META[role];

  const [workspace, setWorkspace] = useState<WorkspaceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    setLoading(true);
    setError("");

    authedFetch<{
      success: true;
      data: WorkspaceResponse;
    }>("/erp/me/workspace")
      .then((response) => {
        if (mounted) {
          setWorkspace(response.data);
        }
      })
      .catch((requestError) => {
        if (!mounted) {
          return;
        }

        if (requestError instanceof AuthRequiredError) {
          router.replace("/login");
          return;
        }

        setError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to load leadership workspace.",
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

  const actions = useMemo(() => meta.actions, [meta.actions]);

  return (
    <DashboardShell
      title={meta.title}
      subtitle={meta.subtitle}
      allowedRoles={[role]}
    >
      <div className="mx-auto w-full max-w-7xl space-y-6">
        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-slate-800 px-6 py-8 text-white sm:px-8">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-sky-300">
              {meta.eyebrow}
            </p>
            <h1 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">
              {meta.title}
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
              {meta.description}
            </p>
          </div>
        </section>

        {error ? (
          <section className="rounded-2xl border border-red-200 bg-red-50 p-5">
            <p className="text-sm font-bold text-red-900">
              Leadership data could not be loaded
            </p>
            <p className="mt-1 text-sm leading-6 text-red-700">{error}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-4 rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-bold text-red-700"
            >
              Retry
            </button>
          </section>
        ) : null}

        <section aria-label="Leadership statistics">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {loading
              ? Array.from({ length: meta.stats.length }).map((_, index) => (
                  <div
                    key={index}
                    className="h-[112px] animate-pulse rounded-2xl border border-slate-200 bg-white"
                  />
                ))
              : meta.stats.map((stat) => (
                  <StatCard
                    key={stat.key}
                    keyName={stat.key}
                    label={stat.label}
                    value={workspace?.stats?.[stat.key]}
                  />
                ))}
          </div>
        </section>

        <section className="grid gap-5 xl:grid-cols-[1.35fr_1fr]">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                Authorized workspace
              </p>
              <h2 className="mt-1 text-xl font-black tracking-tight text-slate-950">
                Leadership actions
              </h2>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                Only actions represented by this leadership role belong in this workspace.
              </p>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {actions.map((action) => (
                <button
                  key={action.href}
                  type="button"
                  onClick={() => router.push(action.href)}
                  className="group rounded-xl border border-slate-200 bg-slate-50 p-4 text-left transition hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white hover:shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">
                        {action.label}
                      </h3>
                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        {action.description}
                      </p>
                    </div>
                    <span className="text-slate-400 transition group-hover:translate-x-1">
                      →
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-900 bg-slate-950 p-5 text-white shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
              Institutional communication
            </p>
            <h2 className="mt-1 text-xl font-black tracking-tight">
              Current notices
            </h2>

            <div className="mt-5 space-y-3">
              {workspace?.notices?.length ? (
                workspace.notices.slice(0, 5).map((notice) => (
                  <article
                    key={notice.id}
                    className="rounded-xl border border-white/10 bg-white/[0.06] p-4"
                  >
                    <p className="text-sm font-bold text-white">{notice.title}</p>
                    <p className="mt-1 text-xs leading-5 text-slate-400">
                      {notice.body}
                    </p>
                  </article>
                ))
              ) : (
                <p className="rounded-xl border border-white/10 bg-white/[0.04] p-4 text-sm text-slate-400">
                  No active notices.
                </p>
              )}
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
          <p className="text-xs font-bold text-slate-800">
            ACADLYX leadership workspace
          </p>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            Dashboard visibility is role-based. Record-level access and workflow authority
            must still be enforced by the destination module and its backend authorization.
          </p>
        </section>
      </div>
    </DashboardShell>
  );
}
