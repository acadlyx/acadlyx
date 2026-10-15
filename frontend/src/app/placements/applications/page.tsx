"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthRequiredError, authedFetch, HttpRequestError } from "@/lib/auth";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import DataExportActions from "@/components/dashboard/DataExportActions";

type Application = {
  id: string;
  status: string;
  appliedAt?: string;
  student: { id: string; firstName: string; lastName: string; email?: string; profile?: { admissionNumber?: string | null } | null };
  opportunity: { title: string; organization: string };
  placementDrive?: { company?: { name?: string } } | null;
  placementOpening?: { company?: { name?: string }; role?: string } | null;
};

const NEXT: Record<string, string[]> = {
  APPLICATION_SUBMITTED: ["SHORTLISTED", "REJECTED", "WITHDRAWN"],
  SHORTLISTED: ["TEST", "INTERVIEW", "REJECTED", "WITHDRAWN"],
  TEST: ["INTERVIEW", "SELECTED", "REJECTED", "WITHDRAWN"],
  INTERVIEW: ["SELECTED", "REJECTED", "WITHDRAWN"],
  SELECTED: ["OFFERED", "REJECTED"],
  OFFERED: ["ACCEPTED", "REJECTED"],
  ACCEPTED: ["JOINED", "WITHDRAWN"],
};

