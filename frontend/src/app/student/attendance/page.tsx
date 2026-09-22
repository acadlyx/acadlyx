"use client";

import { useRouter } from "next/navigation";
import {
  useEffect,
  useState,
} from "react";

import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { ProgressCard } from "@/components/dashboard/ProgressCard";
import { DashboardShell } from "@/components/dashboard/DashboardShell";

import {
  AuthRequiredError,
  isAuthenticated,
} from "@/lib/auth";

import {
  getMyAttendance,
} from "@/lib/academicsApi";

import {
  AttendanceSummaryData,
} from "@/types/academics";

function Skeleton() {
  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="acadlyx-skeleton h-5 w-32 rounded" />
        <div className="acadlyx-skeleton mt-6 h-4 w-full rounded-full" />
        <div className="acadlyx-skeleton mt-3 h-3 w-40 rounded" />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="acadlyx-skeleton h-5 w-32 rounded" />

        <div className="mt-6 space-y-7">
          {Array.from({
            length: 4,
          }).map((_, index) => (
            <div key={index}>
              <div className="acadlyx-skeleton h-3 w-48 rounded" />
              <div className="acadlyx-skeleton mt-3 h-3 w-full rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function StudentAttendancePage() {
  const router =
    useRouter();

  const [data, setData] =
    useState<
      AttendanceSummaryData | null
    >(null);

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

      const result =
        await getMyAttendance();

      setData(result);
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
          : "Unable to load attendance."
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
      title="Attendance"
      subtitle="Your attendance across enrolled subjects"
      allowedRoles={[
        "STUDENT",
      ]}
    >
      <div className="space-y-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-blue-600">
            Academics
          </p>

          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
            My attendance
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            A clear view of your attendance
            before it becomes a problem.
          </p>
        </section>

        {error && (
          <div className="rounded-2xl border border-red-200 bg-white p-5">
            <p className="font-bold text-red-700">
              Couldn&apos;t load attendance
            </p>

            <p className="mt-1 text-sm text-slate-500">
              {error}
            </p>

            <button
              type="button"
              onClick={load}
              className="mt-4 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700"
            >
              Try again
            </button>
          </div>
        )}

        {loading ? (
          <Skeleton />
        ) : data ? (
          <>
            <DashboardCard title="Overall attendance">
              <ProgressCard
                label="All subjects"
                value={
                  data.overallPercentage
                }
              />

              <p className="mt-3 text-xs text-slate-500">
                {data.totalPresent}/
                {data.totalSessions}{" "}
                sessions attended
              </p>
            </DashboardCard>

            <DashboardCard title="By subject">
              {data.subjects.length ===
              0 ? (
                <div className="py-8 text-center">
                  <p className="font-semibold text-slate-900">
                    No attendance yet
                  </p>

                  <p className="mt-1 text-sm text-slate-500">
                    Attendance records will
                    appear here once classes
                    are marked.
                  </p>
                </div>
              ) : (
                <div className="space-y-7">
                  {data.subjects.map(
                    (subject) => (
                      <div
                        key={
                          subject.courseOfferingId
                        }
                      >
                        <ProgressCard
                          label={`${subject.courseCode} — ${subject.courseName}`}
                          value={
                            subject.percentage
                          }
                          caption={`${subject.present}/${subject.total} sessions`}
                        />
                      </div>
                    )
                  )}
                </div>
              )}
            </DashboardCard>
          </>
        ) : null}
      </div>
    </DashboardShell>
  );
}
