"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { StatusBadge } from "@/components/dashboard/StatusBadge";

import {
  AuthRequiredError,
} from "@/lib/auth";

import {
  getMyAssignments,
} from "@/lib/academicsApi";

import {
  AssignmentData,
} from "@/types/academics";

type ViewState =
  | "loading"
  | "ready"
  | "error";

function LoadingState() {
  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <div className="h-3 w-32 animate-pulse rounded bg-slate-200" />
        <div className="h-9 w-64 animate-pulse rounded-lg bg-slate-200" />
        <div className="h-4 w-96 max-w-full animate-pulse rounded bg-slate-100" />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, index) => (
            <div
              key={index}
              className="flex items-center justify-between gap-4 border-b border-slate-100 pb-4 last:border-0 last:pb-0"
            >
              <div className="min-w-0 flex-1 space-y-2">
                <div className="h-4 w-64 max-w-full animate-pulse rounded bg-slate-200" />
                <div className="h-3 w-40 animate-pulse rounded bg-slate-100" />
              </div>

              <div className="h-6 w-12 animate-pulse rounded-full bg-slate-100" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function StudentAssignmentsPage() {
  const router = useRouter();

  const [state, setState] =
    useState<ViewState>("loading");

  const [assignments, setAssignments] =
    useState<AssignmentData[]>([]);

  const [errorMessage, setErrorMessage] =
    useState("");

  useEffect(() => {
    let isMounted = true;

    getMyAssignments()
      .then((data) => {
        if (!isMounted) {
          return;
        }

        setAssignments(data);
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
            : "Unable to load assignments.",
        );

        setState("error");
      });

    return () => {
      isMounted = false;
    };
  }, [router]);

  return (
    <DashboardShell
      title="My Assignments"
      subtitle="View and submit your academic assignments"
      allowedRoles={["STUDENT"]}
    >
      {state === "loading" ? (
        <LoadingState />
      ) : state === "error" ? (
        <div className="mx-auto max-w-4xl">
          <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
            <p className="text-sm font-bold text-red-900">
              Couldn&apos;t load assignments
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
          <div className="mb-6">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-acadlyx-primary">
              Student workspace
            </p>

            <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-950">
              My Assignments
            </h1>

            <p className="mt-2 text-sm leading-6 text-slate-500">
              Keep track of your published assignments,
              deadlines, submissions, and feedback.
            </p>
          </div>

          <DashboardCard>
            {assignments.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-white text-slate-400 shadow-sm ring-1 ring-slate-200">
                  ✓
                </div>

                <p className="mt-3 text-sm font-bold text-slate-700">
                  No assignments published yet
                </p>

                <p className="mt-1 text-xs leading-5 text-slate-400">
                  New assignments will appear here when they are
                  published for your courses.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {assignments.map((assignment) => (
                  <li
                    key={assignment.id}
                    className="group flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <Link
                        href={`/student/assignments/${assignment.id}`}
                        className="text-sm font-bold text-slate-800 transition hover:text-acadlyx-primary hover:underline"
                      >
                        {assignment.courseOffering.course.code}
                        {" — "}
                        {assignment.title}
                      </Link>

                      <p className="mt-1 text-xs leading-5 text-slate-400">
                        Due{" "}
                        {new Date(
                          assignment.dueDate,
                        ).toLocaleDateString(
                          undefined,
                          {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          },
                        )}
                        {" · "}
                        {assignment.maxMarks} marks
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-3">
                      {assignment.mySubmission ? (
                        <StatusBadge
                          tone={
                            assignment.mySubmission.status ===
                            "LATE"
                              ? "warning"
                              : assignment.mySubmission.status ===
                                  "REVIEWED"
                                ? "success"
                                : "neutral"
                          }
                        >
                          {assignment.mySubmission.status ===
                          "REVIEWED"
                            ? "Reviewed"
                            : assignment.mySubmission.status ===
                                "LATE"
                              ? "Late"
                              : "Submitted"}
                        </StatusBadge>
                      ) : (
                        <StatusBadge tone="neutral">
                          Pending
                        </StatusBadge>
                      )}

                      <Link
                        href={`/student/assignments/${assignment.id}`}
                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
                      >
                        Open
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </DashboardCard>
        </div>
      )}
    </DashboardShell>
  );
}
