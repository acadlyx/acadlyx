"use client";

import { useEffect, useState } from "react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { AuthRequiredError } from "@/lib/auth";
import { getMyDashboard } from "@/lib/studentApi";
import { UpcomingEventItem } from "@/types/dashboard";
import { useRouter } from "next/navigation";

export default function StudentCalendarPage() {
  const router = useRouter();
  const [events, setEvents] = useState<UpcomingEventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    getMyDashboard()
      .then((data) => setEvents(data.upcomingEvents))
      .catch((reason: Error) => {
        if (reason instanceof AuthRequiredError) router.replace("/login");
        else setError(reason.message);
      })
      .finally(() => setLoading(false));
  }, [router]);

  return (
    <DashboardShell title="Academic Dates" subtitle="Your upcoming examinations and academic dates" allowedRoles={["STUDENT"]}>
      <main className="mx-auto max-w-4xl space-y-4">
        {loading && <p className="text-sm text-slate-500">Loading academic dates…</p>}
        {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>}
        {!loading && !error && events.length === 0 && <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">No upcoming academic dates have been published.</p>}
        {events.map((event) => <article key={event.id} className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="font-medium text-slate-950">{event.title}</p><time className="shrink-0 text-sm text-slate-500">{event.whenLabel}</time></article>)}
      </main>
    </DashboardShell>
  );
}
