"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { AuthRequiredError, isAuthenticated } from "@/lib/auth";
import { getMyMarks } from "@/lib/academicsApi";
import { InternalMarkEntry } from "@/types/academics";

type ViewState = "loading" | "ready" | "error";

export default function StudentMarksPage() {
  const router = useRouter();
  const [state, setState] = useState<ViewState>("loading");
  const [marks, setMarks] = useState<InternalMarkEntry[]>([]);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace("/login");
      return;
    }
    let isMounted = true;
    getMyMarks()
      .then((m) => {
        if (!isMounted) return;
        setMarks(m);
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
        <p className="text-sm text-slate-400">Loading marks…</p>
      </main>
    );
  }

  if (state === "error") {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-50 px-4 text-center">
        <p className="text-sm font-medium text-red-600">Couldn&apos;t load marks</p>
        <p className="text-sm text-slate-500">{errorMessage}</p>
      </main>
    );
  }

  // Group by course for display.
  const byCourse = new Map<string, InternalMarkEntry[]>();
  for (const m of marks) {
    const key = m.courseOffering ? `${m.courseOffering.course.code} — ${m.courseOffering.course.name}` : "Course";
    byCourse.set(key, [...(byCourse.get(key) ?? []), m]);
  }

  return (
    <main className="min-h-screen bg-slate-50 pb-16">
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        <Link href="/student" className="text-xs font-medium text-slate-500 hover:text-slate-800">
          ← Back to dashboard
        </Link>
        <h1 className="mt-3 mb-6 text-2xl font-semibold text-slate-900">My Marks</h1>

        {byCourse.size === 0 ? (
          <DashboardCard>
            <p className="text-sm text-slate-400">No marks entered yet.</p>
          </DashboardCard>
        ) : (
          <div className="space-y-4">
            {Array.from(byCourse.entries()).map(([course, entries]) => (
              <DashboardCard key={course} title={course}>
                <ul className="divide-y divide-slate-100">
                  {entries.map((e) => (
                    <li key={e.id} className="flex items-center justify-between py-2 text-sm">
                      <span className="text-slate-700">{e.component}</span>
                      <span className="font-medium text-slate-900">
                        {e.marksObtained}/{e.maxMarks}
                      </span>
                    </li>
                  ))}
                </ul>
              </DashboardCard>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
