"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";
import { InstitutionLogo } from "@/components/branding/InstitutionLogo";
import { AnnouncementList } from "@/components/dashboard/AnnouncementList";
import { AssignmentList } from "@/components/dashboard/AssignmentList";
import { ClassSchedule } from "@/components/dashboard/ClassSchedule";
import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { ProgressCard } from "@/components/dashboard/ProgressCard";
import { RecommendationCard } from "@/components/dashboard/RecommendationCard";
import { SectionHeader } from "@/components/dashboard/SectionHeader";
import { riskTone, StatusBadge } from "@/components/dashboard/StatusBadge";
import { AuthRequiredError, isAuthenticated, logout } from "@/lib/auth";
import { getMyDashboard } from "@/lib/studentApi";
import { StudentDashboardData } from "@/types/dashboard";

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good Morning";
  if (hour < 17) return "Good Afternoon";
  return "Good Evening";
}

type ViewState = "loading" | "ready" | "error";

export default function StudentDashboardPage() {
  const router = useRouter();
  const [state, setState] = useState<ViewState>("loading");
  const [data, setData] = useState<StudentDashboardData | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace("/login");
      return;
    }

    let isMounted = true;
    getMyDashboard()
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
        <p className="text-sm font-medium text-red-600">
          Couldn&apos;t load your dashboard
        </p>
        <p className="text-sm text-slate-500">{errorMessage}</p>
      </main>
    );
  }

  const { institution, student, program, section, todaysClasses, assignments, announcements, upcomingEvents, academicHealth, academicRisk, recommendations, attendancePercentage } = data;

  return (
    <main className="min-h-screen bg-slate-50 pb-16">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <InstitutionLogo name={institution.name} logoUrl={institution.logoUrl} />
            <div>
              <p className="text-sm font-semibold text-slate-900">{institution.name}</p>
              <p className="text-xs text-slate-400">ACADLYX Student Portal</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            Sign out
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        {/* Greeting */}
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-slate-900">
            {greeting()}, {student.firstName}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {program?.name ?? "No program on record"}
            {section && ` · Semester ${section.semester.number} · Section ${section.name}`}
          </p>
        </div>

        {/* Top row: attendance + today's classes + assignments */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          <DashboardCard
            title="Attendance"
            action={
              <Link href="/student/attendance" className="text-xs font-medium text-acadlyx-primary hover:underline">
                Details
              </Link>
            }
          >
            <ProgressCard label="Overall" value={attendancePercentage} />
          </DashboardCard>

          <DashboardCard title="Today's Classes" className="md:col-span-2 lg:col-span-1">
            <ClassSchedule classes={todaysClasses} />
          </DashboardCard>

          <DashboardCard
            title="Assignments"
            action={
              <Link href="/student/assignments" className="text-xs font-medium text-acadlyx-primary hover:underline">
                View all
              </Link>
            }
          >
            <AssignmentList assignments={assignments} />
          </DashboardCard>

          <DashboardCard title="Announcements">
            <AnnouncementList
              items={announcements.map((a) => ({ id: a.id, title: a.title, meta: a.postedLabel }))}
            />
          </DashboardCard>

          <DashboardCard title="Upcoming">
            <AnnouncementList
              items={upcomingEvents.map((u) => ({ id: u.id, title: u.title, meta: u.whenLabel }))}
              emptyLabel="Nothing upcoming."
            />
          </DashboardCard>
        </div>

        {/* Academic Health */}
        <div className="mt-8">
          <SectionHeader
            title="Academic Health"
            action={
              <StatusBadge tone={riskTone(academicRisk)}>
                {academicRisk} RISK
              </StatusBadge>
            }
          />

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <DashboardCard className="lg:col-span-2">
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <ProgressCard label="Attendance" value={academicHealth.attendance} />
                <ProgressCard label="Assignments" value={academicHealth.assignments} />
                <ProgressCard label="Internal Marks" value={academicHealth.internalMarks} />
                <ProgressCard label="Engagement" value={academicHealth.engagement} />
              </div>
              <Link
                href="/student/marks"
                className="mt-4 inline-block text-xs font-medium text-acadlyx-primary hover:underline"
              >
                View full marks breakdown →
              </Link>
            </DashboardCard>

            <DashboardCard title="Recommendations">
              <RecommendationCard recommendations={recommendations} />
            </DashboardCard>
          </div>
        </div>
      </div>
    </main>
  );
}
