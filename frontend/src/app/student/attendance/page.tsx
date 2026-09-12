"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { ProgressCard } from "@/components/dashboard/ProgressCard";
import { AuthRequiredError, isAuthenticated } from "@/lib/auth";
import { getMyAttendance } from "@/lib/academicsApi";
import { AttendanceSummaryData } from "@/types/academics";

type ViewState = "loading" | "ready" | "error";

export default function StudentAttendancePage() {
  const router = useRouter();
  const [state, setState] = useState<ViewState>("loading");
  const [data, setData] = useState<AttendanceSummaryData | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace("/login");
      return;
    }
    let isMounted = true;
    getMyAttendance()
      .then((d) => {
        if (!isMounted) return;
        setData(d);
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

  if (state === "loading") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-sm text-slate-400">Loading attendance…</p>
      </main>
    );
  }

  if (state === "error" || !data) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-50 px-4 text-center">
        <p className="text-sm font-medium text-red-600">Couldn&apos;t load attendance</p>
        <p className="text-sm text-slate-500">{errorMessage}</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 pb-16">
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        <Link href="/student" className="text-xs font-medium text-slate-500 hover:text-slate-800">
          ← Back to dashboard
        </Link>
        <h1 className="mt-3 mb-6 text-2xl font-semibold text-slate-900">My Attendance</h1>

        <DashboardCard title="Overall" className="mb-6">
          <ProgressCard label="All subjects" value={data.overallPercentage} />
          <p className="mt-2 text-xs text-slate-400">
            {data.totalPresent}/{data.totalSessions} sessions attended
          </p>
        </DashboardCard>

        <DashboardCard title="By Subject">
          {data.subjects.length === 0 ? (
            <p className="text-sm text-slate-400">No attendance recorded yet.</p>
          ) : (
            <div className="space-y-5">
              {data.subjects.map((s) => (
                <div key={s.courseOfferingId}>
                  <ProgressCard
                    label={`${s.courseCode} — ${s.courseName}`}
                    value={s.percentage}
                    caption={`${s.present}/${s.total} sessions`}
                  />
                </div>
              ))}
            </div>
          )}
        </DashboardCard>
      </div>
    </main>
  );
}
