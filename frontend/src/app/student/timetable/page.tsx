"use client";

import { useEffect, useState } from "react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { AuthRequiredError } from "@/lib/auth";
import { getMyTimetable, StudentTimetableEntry } from "@/lib/studentApi";
import { useRouter } from "next/navigation";

const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function StudentTimetablePage() {
  const router = useRouter();
  const [entries, setEntries] = useState<StudentTimetableEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    getMyTimetable()
      .then(setEntries)
      .catch((reason: Error) => {
        if (reason instanceof AuthRequiredError) router.replace("/login");
        else setError(reason.message);
      })
      .finally(() => setLoading(false));
  }, [router]);

  return (
    <DashboardShell title="Weekly Timetable" subtitle="Your enrolled classes and rooms" allowedRoles={["STUDENT"]}>
      <main className="mx-auto max-w-6xl space-y-5">
        {loading && <p className="text-sm text-slate-500">Loading timetable…</p>}
        {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>}
        {!loading && !error && entries.length === 0 && <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">No timetable has been published for your section yet.</p>}
        {days.map((day, dayOfWeek) => {
          const classes = entries.filter((entry) => entry.dayOfWeek === dayOfWeek);
          if (!classes.length) return null;
          return <section key={day} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><header className="border-b border-slate-100 px-5 py-4"><h2 className="font-semibold text-slate-950">{day}</h2></header><div className="divide-y divide-slate-100">{classes.map((entry) => <article key={entry.id} className="grid gap-2 p-5 sm:grid-cols-[130px_1fr_auto]"><p className="text-sm font-semibold text-slate-700">{entry.startTime} - {entry.endTime}</p><div><p className="font-medium text-slate-950">{entry.course.name}</p><p className="mt-1 text-sm text-slate-500">{entry.course.code}{entry.faculty ? ` · ${entry.faculty}` : ""}</p></div><p className="text-sm text-slate-500">{entry.room || "Room pending"}</p></article>)}</div></section>;
        })}
      </main>
    </DashboardShell>
  );
}
