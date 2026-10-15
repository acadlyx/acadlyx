"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AuthRequiredError, authedFetch, HttpRequestError } from "@/lib/auth";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import DataExportActions from "@/components/dashboard/DataExportActions";

type Company = { id: string; name: string };
type Opening = { id: string; role: string; employmentType: string | null; location: string | null; totalCtc: number | null; currency: string; deadline: string | null; company: Company; drives: Array<{ id: string; title: string; status: string }> };

export default function PlacementOpeningsPage() {
  const router = useRouter();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [items, setItems] = useState<Opening[]>([]);
  const [search, setSearch] = useState("");
  const [employmentType, setEmploymentType] = useState("ALL");
  const [location, setLocation] = useState("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError("");
    try {
      const [companyResponse, openingResponse] = await Promise.all([
        authedFetch<{ data: Company[] }>("/placements/companies"),
        authedFetch<{ data: Opening[] }>("/placements/openings"),
      ]);
      setCompanies(companyResponse.data || []);
      setItems(openingResponse.data || []);
    } catch (cause) {
      if (cause instanceof AuthRequiredError) { router.replace("/login"); return; }
      setError(cause instanceof HttpRequestError ? cause.message : "Unable to load job openings.");
    }
  }, [router]);

  useEffect(() => { void load(); }, [load]);

  const filters = useMemo(() => ({
    ...(search.trim() ? { search: search.trim() } : {}),
    ...(employmentType !== "ALL" ? { employmentType } : {}),
    ...(location.trim() ? { location: location.trim() } : {}),
    ...(dateFrom ? { dateFrom: new Date(dateFrom + "T00:00:00").toISOString() } : {}),
    ...(dateTo ? { dateTo: new Date(dateTo + "T23:59:59.999").toISOString() } : {}),
  }), [search, employmentType, location, dateFrom, dateTo]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((opening) => {
      const matchesSearch = !q || [opening.role, opening.company.name, opening.employmentType || "", opening.location || ""].some(v => v.toLowerCase().includes(q));
      const matchesType = employmentType === "ALL" || opening.employmentType?.toLowerCase() === employmentType.toLowerCase();
      const matchesLocation = location === "ALL" || (opening.location || "") === location;
      const deadline = opening.deadline ? new Date(opening.deadline).getTime() : null;
      const from = dateFrom ? new Date(dateFrom + "T00:00:00").getTime() : null;
      const to = dateTo ? new Date(dateTo + "T23:59:59.999").getTime() : null;
      const matchesDates = (from === null || (deadline !== null && deadline >= from)) && (to === null || (deadline !== null && deadline <= to));
      return matchesSearch && matchesType && matchesLocation && matchesDates;
    });
  }, [items, search, employmentType, location, dateFrom, dateTo]);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const f = new FormData(formElement);
    setBusy(true);
    setError("");
    try {
      await authedFetch("/placements/openings", { method: "POST", body: JSON.stringify({
        companyId: f.get("companyId"), role: f.get("role"), description: f.get("description") || undefined,
        employmentType: f.get("employmentType") || undefined, location: f.get("location") || undefined,
        totalCtc: f.get("ctc") ? Number(f.get("ctc")) : undefined, currency: "INR",
        deadline: f.get("deadline") ? new Date(String(f.get("deadline"))).toISOString() : undefined,
      }) });
      formElement.reset();
      await load();
    } catch (cause) {
      if (cause instanceof AuthRequiredError) router.replace("/login");
      else setError(cause instanceof HttpRequestError ? cause.message : "Unable to create opening.");
    } finally { setBusy(false); }
  }

  return (
    <DashboardShell title="Job Openings" subtitle="Manage employer roles, package information and deadlines linked to placement drives." allowedRoles={["PLACEMENT"]}>
      <div className="mx-auto max-w-7xl space-y-6">
        {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
        <form onSubmit={create} className="grid gap-3 rounded-3xl border bg-white p-6 md:grid-cols-2">
          <h2 className="text-lg font-black md:col-span-2">Create job opening</h2>
          <label className="flex flex-col gap-1 text-sm font-semibold text-slate-700">Company<select name="companyId" required className="rounded-xl border bg-white px-4 py-3"><option value="">Select company</option>{companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
          <label className="flex flex-col gap-1 text-sm font-semibold text-slate-700">Role title<input name="role" required minLength={2} maxLength={200} placeholder="Graduate Software Engineer" className="rounded-xl border px-4 py-3" /></label>
          <label className="flex flex-col gap-1 text-sm font-semibold text-slate-700">Employment type<select name="employmentType" className="rounded-xl border bg-white px-4 py-3"><option value="">Not specified</option><option>Full-time</option><option>Internship</option><option>Contract</option><option>Apprenticeship</option></select></label>
          <label className="flex flex-col gap-1 text-sm font-semibold text-slate-700">Location<input name="location" maxLength={200} placeholder="City / remote" className="rounded-xl border px-4 py-3" /></label>
          <label className="flex flex-col gap-1 text-sm font-semibold text-slate-700">Total CTC (INR)<input name="ctc" type="number" min="0" step="0.01" placeholder="Annual package" className="rounded-xl border px-4 py-3" /></label>
          <label className="flex flex-col gap-1 text-sm font-semibold text-slate-700">Application deadline<input name="deadline" type="datetime-local" className="rounded-xl border px-4 py-3" /></label>
          <label className="flex flex-col gap-1 text-sm font-semibold text-slate-700 md:col-span-2">Description<textarea name="description" maxLength={5000} rows={3} placeholder="Role responsibilities and requirements" className="rounded-xl border px-4 py-3 font-normal" /></label>
          <button disabled={busy} className="rounded-xl bg-emerald-700 px-5 py-3 text-sm font-black text-white disabled:opacity-50 md:col-span-2">{busy ? "Creating…" : "Create opening"}</button>
        </form>
        <section className="space-y-4">
          <div className="grid gap-3 rounded-2xl border bg-white p-4 md:grid-cols-2 lg:grid-cols-5">
            <label className="flex flex-col gap-1 text-sm font-semibold text-slate-700 lg:col-span-2">Search<input value={search} onChange={e => setSearch(e.target.value)} placeholder="Role, company, location…" className="rounded-xl border px-3 py-3 font-normal" /></label>
            <label className="flex flex-col gap-1 text-sm font-semibold text-slate-700">Employment<select value={employmentType} onChange={e => setEmploymentType(e.target.value)} className="rounded-xl border bg-white px-3 py-3"><option value="ALL">All types</option>{[...new Set(items.map(x => x.employmentType).filter((x): x is string => Boolean(x)))].sort().map(x => <option key={x}>{x}</option>)}</select></label>
            <label className="flex flex-col gap-1 text-sm font-semibold text-slate-700">Deadline from<input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="rounded-xl border px-3 py-3 font-normal" /></label>
            <label className="flex flex-col gap-1 text-sm font-semibold text-slate-700">Deadline to<input type="date" value={dateTo} min={dateFrom || undefined} onChange={e => setDateTo(e.target.value)} className="rounded-xl border px-3 py-3 font-normal" /></label>
            <label className="flex flex-col gap-1 text-sm font-semibold text-slate-700 lg:col-span-2">Location<select value={location} onChange={e => setLocation(e.target.value)} className="rounded-xl border bg-white px-3 py-3"><option value="ALL">All locations</option>{[...new Set(items.map(x => x.location).filter((x): x is string => Boolean(x)))].sort().map(x => <option key={x}>{x}</option>)}</select></label>
            <div className="flex items-end"><button type="button" onClick={() => { setSearch(""); setEmploymentType("ALL"); setLocation("ALL"); setDateFrom(""); setDateTo(""); }} className="rounded-xl border px-4 py-3 text-sm font-bold">Clear filters</button></div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-slate-600">{visible.length} opening(s) match filters.</p><DataExportActions type="placement-openings" filters={filters} compact /></div>
          <div className="grid gap-4 md:grid-cols-2">{visible.map(o => <article key={o.id} className="rounded-2xl border bg-white p-5"><h2 className="font-black">{o.role}</h2><p className="text-sm text-slate-600">{o.company.name} · {o.employmentType || "Employment type not set"}{o.location ? " · " + o.location : ""}</p><p className="mt-3 text-sm font-bold">{o.totalCtc == null ? "Package not set" : o.currency + " " + Number(o.totalCtc).toLocaleString("en-IN")}</p><p className="mt-2 text-xs text-slate-500">{o.deadline ? "Deadline " + new Date(o.deadline).toLocaleString("en-IN") : "No deadline set"} · {o.drives.length} linked drive(s)</p></article>)}</div>
          {!visible.length && <div className="rounded-2xl border border-dashed bg-white p-10 text-center text-sm text-slate-600">No openings match the current filters.</div>}
        </section>
      </div>
    </DashboardShell>
  );
}
