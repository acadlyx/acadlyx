"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthRequiredError, authedFetch, HttpRequestError } from "@/lib/auth";
import { DashboardShell } from "@/components/dashboard/DashboardShell";

type RawEvent = {
  id: string;
  title?: string;
  type?: string;
  roundType?: string;
  roundNumber?: number;
  startsAt?: string | null;
  startAt?: string | null;
  driveDate?: string | null;
  status?: string;
  venue?: string | null;
  onlineLink?: string | null;
  company?: { name?: string } | null;
  drive?: { title?: string; company?: { name?: string } } | null;
  student?: { firstName?: string; lastName?: string } | null;
};

type CalendarEvent = {
  id: string;
  kind: "Drive" | "Interview" | "Assessment" | "Company visit";
  title: string;
  organization: string;
  startsAt: string;
  status: string;
  venue: string;
  href: string;
};

function asArray(value: unknown): RawEvent[] {
  if (Array.isArray(value)) return value as RawEvent[];
  if (value && typeof value === "object" && "data" in value) {
    const data = (value as { data?: unknown }).data;
    return Array.isArray(data) ? data as RawEvent[] : [];
  }
  return [];
}

export default function PlacementCalendarPage() {
  const router = useRouter();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState("ALL");
  const [status, setStatus] = useState("UPCOMING");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [drives, interviews, tests, visits] = await Promise.all([
        authedFetch<unknown>("/placements/drives?page=1&pageSize=100"),
        authedFetch<unknown>("/placements/interviews"),
        authedFetch<unknown>("/placements/tests"),
        authedFetch<unknown>("/placements/visits"),
      ]);
      const mapped: CalendarEvent[] = [
        ...asArray(drives).map((item) => ({
          id: item.id, kind: "Drive" as const, title: item.title || "Placement drive",
          organization: item.company?.name || "Company not specified",
          startsAt: item.driveDate || item.startsAt || item.startAt || "",
          status: item.status || "UNKNOWN", venue: item.venue || "",
          href: "/placements/drives",
        })),
        ...asArray(interviews).map((item) => ({
          id: item.id, kind: "Interview" as const,
          title: item.drive?.title ? item.drive.title + (item.roundNumber ? " · Round " + item.roundNumber : "") : item.roundType || "Interview",
          organization: item.drive?.company?.name || item.company?.name || "Company not specified",
          startsAt: item.startsAt || item.startAt || "", status: item.status || "UNKNOWN",
          venue: item.venue || item.onlineLink || "", href: "/placements/interviews",
        })),
        ...asArray(tests).map((item) => ({
          id: item.id, kind: "Assessment" as const, title: item.title || item.drive?.title || "Placement assessment",
          organization: item.drive?.company?.name || item.company?.name || "Company not specified",
          startsAt: item.startsAt || item.startAt || "", status: item.status || "UNKNOWN",
          venue: item.venue || item.onlineLink || "", href: "/placements/tests",
        })),
        ...asArray(visits).map((item) => ({
          id: item.id, kind: "Company visit" as const, title: item.title || item.type || "Company visit",
          organization: item.company?.name || "Company not specified",
          startsAt: item.startsAt || item.startAt || "", status: item.status || "UNKNOWN",
          venue: item.venue || item.onlineLink || "", href: "/placements/visits",
        })),
      ].filter((item) => item.id && item.startsAt);
      setEvents(mapped.sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()));
    } catch (cause) {
      if (cause instanceof AuthRequiredError) { router.replace("/login"); return; }
      setError(cause instanceof HttpRequestError ? cause.message : "Unable to load the placement calendar.");
    } finally { setLoading(false); }
  }, [router]);

  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    const now = Date.now();
    const query = search.trim().toLowerCase();
    return events.filter((event) => {
      const time = new Date(event.startsAt).getTime();
      const cancelled = ["CANCELLED", "CANCELED"].includes(event.status.toUpperCase());
      const matchesTime = status === "ALL" || (status === "UPCOMING" ? !cancelled && time >= now : time < now);
      const matchesKind = kind === "ALL" || event.kind === kind;
      const matchesSearch = !query || [event.title, event.organization, event.venue, event.status].some((v) => v.toLowerCase().includes(query));
      return Number.isFinite(time) && matchesTime && matchesKind && matchesSearch;
    });
  }, [events, search, kind, status]);

  return (
    <DashboardShell title="Placement Calendar" subtitle="A unified schedule of drives, interviews, assessments and company visits within your authorized placement scope." allowedRoles={["PLACEMENT"]}>
      <div className="mx-auto max-w-7xl space-y-5">
        {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
        <section className="grid gap-3 rounded-2xl border bg-white p-4 md:grid-cols-3">
          <label className="flex flex-col gap-1 text-sm font-semibold text-slate-700">Search schedule<input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Company, activity, venue…" className="rounded-xl border px-3 py-3 font-normal" /></label>
          <label className="flex flex-col gap-1 text-sm font-semibold text-slate-700">Activity type<select value={kind} onChange={(e) => setKind(e.target.value)} className="rounded-xl border bg-white px-3 py-3"><option value="ALL">All activity types</option><option value="Drive">Drives</option><option value="Interview">Interviews</option><option value="Assessment">Assessments</option><option value="Company visit">Company visits</option></select></label>
          <label className="flex flex-col gap-1 text-sm font-semibold text-slate-700">Date range<select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-xl border bg-white px-3 py-3"><option value="UPCOMING">Upcoming</option><option value="PAST">Past</option><option value="ALL">All dates</option></select></label>
        </section>
        <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-slate-600">{loading ? "Loading schedule…" : `${filtered.length} event(s) match the current filters`}</p><button type="button" onClick={() => void load()} disabled={loading} className="rounded-xl border bg-white px-4 py-2 text-sm font-bold disabled:opacity-50">Refresh calendar</button></div>
        <section className="space-y-3">
          {filtered.map((event) => <article key={event.kind + event.id} className="grid gap-3 rounded-2xl border bg-white p-4 md:grid-cols-[180px_1fr_auto] md:items-center">
            <div className="rounded-xl bg-emerald-50 p-3"><p className="text-xs font-black uppercase text-emerald-800">{new Date(event.startsAt).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}</p><p className="mt-1 text-sm font-bold text-slate-800">{new Date(event.startsAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</p></div>
            <div><div className="flex flex-wrap items-center gap-2"><h2 className="font-black text-slate-950">{event.title}</h2><span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-700">{event.kind}</span><span className="text-[11px] font-bold text-slate-500">{event.status.replaceAll("_", " ")}</span></div><p className="mt-1 text-sm text-slate-600">{event.organization}{event.venue ? " · " + event.venue : ""}</p></div>
            <button type="button" onClick={() => router.push(event.href)} className="rounded-xl border px-3 py-2 text-sm font-bold">Manage activity</button>
          </article>)}
          {!loading && filtered.length === 0 && <div className="rounded-2xl border border-dashed bg-white p-10 text-center"><h2 className="font-black text-slate-900">No matching placement events</h2><p className="mt-2 text-sm text-slate-600">Change the filters or refresh to load the latest schedule.</p></div>}
        </section>
      </div>
    </DashboardShell>
  );
}
