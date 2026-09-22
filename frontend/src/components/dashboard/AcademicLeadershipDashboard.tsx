"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { DashboardShell } from "@/components/dashboard/DashboardShell";
import {
  AuthRequiredError,
  isAuthenticated,
} from "@/lib/auth";
import {
  getErpWorkspace,
  ErpWorkspace,
} from "@/lib/erpApi";
import { roleOwnsRoute } from "@/components/dashboard/roleRouteAccess";

export type AcademicLeadershipRole = "HOD";

type Notice = {
  id: string;
  title: string;
  body: string;
  publishedAt?: string;
};

type Person = {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
};

type Offering = {
  id: string;
  course?: {
    code?: string;
    name?: string;
  };
  section?: {
    name?: string;
  } | null;
  faculty?: {
    id?: string;
    firstName?: string;
    lastName?: string;
  } | null;
};

type Department = {
  departmentId?: string;
  id?: string;
  name?: string;
  code?: string;
};

function numberValue(
  stats: Record<string, number> | undefined,
  ...keys: string[]
) {
  for (const key of keys) {
    const value = stats?.[key];

    if (
      typeof value === "number" &&
      Number.isFinite(value)
    ) {
      return value;
    }
  }

  return 0;
}

function asPeople(value: unknown): Person[] {
  return Array.isArray(value)
    ? (value as Person[])
    : [];
}

function asOfferings(value: unknown): Offering[] {
  return Array.isArray(value)
    ? (value as Offering[])
    : [];
}

function asDepartments(value: unknown): Department[] {
  return Array.isArray(value)
    ? (value as Department[])
    : [];
}

function asNotices(value: unknown): Notice[] {
  return Array.isArray(value)
    ? (value as Notice[])
    : [];
}

function Stat({
  label,
  value,
  detail,
}: {
  label: string;
  value: number;
  detail: string;
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">
        {label}
      </p>

      <p className="mt-2 text-3xl font-black tracking-tight text-slate-950">
        {value.toLocaleString("en-IN")}
      </p>

      <p className="mt-2 text-xs leading-5 text-slate-500">
        {detail}
      </p>
    </article>
  );
}

function WorkspaceLink({
  href,
  label,
  className,
}: {
  href: string;
  label: string;
  className: string;
}) {
  return (
    <Link
      href={href}
      className={className}
    >
      {label}
    </Link>
  );
}

