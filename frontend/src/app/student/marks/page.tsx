"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { DashboardCard } from "@/components/dashboard/DashboardCard";

import {
  AuthRequiredError,
} from "@/lib/auth";

import {
  getMyMarks,
} from "@/lib/academicsApi";

import {
  InternalMarkEntry,
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
        <div className="h-9 w-48 animate-pulse rounded-lg bg-slate-200" />
        <div className="h-4 w-96 max-w-full animate-pulse rounded bg-slate-100" />
      </div>

      {Array.from({ length: 3 }).map(
        (_, index) => (
          <div
            key={index}
            className="h-40 animate-pulse rounded-2xl bg-white ring-1 ring-slate-200"
          />
        ),
      )}
    </div>
  );
}

export default function StudentMarksPage() {
  const router = useRouter();

  const [state, setState] =
    useState<ViewState>("loading");

  const [marks, setMarks] =
    useState<InternalMarkEntry[]>([]);

  const [errorMessage, setErrorMessage] =
    useState("");

  useEffect(() => {
    let isMounted = true;

    getMyMarks()
      .then((data) => {
        if (!isMounted) {
          return;
        }

        setMarks(data);
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
            : "Unable to load marks.",
        );

        setState("error");
      });

    return () => {
      isMounted = false;
    };
  }, [router]);

  const byCourse = useMemo(() => {
    const grouped =
      new Map<
        string,
        InternalMarkEntry[]
      >();

    for (const mark of marks) {
      const key = mark.courseOffering
        ? `${mark.courseOffering.course.code} — ${mark.courseOffering.course.name}`
        : "Course";

      grouped.set(key, [
        ...(grouped.get(key) ?? []),
        mark,
      ]);
    }

    return grouped;
  }, [marks]);

  return (
    <DashboardShell
      title="My Marks"
      subtitle="Review internal marks across your courses"
      allowedRoles={["STUDENT"]}
    >
      {state === "loading" ? (
        <LoadingState />
      ) : state === "error" ? (
        <div className="mx-auto max-w-4xl">
          <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
            <p className="text-sm font-bold text-red-900">
              Couldn&apos;t load marks
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
              My Marks
            </h1>

            <p className="mt-2 text-sm leading-6 text-slate-500">
              Review your internal assessment components and marks
              across courses.
            </p>
          </div>

          {byCourse.size === 0 ? (
            <DashboardCard>
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-white text-slate-400 shadow-sm ring-1 ring-slate-200">
                  —
                </div>

                <p className="mt-3 text-sm font-bold text-slate-700">
                  No marks entered yet
                </p>

                <p className="mt-1 text-xs leading-5 text-slate-400">
                  Your marks will appear here once they are entered
                  for your courses.
                </p>
              </div>
            </DashboardCard>
          ) : (
            <div className="space-y-5">
              {Array.from(
                byCourse.entries(),
              ).map(
                ([course, entries]) => (
                  <DashboardCard
                    key={course}
                    title={course}
                  >
                    <div className="overflow-hidden rounded-xl border border-slate-100">
                      <div className="hidden grid-cols-[1fr_auto] gap-4 bg-slate-50 px-4 py-2.5 text-[10px] font-black uppercase tracking-wider text-slate-400 sm:grid">
                        <span>
                          Component
                        </span>
                        <span>
                          Marks
                        </span>
                      </div>

                      <ul className="divide-y divide-slate-100">
                        {entries.map(
                          (entry) => (
                            <li
                              key={entry.id}
                              className="flex items-center justify-between gap-4 px-4 py-3"
                            >
                              <span className="text-sm font-medium text-slate-700">
                                {
                                  entry.component
                                }
                              </span>

                              <span className="rounded-lg bg-slate-50 px-3 py-1.5 text-sm font-black text-slate-900">
                                {
                                  entry.marksObtained
                                }
                                /
                                {
                                  entry.maxMarks
                                }
                              </span>
                            </li>
                          ),
                        )}
                      </ul>
                    </div>
                  </DashboardCard>
                ),
              )}
            </div>
          )}
        </div>
      )}
    </DashboardShell>
  );
}
