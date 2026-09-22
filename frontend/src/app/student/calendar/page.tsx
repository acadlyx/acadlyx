"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { AuthRequiredError } from "@/lib/auth";
import { getMyDashboard } from "@/lib/studentApi";
import { UpcomingEventItem } from "@/types/dashboard";

const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const dayKey = (value: Date) => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
const eventDate = (event: UpcomingEventItem) => {
  if (event.date) return event.date.slice(0, 10);
  const match = event.whenLabel.match(/\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : null;
};

export default function StudentCalendarPage() {
  const router = useRouter();
  const [events, setEvents] = useState<UpcomingEventItem[]>([]);
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(() => {
    setLoading(true); setError("");
    getMyDashboard().then((data) => setEvents(data.upcomingEvents)).catch((reason: Error) => {
      if (reason instanceof AuthRequiredError) router.replace("/login"); else setError(reason.message || "Unable to load academic dates.");
    }).finally(() => setLoading(false));
  }, [router]);
  useEffect(() => { load(); }, [load]);

  const eventsByDate = useMemo(() => events.reduce<Record<string, UpcomingEventItem[]>>((all, event) => {
    const key = eventDate(event); if (key) (all[key] ||= []).push(event); return all;
  }, {}), [events]);
  const days = useMemo(() => {
    const start = new Date(month.getFullYear(), month.getMonth(), 1);
    const cells: Array<Date | null> = Array(start.getDay()).fill(null);
    const count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    for (let day = 1; day <= count; day += 1) cells.push(new Date(month.getFullYear(), month.getMonth(), day));
    while (cells.length % 7) cells.push(null);
    return cells;
  }, [month]);
  const chosenEvents = selected ? eventsByDate[selected] || [] : [];

  return <DashboardShell title="Academic Calendar" subtitle="Published examinations and academic dates" allowedRoles={["STUDENT"]}>
    <main className="mx-auto max-w-5xl space-y-4">
      {loading && <div className="h-96 animate-pulse rounded-lg bg-slate-200" />}
      {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}<button onClick={load} className="ml-3 font-semibold underline">Retry</button></div>}
      {!loading && !error && <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4"><div><h1 className="font-semibold text-slate-900">{month.toLocaleDateString("en-IN", { month: "long", year: "numeric" })}</h1><p className="text-sm text-slate-500">Select a date to view scheduled items.</p></div><div className="flex gap-2"><button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} className="rounded-md border border-slate-200 px-3 py-2 text-sm">Previous</button><button onClick={() => { const today = new Date(); setMonth(new Date(today.getFullYear(), today.getMonth(), 1)); setSelected(dayKey(today)); }} className="rounded-md border border-indigo-200 px-3 py-2 text-sm font-medium text-indigo-700">Today</button><button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} className="rounded-md border border-slate-200 px-3 py-2 text-sm">Next</button></div></header>
        <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50">{weekdays.map((weekday) => <div key={weekday} className="p-2 text-center text-xs font-semibold text-slate-500">{weekday}</div>)}</div>
        <div className="grid grid-cols-7">{days.map((day, index) => { if (!day) return <div key={`empty-${index}`} className="min-h-20 border-b border-r border-slate-100 bg-slate-50/50" />; const key = dayKey(day); const items = eventsByDate[key] || []; const active = selected === key; return <button key={key} onClick={() => setSelected(key)} className={`min-h-20 border-b border-r border-slate-100 p-2 text-left align-top transition ${active ? "bg-indigo-50 ring-1 ring-inset ring-indigo-300" : "hover:bg-slate-50"}`}><span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs ${key === dayKey(new Date()) ? "bg-indigo-600 text-white" : "text-slate-700"}`}>{day.getDate()}</span>{items.slice(0, 2).map((event) => <span key={event.id} className="mt-1 block truncate rounded bg-indigo-100 px-1 py-0.5 text-[10px] text-indigo-800">{event.title}</span>)}</button>; })}</div>
      </section>}
      {!loading && !error && selected && <section className="rounded-lg border border-slate-200 bg-white p-5"><h2 className="font-semibold text-slate-900">{new Date(`${selected}T00:00:00`).toLocaleDateString("en-IN", { weekday: "long", day: "2-digit", month: "long" })}</h2>{chosenEvents.length ? <div className="mt-3 space-y-2">{chosenEvents.map((event) => <article key={event.id} className="rounded-md border border-slate-100 p-3"><p className="font-medium">{event.title}</p><p className="text-sm text-slate-500">{event.whenLabel}</p></article>)}</div> : <p className="mt-2 text-sm text-slate-500">No published academic event for this date.</p>}</section>}
      {!loading && !error && !events.length && <p className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">No upcoming academic dates have been published.</p>}
    </main>
  </DashboardShell>;
}
