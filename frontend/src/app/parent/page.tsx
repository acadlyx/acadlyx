"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { InstitutionLogo } from "@/components/branding/InstitutionLogo";
import {
  AuthRequiredError,
  isAuthenticated,
  logout,
} from "@/lib/auth";
import {
  getParentDashboard,
  ParentDashboardData,
} from "@/lib/portalApi";

type ViewState = "loading" | "ready" | "error";

function percentage(value: number): string {
  return `${Number(value || 0).toFixed(1)}%`;
}

function currency(value: number): string {
  return `₹${Number(value || 0).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  })}`;
}

function dateLabel(value: string | null | undefined): string {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function ParentDashboardPage() {
  const router = useRouter();

  const [state, setState] =
    useState<ViewState>("loading");

  const [data, setData] =
    useState<ParentDashboardData | null>(null);

  const [errorMessage, setErrorMessage] =
    useState("");

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace("/login");
      return;
    }

    let mounted = true;

    getParentDashboard()
      .then((result) => {
        if (!mounted) return;

        setData(result);
        setState("ready");
      })
      .catch((error: Error) => {
        if (!mounted) return;

        if (error instanceof AuthRequiredError) {
          router.replace("/login");
          return;
        }

        setErrorMessage(
          error.message || "Unable to load parent portal."
        );

        setState("error");
      });

    return () => {
      mounted = false;
    };
  }, [router]);

  async function handleLogout() {
    await logout();
    router.replace("/login");
  }

  const totals = useMemo(() => {
    if (!data) {
      return {
        children: 0,
        unreadNotifications: 0,
        outstandingFees: 0,
        assignments: 0,
      };
    }

    let outstandingFees = 0;
    let unreadNotifications = 0;
    let assignments = 0;

    for (const child of data.children) {
      outstandingFees += child.fees.reduce(
        (sum, invoice) => sum + invoice.balance,
        0
      );

      unreadNotifications += child.notifications.unread;

      assignments += child.assignments.filter(
        (assignment) =>
          !assignment.submission || assignment.overdue
      ).length;
    }

    return {
      children: data.children.length,
      unreadNotifications,
      outstandingFees,
      assignments,
    };
  }, [data]);

  if (state === "loading") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-slate-700" />
          <p className="mt-3 text-sm text-slate-500">
            Loading parent portal…
          </p>
        </div>
      </main>
    );
  }

  if (state === "error" || !data) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-lg rounded-2xl border border-red-200 bg-white p-6 text-center shadow-sm">
          <p className="text-sm font-semibold text-red-600">
            Parent portal could not be loaded
          </p>

          <p className="mt-2 text-sm text-slate-500">
            {errorMessage}
          </p>

          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            Try again
          </button>
        </div>
      </main>
    );
  }

  return (
    <DashboardShell title="Parent Workspace" subtitle="Your child’s academic progress" allowedRoles={["PARENT"]}><div className="min-h-full rounded-3xl bg-slate-50 pb-16 shadow-sm ring-1 ring-slate-200/70">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
              ACADLYX
            </p>

            <h1 className="mt-1 text-lg font-bold text-slate-900">
              Parent Portal
            </h1>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            Sign out
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <section className="rounded-3xl bg-slate-950 p-6 text-white shadow-sm sm:p-8">
          <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <div>
              <p className="text-sm font-medium text-slate-400">
                Welcome back
              </p>

              <h2 className="mt-2 text-3xl font-bold tracking-tight">
                {data.parent.firstName}{" "}
                {data.parent.lastName}
              </h2>

              <p className="mt-2 text-sm text-slate-400">
                Monitor your children&apos;s academic
                progress, attendance, results, fees and
                institutional communication.
              </p>
            </div>

            <div className="rounded-2xl bg-white/10 px-5 py-4">
              <p className="text-xs uppercase tracking-wider text-slate-400">
                Linked children
              </p>

              <p className="mt-1 text-3xl font-bold">
                {totals.children}
              </p>
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <DashboardCard title="Children">
            <p className="text-3xl font-bold text-slate-900">
              {totals.children}
            </p>

            <p className="mt-1 text-xs text-slate-500">
              Linked student accounts
            </p>
          </DashboardCard>

          <DashboardCard title="Outstanding Fees">
            <p className="text-3xl font-bold text-slate-900">
              {currency(totals.outstandingFees)}
            </p>

            <p className="mt-1 text-xs text-slate-500">
              Across linked children
            </p>
          </DashboardCard>

          <DashboardCard title="Pending Assignments">
            <p className="text-3xl font-bold text-slate-900">
              {totals.assignments}
            </p>

            <p className="mt-1 text-xs text-slate-500">
              Missing or overdue submissions
            </p>
          </DashboardCard>

          <DashboardCard title="Unread Notifications">
            <p className="text-3xl font-bold text-slate-900">
              {totals.unreadNotifications}
            </p>

            <p className="mt-1 text-xs text-slate-500">
              Academic and institutional updates
            </p>
          </DashboardCard>
        </section>

        <div className="mt-8 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
              Family academic workspace
            </p>

            <h2 className="mt-1 text-2xl font-bold text-slate-900">
              Your Children
            </h2>
          </div>

          <Link
            href="/"
            className="hidden text-sm font-medium text-slate-500 hover:text-slate-900 sm:block"
          >
            ACADLYX Home →
          </Link>
        </div>

        {data.children.length === 0 ? (
          <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
            <p className="font-semibold text-slate-700">
              No student is linked to this parent account.
            </p>

            <p className="mt-2 text-sm text-slate-500">
              Ask the institution administrator to create
              or verify the parent-student relationship.
            </p>
          </div>
        ) : (
          <div className="mt-5 grid gap-5 xl:grid-cols-2">
            {data.children.map((child) => {
              const attendance =
                child.attendance.percentage;

              const pendingAssignments =
                child.assignments.filter(
                  (assignment) =>
                    !assignment.submission ||
                    assignment.overdue
                ).length;

              const outstandingFees =
                child.fees.reduce(
                  (sum, invoice) =>
                    sum + invoice.balance,
                  0
                );

              const publishedResults =
                child.exams.filter(
                  (exam) => exam.result !== null
                ).length;

              return (
                <article
                  key={child.student.id}
                  className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"
                >
                  <div className="border-b border-slate-100 p-6">
                    <div className="flex flex-col justify-between gap-4 sm:flex-row">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                          Student
                        </p>

                        <h3 className="mt-1 text-xl font-bold text-slate-900">
                          {child.student.firstName}{" "}
                          {child.student.lastName}
                        </h3>

                        <p className="mt-1 text-sm text-slate-500">
                          {child.student.email}
                        </p>

                        {child.student.profile
                          ?.admissionNumber && (
                          <p className="mt-2 text-xs font-medium text-slate-500">
                            Admission No:{" "}
                            {
                              child.student.profile
                                .admissionNumber
                            }
                          </p>
                        )}
                      </div>

                      <Link
                        href={`/parent/students/${child.student.id}`}
                        className="inline-flex h-fit items-center justify-center rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
                      >
                        Open Portal →
                      </Link>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-px bg-slate-100 sm:grid-cols-4">
                    <div className="bg-white p-4">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        Attendance
                      </p>

                      <p className="mt-1 text-xl font-bold text-slate-900">
                        {percentage(attendance)}
                      </p>
                    </div>

                    <div className="bg-white p-4">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        Assignments
                      </p>

                      <p className="mt-1 text-xl font-bold text-slate-900">
                        {pendingAssignments}
                      </p>
                    </div>

                    <div className="bg-white p-4">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        Fees
                      </p>

                      <p className="mt-1 text-xl font-bold text-slate-900">
                        {currency(outstandingFees)}
                      </p>
                    </div>

                    <div className="bg-white p-4">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        Results
                      </p>

                      <p className="mt-1 text-xl font-bold text-slate-900">
                        {publishedResults}
                      </p>
                    </div>
                  </div>

                  <div className="p-6">
                    <div className="flex flex-wrap gap-2">
                      <Link
                        href={`/parent/students/${child.student.id}#attendance`}
                        className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                      >
                        Attendance
                      </Link>

                      <Link
                        href={`/parent/students/${child.student.id}#marks`}
                        className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                      >
                        Marks
                      </Link>

                      <Link
                        href={`/parent/students/${child.student.id}#assignments`}
                        className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                      >
                        Assignments
                      </Link>

                      <Link
                        href={`/parent/students/${child.student.id}#fees`}
                        className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                      >
                        Fees
                      </Link>

                      <Link
                        href={`/parent/students/${child.student.id}#documents`}
                        className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                      >
                        Documents
                      </Link>
                    </div>

                    {child.enrollment && (
                      <div className="mt-5 rounded-xl bg-slate-50 p-4">
                        <div className="grid gap-3 sm:grid-cols-3">
                          <div>
                            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                              Program
                            </p>

                            <p className="mt-1 text-sm font-semibold text-slate-800">
                              {child.enrollment.program.name}
                            </p>
                          </div>

                          <div>
                            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                              Semester
                            </p>

                            <p className="mt-1 text-sm font-semibold text-slate-800">
                              {
                                child.enrollment.section
                                  ?.semester.name
                              }
                            </p>
                          </div>

                          <div>
                            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                              Section
                            </p>

                            <p className="mt-1 text-sm font-semibold text-slate-800">
                              {child.enrollment.section
                                ?.name ?? "—"}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}

        <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <h2 className="font-semibold text-slate-900">
                Parent account
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                {data.parent.email}
                {data.parent.phone
                  ? ` · ${data.parent.phone}`
                  : ""}
              </p>
            </div>

            <p className="text-xs text-slate-400">
              ACADLYX secure family workspace
            </p>
          </div>
        </section>
      </div>
    </div></DashboardShell>
  );
}