export function AcademicLeadershipDashboard({
  role,
}: {
  role: AcademicLeadershipRole;
}) {
  const router = useRouter();

  const [workspace, setWorkspace] =
    useState<ErpWorkspace | null>(null);

  const [error, setError] = useState("");

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace("/login");
      return;
    }

    let mounted = true;

    getErpWorkspace()
      .then((data) => {
        if (mounted) {
          setWorkspace(data);
        }
      })
      .catch((err: unknown) => {
        if (!mounted) {
          return;
        }

        if (err instanceof AuthRequiredError) {
          router.replace("/login");
          return;
        }

        setError(
          err instanceof Error
            ? err.message
            : "Unable to load the academic workspace.",
        );
      });

    return () => {
      mounted = false;
    };
  }, [router]);

  const stats = workspace?.stats ?? {};

  const faculty = asPeople(
    (
      workspace as unknown as {
        faculty?: unknown;
      } | null
    )?.faculty,
  );

  const students = asPeople(workspace?.students);

  const offerings = asOfferings(
    workspace?.facultyOfferings,
  );

  const departments = asDepartments(
    workspace?.departments,
  );

  const notices = asNotices(workspace?.notices);

  const departmentNames = useMemo(() => {
    return departments
      .map(
        (department) =>
          department.name ||
          department.code ||
          department.departmentId ||
          department.id,
      )
      .filter(Boolean) as string[];
  }, [departments]);

  const canOpenIntelligence = roleOwnsRoute(
    role,
    "/intelligence",
  );

  const canOpenRegistration = roleOwnsRoute(
    role,
    "/course-registration",
  );

  const canOpenTimetable = roleOwnsRoute(
    role,
    "/timetable",
  );

  const canOpenStudents = roleOwnsRoute(
    role,
    "/students",
  );

  if (!workspace && !error) {
    return (
      <DashboardShell
        title="HOD Workspace"
        subtitle="Department academic leadership"
        allowedRoles={[role]}
      >
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((item) => (
            <div
              key={item}
              className="h-32 animate-pulse rounded-2xl border border-slate-200 bg-white"
            />
          ))}
        </div>
      </DashboardShell>
    );
  }

  if (error) {
    return (
      <DashboardShell
        title="HOD Workspace"
        subtitle="Department academic leadership"
        allowedRoles={[role]}
      >
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
          <p className="font-semibold text-red-900">
            Academic workspace could not be loaded
          </p>

          <p className="mt-1 text-sm text-red-700">
            We could not load the information for this workspace.
          </p>

          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-4 rounded-xl border border-red-200 bg-white px-4 py-2 text-xs font-semibold text-red-700"
          >
            Retry
          </button>
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell
      title="HOD Workspace"
      subtitle="Department academic leadership, faculty coordination and student oversight"
      allowedRoles={[role]}
    >
      <div className="space-y-6">
        <section className="rounded-3xl bg-slate-950 p-6 text-white shadow-sm sm:p-8">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
            Department leadership
          </p>

          <div className="mt-3 flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <div>
              <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
                Academic operations under your scope
              </h1>

              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
                Review the departments assigned to you, coordinate
                faculty and course offerings, monitor students, and
                access only the workflows that belong to the HOD
                workspace.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {canOpenIntelligence ? (
                <WorkspaceLink
                  href="/intelligence"
                  label="Intelligence"
                  className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-slate-100"
                />
              ) : null}

              {canOpenRegistration ? (
                <WorkspaceLink
                  href="/course-registration"
                  label="Registrations"
                  className="rounded-xl border border-white/15 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/10"
                />
              ) : null}
            </div>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Stat
            label="Departments"
            value={numberValue(
              stats,
              "departments",
            )}
            detail="Departments within your configured HOD scope."
          />

          <Stat
            label="Students"
            value={numberValue(
              stats,
              "students",
            )}
            detail="Active students in your department scope."
          />

          <Stat
            label="Faculty"
            value={numberValue(
              stats,
              "faculty",
            )}
            detail="Faculty connected to scoped offerings."
          />

          <Stat
            label="Offerings"
            value={numberValue(
              stats,
              "offerings",
              "courses",
            )}
            detail="Active course offerings in scope."
          />

          <Stat
            label="Exams"
            value={numberValue(
              stats,
              "exams",
            )}
            detail="Exam records for scoped offerings."
          />
        </section>

        <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                  Faculty coordination
                </p>

                <h2 className="mt-1 text-xl font-bold text-slate-950">
                  Faculty in scope
                </h2>
              </div>

              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                {faculty.length}
              </span>
            </div>

            <div className="mt-5 divide-y divide-slate-100">
              {faculty.slice(0, 8).map((person) => (
                <div
                  key={person.id}
                  className="flex items-center justify-between gap-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">
                      {person.firstName} {person.lastName}
                    </p>

                    <p className="truncate text-xs text-slate-500">
                      {person.email ||
                        "Institution faculty"}
                    </p>
                  </div>

                  <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                    Active
                  </span>
                </div>
              ))}

              {faculty.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-500">
                  No faculty records are currently in
                  your scope.
                </p>
              ) : null}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
              Department scope
            </p>

            <h2 className="mt-1 text-xl font-bold text-slate-950">
              Assigned departments
            </h2>

            <div className="mt-5 space-y-2">
              {departmentNames.map((name) => (
                <div
                  key={name}
                  className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700"
                >
                  {name}
                </div>
              ))}

              {departmentNames.length === 0 ? (
                <p className="rounded-xl border border-dashed border-slate-200 p-5 text-sm text-slate-500">
                  No department scope has been configured
                  for this HOD account.
                </p>
              ) : null}
            </div>
          </section>
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                Academic delivery
              </p>

              <h2 className="mt-1 text-xl font-bold text-slate-950">
                Course offerings
              </h2>
            </div>

            {canOpenTimetable ? (
              <Link
                href="/timetable"
                className="text-sm font-semibold text-slate-700 hover:text-slate-950"
              >
                Timetable
              </Link>
            ) : null}
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {offerings.slice(0, 12).map((offering) => (
              <article
                key={offering.id}
                className="rounded-xl border border-slate-100 bg-slate-50 p-4"
              >
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                  {offering.course?.code ||
                    "Course"}
                </p>

                <h3 className="mt-1 font-semibold text-slate-900">
                  {offering.course?.name ||
                    "Unnamed course"}
                </h3>

                <p className="mt-2 text-xs text-slate-500">
                  Section{" "}
                  {offering.section?.name || "—"}
                </p>

                <p className="mt-1 text-xs text-slate-500">
                  Faculty:{" "}
                  {offering.faculty
                    ? `${offering.faculty.firstName || ""} ${offering.faculty.lastName || ""}`.trim()
                    : "Unassigned"}
                </p>
              </article>
            ))}

            {offerings.length === 0 ? (
              <p className="py-8 text-sm text-slate-500">
                No active course offerings are currently
                in scope.
              </p>
            ) : null}
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                  Student oversight
                </p>

                <h2 className="mt-1 text-xl font-bold text-slate-950">
                  Students in scope
                </h2>
              </div>

              {canOpenStudents ? (
                <Link
                  href="/students"
                  className="text-sm font-semibold text-slate-700 hover:text-slate-950"
                >
                  Open students
                </Link>
              ) : null}
            </div>

            <div className="mt-5 divide-y divide-slate-100">
              {students.slice(0, 8).map((student) => (
                <div
                  key={student.id}
                  className="py-3"
                >
                  <p className="text-sm font-semibold text-slate-900">
                    {student.firstName}{" "}
                    {student.lastName}
                  </p>

                  <p className="mt-1 text-xs text-slate-500">
                    {student.email ||
                      "Active student"}
                  </p>
                </div>
              ))}

              {students.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-500">
                  No active students are currently in
                  your department scope.
                </p>
              ) : null}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
              Communication
            </p>

            <h2 className="mt-1 text-xl font-bold text-slate-950">
              Current notices
            </h2>

            <div className="mt-5 space-y-3">
              {notices.map((notice) => (
                <article
                  key={notice.id}
                  className="rounded-xl border border-slate-100 bg-slate-50 p-4"
                >
                  <h3 className="text-sm font-semibold text-slate-900">
                    {notice.title}
                  </h3>

                  <p className="mt-1 text-sm leading-6 text-slate-500">
                    {notice.body}
                  </p>
                </article>
              ))}

              {notices.length === 0 ? (
                <p className="rounded-xl border border-dashed border-slate-200 p-5 text-sm text-slate-500">
                  No active notices are currently available.
                </p>
              ) : null}
            </div>
          </section>
        </div>
      </div>
    </DashboardShell>
  );
}