export default function PlacementApplicationsPage() {
  const router = useRouter();
  const [items, setItems] = useState<Application[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [companyFilter, setCompanyFilter] = useState("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError("");
    try {
      const response = await authedFetch<{ data: Application[] }>("/placements/applications");
      setItems(response.data || []);
    } catch (cause) {
      if (cause instanceof AuthRequiredError) { router.replace("/login"); return; }
      setError(cause instanceof HttpRequestError ? cause.message : "Unable to load placement applications.");
    }
  }, [router]);

  useEffect(() => { void load(); }, [load]);

  const companies = useMemo(() => [...new Set(items.map(a => a.placementDrive?.company?.name || a.placementOpening?.company?.name || a.opportunity.organization).filter(Boolean))].sort(), [items]);
  const exportFilters = useMemo(() => ({
    ...(search.trim() ? { search: search.trim() } : {}),
    ...(statusFilter !== "ALL" ? { status: statusFilter } : {}),
    ...(companyFilter !== "ALL" ? { company: companyFilter } : {}),
    ...(dateFrom ? { dateFrom: new Date(dateFrom + "T00:00:00").toISOString() } : {}),
    ...(dateTo ? { dateTo: new Date(dateTo + "T23:59:59.999").toISOString() } : {}),
  }), [search, statusFilter, companyFilter, dateFrom, dateTo]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((a) => {
      const company = a.placementDrive?.company?.name || a.placementOpening?.company?.name || a.opportunity.organization;
      const person = a.student.firstName + " " + a.student.lastName;
      const admission = a.student.profile?.admissionNumber || "";
      const matchesSearch = !q || [person, a.student.email || "", admission, company, a.opportunity.title, a.placementOpening?.role || "", a.status].some(v => v.toLowerCase().includes(q));
      const matchesStatus = statusFilter === "ALL" || a.status === statusFilter;
      const matchesCompany = companyFilter === "ALL" || company === companyFilter;
      const applied = a.appliedAt ? new Date(a.appliedAt).getTime() : null;
      const from = dateFrom ? new Date(dateFrom + "T00:00:00").getTime() : null;
      const to = dateTo ? new Date(dateTo + "T23:59:59.999").getTime() : null;
      const matchesDate = (from === null || (applied !== null && applied >= from)) && (to === null || (applied !== null && applied <= to));
      return matchesSearch && matchesStatus && matchesCompany && matchesDate;
    });
  }, [items, search, statusFilter, companyFilter, dateFrom, dateTo]);

  async function transition(application: Application, status: string) {
    setBusy(application.id);
    setError("");
    try {
      await authedFetch("/placements/applications/" + application.id + "/status", { method: "POST", body: JSON.stringify({ status }) });
      await load();
    } catch (cause) {
      if (cause instanceof AuthRequiredError) router.replace("/login");
      else setError(cause instanceof HttpRequestError ? cause.message : "Unable to update application status.");
    } finally { setBusy(null); }
  }

  return (
    <DashboardShell title="Placement Applications" subtitle="Review applicants, filter the recruitment pipeline and record allowed application-stage transitions." allowedRoles={["PLACEMENT"]}>
      <div className="mx-auto max-w-7xl space-y-5">
        {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
        <section className="grid gap-3 rounded-2xl border bg-white p-4 md:grid-cols-2 lg:grid-cols-3">
          <label className="flex flex-col gap-1 text-sm font-semibold text-slate-700">Search applicants<input value={search} onChange={e => setSearch(e.target.value)} placeholder="Student, admission no., company, role…" className="rounded-xl border px-3 py-3 font-normal" /></label>
          <label className="flex flex-col gap-1 text-sm font-semibold text-slate-700">Application status<select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="rounded-xl border bg-white px-3 py-3"><option value="ALL">All statuses</option>{[...new Set(items.map(a => a.status))].sort().map(s => <option key={s}>{s}</option>)}</select></label>
          <label className="flex flex-col gap-1 text-sm font-semibold text-slate-700">Company<select value={companyFilter} onChange={e => setCompanyFilter(e.target.value)} className="rounded-xl border bg-white px-3 py-3"><option value="ALL">All companies</option>{companies.map(c => <option key={c}>{c}</option>)}</select></label>
          <label className="flex flex-col gap-1 text-sm font-semibold text-slate-700">Applied from<input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="rounded-xl border px-3 py-3 font-normal" /></label>
          <label className="flex flex-col gap-1 text-sm font-semibold text-slate-700">Applied to<input type="date" value={dateTo} min={dateFrom || undefined} onChange={e => setDateTo(e.target.value)} className="rounded-xl border px-3 py-3 font-normal" /></label>
          <div className="flex flex-wrap items-end gap-2"><button type="button" onClick={() => { setSearch(""); setStatusFilter("ALL"); setCompanyFilter("ALL"); setDateFrom(""); setDateTo(""); }} className="rounded-xl border px-4 py-2 text-sm font-bold">Clear filters</button><DataExportActions type="placement-applications" filters={exportFilters} compact /></div>
        </section>
        <p className="text-sm text-slate-600">{visible.length} application(s) match the current filters.</p>
        <section className="space-y-3">
          {visible.map(a => {
            const company = a.placementDrive?.company?.name || a.placementOpening?.company?.name || a.opportunity.organization;
            const next = NEXT[a.status] || [];
            return <article key={a.id} className="rounded-2xl border bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-black text-slate-950">{a.student.firstName} {a.student.lastName}</h2><p className="mt-1 text-sm text-slate-600">{company} · {a.placementOpening?.role || a.opportunity.title}</p><p className="mt-1 text-xs text-slate-500">{a.student.profile?.admissionNumber ? "Admission no. " + a.student.profile.admissionNumber + " · " : ""}{a.student.email || ""}{a.appliedAt ? " · Applied " + new Date(a.appliedAt).toLocaleDateString("en-IN") : ""}</p></div><span className="h-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-black">{a.status.replaceAll("_", " ")}</span></div>
              {next.length > 0 && <div className="mt-4 flex flex-wrap gap-2">{next.map(status => <button key={status} type="button" disabled={busy !== null} onClick={() => void transition(a, status)} className={status === "REJECTED" || status === "WITHDRAWN" ? "rounded-xl border border-red-200 px-3 py-2 text-xs font-bold text-red-700 disabled:opacity-50" : "rounded-xl border border-emerald-200 px-3 py-2 text-xs font-bold text-emerald-800 disabled:opacity-50"}>{busy === a.id ? "Updating…" : status.replaceAll("_", " ")}</button>)}</div>}
            </article>;
          })}
          {!visible.length && <div className="rounded-2xl border border-dashed bg-white p-10 text-center text-sm text-slate-600">No applications match the current filters.</div>}
        </section>
        <button type="button" onClick={() => void load()} disabled={busy !== null} className="rounded-xl border bg-white px-4 py-2 text-sm font-bold">Refresh applications</button>
      </div>
    </DashboardShell>
  );
}
