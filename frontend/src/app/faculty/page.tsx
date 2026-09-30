"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useState,
} from "react";

import { AnnouncementList } from "@/components/dashboard/AnnouncementList";
import { ClassSchedule } from "@/components/dashboard/ClassSchedule";
import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { SectionHeader } from "@/components/dashboard/SectionHeader";

import { AttendanceOverviewList } from "@/components/faculty/AttendanceOverviewList";
import { PendingList } from "@/components/faculty/PendingList";
import { SmartInsightsList } from "@/components/faculty/SmartInsightsList";

import {
  AuthRequiredError,
  isAuthenticated,
  logout,
} from "@/lib/auth";

import {
  getMyFacultyDashboard,
} from "@/lib/facultyApi";

import {
  FacultyDashboardData,
} from "@/types/faculty";

type ViewState =
  | "loading"
  | "ready"
  | "error";

export default function FacultyDashboardPage() {
  const router = useRouter();

  const [state, setState] =
    useState<ViewState>("loading");

  const [data, setData] =
    useState<FacultyDashboardData | null>(
      null,
    );

  const [errorMessage, setErrorMessage] =
    useState("");

  const load = useCallback(async () => {
    if (!isAuthenticated()) {
      router.replace("/login");
      return;
    }

    setState("loading");
    setErrorMessage("");

    try {
      const dashboard =
        await getMyFacultyDashboard();

      setData(dashboard);
      setState("ready");
    } catch (err) {
      if (err instanceof AuthRequiredError) {
        router.replace("/login");
        return;
      }

      setErrorMessage(
        err instanceof Error
          ? err.message
          : "Unable to load your faculty dashboard.",
      );

      setState("error");
    }
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleLogout() {
    try {
      await logout();
    } finally {
      router.push("/login");
    }
  }

  if (state === "loading") {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-6">
        <div
          className="mx-auto w-full max-w-6xl space-y-4"
          aria-label="Loading faculty dashboard"
          aria-busy="true"
        >
          <div className="h-24 animate-pulse rounded-2xl bg-white" />

          <div className="grid gap-4 md:grid-cols-3">
            {[1, 2, 3].map((item) => (
              <div
                key={item}
                className="h-48 animate-pulse rounded-2xl bg-white"
              />
            ))}
          </div>

          <div className="h-64 animate-pulse rounded-2xl bg-white" />
        </div>
      </main>
    );
  }

  if (state === "error" || !data) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <section
          role="alert"
          className="w-full max-w-lg rounded-2xl border border-red-200 bg-white p-6 text-center shadow-sm"
        >
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-red-500">
            Dashboard unavailable
          </p>

          <h1 className="mt-2 text-xl font-bold text-slate-950">
            Couldn&apos;t load your dashboard
          </h1>

          <p className="mt-2 text-sm leading-6 text-slate-500">
            {errorMessage ||
              "An unexpected error occurred while loading the faculty workspace."}
          </p>

          <button
            type="button"
            onClick={() => void load()}
            className="mt-5 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2"
          >
            Retry
          </button>
        </section>
      </main>
    );
  }

  const {
    faculty,
    todaysClassCount,
    todaysClasses,
    attendanceOverview,
    pending,
    smartInsights,
  } = data;

  return (
    <DashboardShell
      title="Faculty Workspace"
      subtitle="Teaching, attendance and learner progress"
      allowedRoles={["FACULTY"]}
    >
      <div className="min-h-full rounded-3xl bg-slate-50 pb-16 shadow-sm ring-1 ring-slate-200/70">
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900">
                {faculty.firstName}{" "}
                {faculty.lastName}
              </p>

              <p className="text-xs text-slate-400">
                ACADLYX Faculty Portal
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-2 sm:gap-3">
              <Link
                href="/faculty/assignments"
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
              >
                Assignments
              </Link>

              <button
                type="button"
                onClick={() => void handleLogout()}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
              >
                Sign out
              </button>
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
          <section className="mb-6">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
              Teaching workspace
            </p>

            <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
              Faculty Dashboard
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              {todaysClassCount} class
              {todaysClassCount !== 1
                ? "es"
                : ""}{" "}
              today
            </p>
          </section>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            <DashboardCard title="Today&apos;s Classes">
              <ClassSchedule
                classes={todaysClasses.map(
                  (item) => ({
                    time: item.time,
                    courseCode:
                      item.courseCode,
                    courseName:
                      item.courseName,
                    location: `Section ${item.sectionName}`,
                  }),
                )}
              />
            </DashboardCard>

            <DashboardCard
              title="Attendance"
              className="md:col-span-2 lg:col-span-1"
            >
              <AttendanceOverviewList
                items={attendanceOverview}
              />
            </DashboardCard>

            <DashboardCard title="Pending">
              <PendingList pending={pending} />
            </DashboardCard>

            <DashboardCard
              title="Smart Insights"
              className="md:col-span-2 lg:col-span-3"
            >
              <SmartInsightsList
                insights={smartInsights}
              />
            </DashboardCard>
          </div>

          <div className="mt-8">
            <SectionHeader
              title="My Classes"
              subtitle="Your assigned course offerings"
            />

            {data.assignedCourseOfferings.length ===
            0 ? (
              <DashboardCard>
                <div className="py-6 text-center">
                  <p className="text-sm font-medium text-slate-700">
                    No classes assigned
                  </p>

                  <p className="mt-1 text-xs text-slate-400">
                    Your institution administrator or HOD needs to assign you to a course offering.
                  </p>
                </div>
              </DashboardCard>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {data.assignedCourseOfferings.map(
                  (offering) => (
                    <DashboardCard
                      key={offering.id}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                            {offering.course.code}
                          </p>

                          <h2 className="mt-1 truncate text-base font-semibold text-slate-900">
                            {offering.course.name}
                          </h2>

                          <div className="mt-2 space-y-1 text-xs text-slate-500">
                            <p>
                              Section{" "}
                              {
                                offering
                                  .section
                                  .name
                              }{" "}
                              · Semester{" "}
                              {
                                offering
                                  .semester
                                  .number
                              }
                            </p>

                            <p>
                              {
                                offering
                                  .semester
                                  .program
                                  .code
                              }{" "}
                              ·{" "}
                              {
                                offering
                                  .semester
                                  .academicYear
                                  .name
                              }
                            </p>
                          </div>
                        </div>

                        <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                          {offering.semester
                            .academicYear
                            .isCurrent
                            ? "Current"
                            : "Assigned"}
                        </span>
                      </div>

                      <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-3">
                        <Link
                          href={`/faculty/attendance/${offering.id}`}
                          className="rounded-lg border border-slate-200 px-2 py-2 text-center text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                        >
                          Attendance
                        </Link>

                        <Link
                          href={`/faculty/marks/${offering.id}`}
                          className="rounded-lg border border-slate-200 px-2 py-2 text-center text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                        >
                          Marks
                        </Link>

                        <Link
                          href={`/faculty/assignments?courseOfferingId=${offering.id}`}
                          className="rounded-lg border border-slate-200 px-2 py-2 text-center text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                        >
                          Assignments
                        </Link>
                      </div>
                    </DashboardCard>
                  ),
                )}
              </div>
            )}
          </div>

          <div className="mt-8">
            <SectionHeader
              title="At-Risk Students"
              subtitle="Below 75% attendance across your sections"
            />

            <DashboardCard>
              <AnnouncementList
                items={smartInsights.studentsBelowAttendanceThreshold.students.map(
                  (student) => ({
                    id: student.studentId,
                    title: student.name,
                    meta: `${student.percentage}% attendance`,
                  }),
                )}
                emptyLabel="No students below the attendance threshold."
              />
            </DashboardCard>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
