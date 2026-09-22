"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useState,
} from "react";

import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { DashboardShell } from "@/components/dashboard/DashboardShell";

import {
  AuthRequiredError,
  isAuthenticated,
} from "@/lib/auth";

import {
  getMyAssignments,
} from "@/lib/academicsApi";

import {
  AssignmentData,
} from "@/types/academics";

function Skeleton() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6">
      <div className="space-y-4">
        {Array.from({
          length: 5,
        }).map((_, index) => (
          <div
            key={index}
            className="flex items-center justify-between gap-4 border-b border-slate-100 pb-4 last:border-0 last:pb-0"
          >
            <div className="flex-1">
              <div className="acadlyx-skeleton h-4 w-64 max-w-full rounded" />
              <div className="acadlyx-skeleton mt-2 h-3 w-36 rounded" />
            </div>

            <div className="acadlyx-skeleton h-8 w-16 rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function StudentAssignmentsPage() {
  const router =
    useRouter();

  const [
    assignments,
    setAssignments,
  ] = useState<
    AssignmentData[]
  >([]);

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
        await getMyAssignments();

      setAssignments(result);
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
          : "Unable to load assignments."
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
      title="Assignments"
      subtitle="Work that needs your attention"
      allowedRoles={[
        "STUDENT",
      ]}
    >
      <div className="space-y-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-blue-600">
            Academics
          </p>

          <div className="mt-2 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-950">
                My assignments
              </h1>

              <p className="mt-2 text-sm text-slate-500">
                View upcoming work and open
                each assignment when you are
                ready.
              </p>
            </div>

            <Link
              href="/student"
              className="text-sm font-bold text-blue-600 hover:text-blue-700"
            >
              ← Overview
            </Link>
          </div>
        </section>

        {error && (
          <div className="rounded-2xl border border-red-200 bg-white p-5">
            <p className="font-bold text-red-700">
              Couldn&apos;t load assignments
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
        ) : (
          <DashboardCard>
            {assignments.length === 0 ? (
              <div className="py-10 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                  ✓
                </div>

                <p className="mt-4 font-bold text-slate-900">
                  You&apos;re all caught up
                </p>

                <p className="mt-1 text-sm text-slate-500">
                  No published assignments
                  are waiting for you.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {assignments.map(
                  (assignment) => (
                    <li
                      key={
                        assignment.id
                      }
                      className="flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0"
                    >
                      <div className="min-w-0">
                        <Link
                          href={`/student/assignments/${assignment.id}`}
                          className="font-semibold text-slate-900 hover:text-blue-600"
                        >
                          {
                            assignment
                              .courseOffering
                              .course
                              .code
                          }{" "}
                          —{" "}
                          {
                            assignment.title
                          }
                        </Link>

                        <p className="mt-1 text-xs text-slate-500">
                          Due{" "}
                          {new Date(
                            assignment.dueDate
                          ).toLocaleDateString(
                            undefined,
                            {
                              month:
                                "short",
                              day:
                                "numeric",
                              year:
                                "numeric",
                            }
                          )}
                          {" · "}
                          {
                            assignment.maxMarks
                          }{" "}
                          marks
                        </p>
                      </div>

                      <Link
                        href={`/student/assignments/${assignment.id}`}
                        className="shrink-0"
                      >
                        <StatusBadge tone="neutral">
                          Open
                        </StatusBadge>
                      </Link>
                    </li>
                  )
                )}
              </ul>
            )}
          </DashboardCard>
        )}
      </div>
    </DashboardShell>
  );
}
