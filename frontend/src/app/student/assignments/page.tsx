"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { AuthRequiredError, isAuthenticated } from "@/lib/auth";
import { getMyAssignments } from "@/lib/academicsApi";
import { AssignmentData } from "@/types/academics";

type ViewState = "loading" | "ready" | "error";

export default function StudentAssignmentsPage() {
  const router = useRouter();
  const [state, setState] = useState<ViewState>("loading");
  const [assignments, setAssignments] = useState<AssignmentData[]>([]);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace("/login");
      return;
    }
    let isMounted = true;
    getMyAssignments()
      .then((a) => {
        if (!isMounted) return;
        setAssignments(a);
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
        <p className="text-sm text-slate-400">Loading assignments…</p>
      </main>
    );
  }

  if (state === "error") {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-50 px-4 text-center">
        <p className="text-sm font-medium text-red-600">Couldn&apos;t load assignments</p>
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
        <h1 className="mt-3 mb-6 text-2xl font-semibold text-slate-900">My Assignments</h1>

        <DashboardCard>
          {assignments.length === 0 ? (
            <p className="text-sm text-slate-400">No assignments published yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {assignments.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 py-3">
                  <div>
                    <Link
                      href={`/student/assignments/${a.id}`}
                      className="text-sm font-medium text-slate-800 hover:text-acadlyx-primary hover:underline"
                    >
                      {a.courseOffering.course.code} — {a.title}
                    </Link>
                    <p className="text-xs text-slate-400">
                      Due {new Date(a.dueDate).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                      {" · "}
                      {a.maxMarks} marks
                    </p>
                  </div>
                  <StatusBadge tone="neutral">View</StatusBadge>
                </li>
              ))}
            </ul>
          )}
        </DashboardCard>
      </div>
    </main>
  );
}
