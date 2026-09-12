"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AnnouncementList } from "@/components/dashboard/AnnouncementList";
import { ClassSchedule } from "@/components/dashboard/ClassSchedule";
import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { SectionHeader } from "@/components/dashboard/SectionHeader";
import { AttendanceOverviewList } from "@/components/faculty/AttendanceOverviewList";
import { PendingList } from "@/components/faculty/PendingList";
import { SmartInsightsList } from "@/components/faculty/SmartInsightsList";
import { AuthRequiredError, isAuthenticated, logout } from "@/lib/auth";
import { getMyFacultyDashboard } from "@/lib/facultyApi";
import { FacultyDashboardData } from "@/types/faculty";

type ViewState = "loading" | "ready" | "error";

export default function FacultyDashboardPage() {
  const router = useRouter();
  const [state, setState] = useState<ViewState>("loading");
  const [data, setData] = useState<FacultyDashboardData | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace("/login");
      return;
    }

    let isMounted = true;
    getMyFacultyDashboard()
      .then((dashboard) => {
        if (!isMounted) return;
        setData(dashboard);
        setState("ready");
      })
      .catch((err: Error) => {
        if (!isMounted) return;
        if (err instanceof AuthRequiredError) {
          router.replace("/login");
          return;
        }
        setErrorMessage(err.message);
        setState("error");
      });

    return () => {
      isMounted = false;
    };
  }, [router]);

  async function handleLogout() {
    await logout();
    router.push("/login");
  }

  if (state === "loading") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-sm text-slate-400">Loading your dashboard…</p>
      </main>
    );
  }

  if (state === "error" || !data) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-50 px-4 text-center">
        <p className="text-sm font-medium text-red-600">Couldn&apos;t load your dashboard</p>
        <p className="text-sm text-slate-500">{errorMessage}</p>
      </main>
    );
  }

  const { faculty, todaysClassCount, todaysClasses, attendanceOverview, pending, smartInsights } = data;

  return (
    <main className="min-h-screen bg-slate-50 pb-16">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div>
            <p className="text-sm font-semibold text-slate-900">
              {faculty.firstName} {faculty.lastName}
            </p>
            <p className="text-xs text-slate-400">ACADLYX Faculty Portal</p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/faculty/assignments"
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              Assignments
            </Link>
            <button
              onClick={handleLogout}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-slate-900">Faculty Dashboard</h1>
          <p className="mt-1 text-sm text-slate-500">
            {todaysClassCount} class{todaysClassCount !== 1 ? "es" : ""} today
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          <DashboardCard title="Today's Classes">
            <ClassSchedule
              classes={todaysClasses.map((c) => ({
                time: c.time,
                courseCode: c.courseCode,
                courseName: c.courseName,
                location: `Section ${c.sectionName}`,
                isDemoSchedule: c.isDemoSchedule,
              }))}
            />
          </DashboardCard>

          <DashboardCard title="Attendance" className="md:col-span-2 lg:col-span-1">
            <AttendanceOverviewList items={attendanceOverview} />
          </DashboardCard>

          <DashboardCard title="Pending">
            <PendingList pending={pending} />
          </DashboardCard>

          <DashboardCard title="Smart Insights" className="md:col-span-2 lg:col-span-3">
            <SmartInsightsList insights={smartInsights} />
          </DashboardCard>
        </div>

        <div className="mt-8">
          <SectionHeader title="At-Risk Students" subtitle="Below 75% attendance across your sections" />
          <DashboardCard>
            <AnnouncementList
              items={smartInsights.studentsBelowAttendanceThreshold.students.map((s) => ({
                id: s.studentId,
                title: s.name,
                meta: `${s.percentage}% attendance`,
              }))}
              emptyLabel="No students below the attendance threshold."
            />
          </DashboardCard>
        </div>
      </div>
    </main>
  );
}
