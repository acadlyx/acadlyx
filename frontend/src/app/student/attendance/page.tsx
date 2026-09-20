"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { ProgressCard } from "@/components/dashboard/ProgressCard";

import {
  AuthRequiredError,
} from "@/lib/auth";

import {
  getMyAttendance,
} from "@/lib/academicsApi";

import {
  AttendanceSummaryData,
} from "@/types/academics";

type ViewState =
  | "loading"
  | "ready"
  | "error";

function LoadingState() {
  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="space-y-3">
        <div className="h-3 w-32 animate-pulse rounded bg-slate-200" />
        <div className="h-9 w-56 animate-pulse rounded-lg bg-slate-200" />
        <div className="h-4 w-96 max-w-full animate-pulse rounded bg-slate-100" />
      </div>

      <div className="h-40 animate-pulse rounded-2xl bg-white ring-1 ring-slate-200" />

      <div className="h-80 animate-pulse rounded-2xl bg-white ring-1 ring-slate-200" />
    </div>
  );
}

export default function StudentAttendancePage() {
  const router = useRouter();

  const [state, setState] =
    useState<ViewState>("loading");

  const [data, setData] =
    useState<AttendanceSummaryData | null>(
      null,
    );

  const [errorMessage, setErrorMessage] =
    useState("");

  useEffect(() => {
    let isMounted = true;

    getMyAttendance()
      .then((attendance) => {
        if (!isMounted) {
          return;
        }

        setData(attendance);
        setState("ready");
      })
      .catch((error: unknown) => {
        if (!isMounted) {
          return;
        }

        if (
          error instanceof AuthRequiredError
        ) {
          router.replace("/login");
          return;
        }

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Unable to load attendance.",
        );

        setState("error");
      });

    return () => {
      isMounted = false;
    };
  }, [router]);

  return (
    <DashboardShell
      title="My Attendance"
      subtitle="Track attendance across your courses"
      allowedRoles={["STUDENT"]}
    >
      {state === "loading" ? (
        <LoadingState />
      ) : state === "error" ||
        !data ? (
        <div className="mx-auto max-w-4xl">
          <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
            <p className="text-sm font-bold text-red-900">
              Couldn&apos;t load attendance
            </p>

            <p className="mt-1 text-sm leading-6 text-red-700">
              {errorMessage}
            </p>

            <button
              type="button"
              onClick={() =>
                window.location.reload()
              }
              className="mt-4 rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-50"
            >
              Retry
            </button>
          </div>
        </div>
      ) : (
        <div className="mx-auto max-w-4xl">
          <Link
            href="/student"
            className="inline-flex items-center text-xs font-bold text-slate-500 transition hover:text-slate-900"
          >
            ← Back to dashboard
          </Link>

          <div className="mt-4 mb-6">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-acadlyx-primary">
              Student academics
            </p>

            <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
              My Attendance
            </h1>

            <p className="mt-2 text-sm leading-6 text-slate-500">
              Monitor your attendance percentage and session
              participation across subjects.
            </p>
          </div>

          <DashboardCard
            title="Overall"
            className="mb-5"
          >
            <ProgressCard
              label="All subjects"
              value={
                data.overallPercentage
              }
            />

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-3">
              <p className="text-xs font-semibold text-slate-500">
                Sessions attended
              </p>

              <p className="text-sm font-black text-slate-900">
                {data.totalPresent}
                {" / "}
                {data.totalSessions}
              </p>
            </div>
          </DashboardCard>

          <DashboardCard title="By Subject">
            {data.subjects.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
                <p className="text-sm font-bold text-slate-700">
                  No attendance recorded yet
                </p>

                <p className="mt-1 text-xs leading-5 text-slate-400">
                  Attendance data will appear here when sessions are
                  recorded.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {data.subjects.map(
                  (subject) => (
                    <div
                      key={
                        subject.courseOfferingId
                      }
                      className="rounded-xl border border-slate-100 bg-slate-50/70 p-4"
                    >
                      <ProgressCard
                        label={`${subject.courseCode} — ${subject.courseName}`}
                        value={
                          subject.percentage
                        }
                        caption={`${subject.present}/${subject.total} sessions`}
                      />
                    </div>
                  ),
                )}
              </div>
            )}
          </DashboardCard>
        </div>
      )}
    </DashboardShell>
  );
}
