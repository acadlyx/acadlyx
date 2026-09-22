"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useState,
} from "react";

import { AnnouncementList } from "@/components/dashboard/AnnouncementList";
import { AssignmentList } from "@/components/dashboard/AssignmentList";
import { ClassSchedule } from "@/components/dashboard/ClassSchedule";
import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { ProgressCard } from "@/components/dashboard/ProgressCard";
import { RecommendationCard } from "@/components/dashboard/RecommendationCard";
import { SectionHeader } from "@/components/dashboard/SectionHeader";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { riskTone, StatusBadge } from "@/components/dashboard/StatusBadge";

import {
  AuthRequiredError,
  getCurrentUser,
  isAuthenticated,
} from "@/lib/auth";

import { getMyDashboard } from "@/lib/studentApi";
import {
  StudentDashboardData,
} from "@/types/dashboard";

function greeting() {
  const hour =
    new Date().getHours();

  if (hour < 12)
    return "Good morning";

  if (hour < 17)
    return "Good afternoon";

  return "Good evening";
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="acadlyx-skeleton h-3 w-28 rounded-full" />
        <div className="acadlyx-skeleton mt-4 h-8 w-72 rounded-lg" />
        <div className="acadlyx-skeleton mt-3 h-4 w-96 max-w-full rounded-full" />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({
          length: 4,
        }).map((_, index) => (
          <div
            key={index}
            className="rounded-2xl border border-slate-200 bg-white p-5"
          >
            <div className="acadlyx-skeleton h-3 w-24 rounded-full" />
            <div className="acadlyx-skeleton mt-4 h-8 w-20 rounded-lg" />
            <div className="acadlyx-skeleton mt-3 h-3 w-32 rounded-full" />
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <div className="acadlyx-skeleton h-5 w-40 rounded" />
          <div className="acadlyx-skeleton mt-6 h-20 rounded-xl" />
          <div className="acadlyx-skeleton mt-3 h-20 rounded-xl" />
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <div className="acadlyx-skeleton h-5 w-40 rounded" />
          <div className="acadlyx-skeleton mt-6 h-20 rounded-xl" />
          <div className="acadlyx-skeleton mt-3 h-20 rounded-xl" />
        </div>
      </div>
    </div>
  );
}

function ErrorState({
  message,
  retry,
}: {
  message: string;
  retry: () => void;
}) {
  return (
    <div className="rounded-2xl border border-red-200 bg-white p-8 text-center shadow-sm">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-600">
        !
      </div>

      <h2 className="mt-4 text-lg font-bold text-slate-900">
        Workspace could not load
      </h2>

      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-500">
        {message ||
          "The server did not respond in time. Your session is still safe."}
      </p>

      <button
        type="button"
        onClick={retry}
        className="mt-5 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-blue-700"
      >
        Try again
      </button>
    </div>
  );
}

export default function StudentDashboardPage() {
  const router =
    useRouter();

  const [data, setData] =
    useState<StudentDashboardData | null>(
      null
    );

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  async function load() {
    setLoading(true);
    setError("");

    try {
      if (!isAuthenticated()) {
        router.replace("/login");
        return;
      }

      const dashboard =
        await getMyDashboard();

      setData(dashboard);
    } catch (err) {
      if (
        err instanceof AuthRequiredError
      ) {
        router.replace("/login");
        return;
      }

      setError(
        err instanceof Error
          ? err.message
          : "Unable to load your workspace."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <DashboardShell
      title="Student workspace"
      subtitle="Your classes, progress and next actions"
      allowedRoles={[
        "STUDENT",
      ]}
    >
      {loading && !data ? (
        <DashboardSkeleton />
      ) : error && !data ? (
        <ErrorState
          message={error}
          retry={load}
        />
      ) : data ? (
        <StudentDashboardContent
          data={data}
        />
      ) : null}
    </DashboardShell>
  );
}

function StudentDashboardContent({
  data,
}: {
  data: StudentDashboardData;
}) {
  const {
    student,
    program,
    section,
    todaysClasses,
    assignments,
    announcements,
    upcomingEvents,
    academicHealth,
    academicRisk,
    recommendations,
    attendancePercentage,
  } = data;

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-blue-600">
              Student workspace
            </p>

            <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
              {greeting()}, {student.firstName}
            </h1>

            <p className="mt-2 text-sm text-slate-500">
              {program?.name ||
                "No program on record"}
              {section
                ? ` · Semester ${section.semester.number} · Section ${section.name}`
                : ""}
            </p>
          </div>

          <Link
            href="/student/timetable"
            className="inline-flex w-fit items-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
          >
            View my week →
          </Link>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          label="Attendance"
          value={`${attendancePercentage}%`}
          detail="Overall attendance"
        />

        <Metric
          label="Assignments"
          value={String(
            assignments.length
          )}
          detail="Upcoming work"
        />

        <Metric
          label="Today's classes"
          value={String(
            todaysClasses.length
          )}
          detail="Scheduled today"
        />

        <Metric
          label="Academic health"
          value={`${Math.round(
            academicHealth.academicHealth ??
              0
          )}%`}
          detail={`${academicRisk} risk`}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.25fr_.75fr]">
        <DashboardCard
          title="Today's classes"
          action={
            <Link
              href="/student/timetable"
              className="text-xs font-bold text-blue-600 hover:text-blue-700"
            >
              Weekly timetable
            </Link>
          }
        >
          <ClassSchedule
            classes={
              todaysClasses
            }
          />
        </DashboardCard>

        <DashboardCard
          title="Assignments"
          action={
            <Link
              href="/student/assignments"
              className="text-xs font-bold text-blue-600 hover:text-blue-700"
            >
              View all
            </Link>
          }
        >
          <AssignmentList
            assignments={
              assignments
            }
          />
        </DashboardCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <DashboardCard title="Announcements">
          <AnnouncementList
            items={announcements.map(
              (item) => ({
                id: item.id,
                title: item.title,
                meta: item.postedLabel,
              })
            )}
            emptyLabel="No announcements right now."
          />
        </DashboardCard>

        <DashboardCard
          title="Upcoming exams"
          action={
            <Link
              href="/examinations"
              className="text-xs font-bold text-blue-600"
            >
              Open examinations
            </Link>
          }
        >
          <AnnouncementList
            items={upcomingEvents.map(
              (item) => ({
                id: item.id,
                title: item.title,
                meta: item.whenLabel,
              })
            )}
            emptyLabel="Nothing scheduled."
          />
        </DashboardCard>
      </div>

      <section>
        <SectionHeader
          title="Academic health"
          action={
            <StatusBadge
              tone={riskTone(
                academicRisk
              )}
            >
              {academicRisk} RISK
            </StatusBadge>
          }
        />

        <div className="grid gap-6 lg:grid-cols-[1.35fr_.65fr]">
          <DashboardCard>
            <div className="grid gap-5 sm:grid-cols-2">
              <ProgressCard
                label="Attendance"
                value={
                  academicHealth.attendance
                }
              />

              <ProgressCard
                label="Assignments"
                value={
                  academicHealth.assignments
                }
              />

              <ProgressCard
                label="Internal marks"
                value={
                  academicHealth.internalMarks
                }
              />

              <ProgressCard
                label="Engagement"
                value={
                  academicHealth.engagement
                }
              />
            </div>

            <Link
              href="/student/marks"
              className="mt-5 inline-flex text-xs font-bold text-blue-600 hover:text-blue-700"
            >
              View marks breakdown →
            </Link>
          </DashboardCard>

          <DashboardCard title="Next actions">
            <RecommendationCard
              recommendations={
                recommendations
              }
            />
          </DashboardCard>
        </div>
      </section>
    </div>
  );
}

function Metric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">
        {label}
      </p>

      <p className="mt-3 text-3xl font-bold tracking-tight text-slate-950">
        {value}
      </p>

      <p className="mt-1 text-xs text-slate-500">
        {detail}
      </p>
    </div>
  );
}
