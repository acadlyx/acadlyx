"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AuthRequiredError, authedFetch, HttpRequestError } from "@/lib/auth";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import DataExportActions from "@/components/dashboard/DataExportActions";

type Application = { id: string; status: string; student: { id: string; firstName: string; lastName: string }; opportunity: { title: string; organization: string } };
type Offer = { id: string; status: string; joiningStatus?: string | null; role: string; totalCtc: number | null; fixedCtc?: number | null; variableCtc?: number | null; bonus?: number | null; currency: string; offerDate: string; responseDeadline: string | null; joiningDate: string | null; offerDocumentUrl?: string | null; notes?: string | null; company: { name: string }; student?: { firstName: string; lastName: string } };

function toDateTimeLocal(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

export default function PlacementOffersPage() {
  const router = useRouter();
  const [apps, setApps] = useState<Application[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [joiningStatusFilter, setJoiningStatusFilter] = useState("ALL");
  const [companyFilter, setCompanyFilter] = useState("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [editingOfferId, setEditingOfferId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError("");
    try {
      const [a, o] = await Promise.all([
        authedFetch<{ data: Application[] }>("/placements/applications"),
        authedFetch<{ data: Offer[] }>("/placements/offers"),
      ]);
      setApps(a.data || []);
      setOffers(o.data || []);
    } catch (e) {
      if (e instanceof AuthRequiredError) { router.replace("/login"); return; }
      setError(e instanceof HttpRequestError ? e.message : "Unable to load offers.");
    }
  }, [router]);

  useEffect(() => { void load(); }, [load]);

  const exportFilters = useMemo(() => ({
    ...(search.trim() ? { search: search.trim() } : {}),
    ...(statusFilter !== "ALL" ? { status: statusFilter } : {}),
    ...(joiningStatusFilter !== "ALL" ? { joiningStatus: joiningStatusFilter } : {}),
    ...(companyFilter !== "ALL" ? { company: companyFilter } : {}),
    ...(dateFrom ? { dateFrom: new Date(dateFrom + "T00:00:00").toISOString() } : {}),
    ...(dateTo ? { dateTo: new Date(dateTo + "T23:59:59.999").toISOString() } : {}),
  }), [search, statusFilter, joiningStatusFilter, companyFilter, dateFrom, dateTo]);

  const visibleOffers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return offers.filter((o) => {
      const person = o.student ? o.student.firstName + " " + o.student.lastName : "";
      const matchesText = !q || [o.company.name, o.role, person, o.status].some((v) => v.toLowerCase().includes(q));
      const matchesStatus = statusFilter === "ALL" || o.status === statusFilter;
      const matchesJoining = joiningStatusFilter === "ALL" || (o.joiningStatus || "NOT_SET") === joiningStatusFilter;
      const matchesCompany = companyFilter === "ALL" || o.company.name === companyFilter;
      const date = new Date(o.offerDate).getTime();
      const from = dateFrom ? new Date(dateFrom + "T00:00:00").getTime() : null;
      const to = dateTo ? new Date(dateTo + "T23:59:59").getTime() : null;
      const matchesDate = (from === null || date >= from) && (to === null || date <= to);
      return matchesText && matchesStatus && matchesJoining && matchesCompany && matchesDate;
    });
  }, [offers, search, statusFilter, joiningStatusFilter, companyFilter, dateFrom, dateTo]);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const f = new FormData(formElement);
    setBusy("create");
    setError("");
    try {
      await authedFetch("/placements/offers", { method: "POST", body: JSON.stringify({
        applicationId: f.get("applicationId"), role: f.get("role"),
        offerDate: new Date(String(f.get("offerDate"))).toISOString(),
        responseDeadline: f.get("responseDeadline") ? new Date(String(f.get("responseDeadline"))).toISOString() : undefined,
        joiningDate: f.get("joiningDate") ? new Date(String(f.get("joiningDate"))).toISOString() : undefined,
        totalCtc: f.get("totalCtc") ? Number(f.get("totalCtc")) : undefined,
        fixedCtc: f.get("fixedCtc") ? Number(f.get("fixedCtc")) : undefined,
        variableCtc: f.get("variableCtc") ? Number(f.get("variableCtc")) : undefined,
        bonus: f.get("bonus") ? Number(f.get("bonus")) : undefined, currency: "INR",
      }) });
      formElement.reset();
      await load();
    } catch (cause) {
      if (cause instanceof AuthRequiredError) router.replace("/login");
      else setError(cause instanceof HttpRequestError ? cause.message : "Unable to create offer.");
    } finally { setBusy(null); }
  }

  async function reviseOffer(event: FormEvent<HTMLFormElement>, offer: Offer) {
    event.preventDefault();
    const f = new FormData(event.currentTarget);
    setBusy(offer.id);
    setError("");
    try {
      await authedFetch("/placements/offers/" + offer.id, { method: "PATCH", body: JSON.stringify({
        role: String(f.get("role") || "").trim(),
        offerDate: new Date(String(f.get("offerDate"))).toISOString(),
        responseDeadline: f.get("responseDeadline") ? new Date(String(f.get("responseDeadline"))).toISOString() : null,
        joiningDate: f.get("joiningDate") ? new Date(String(f.get("joiningDate"))).toISOString() : null,
        totalCtc: f.get("totalCtc") === "" ? null : Number(f.get("totalCtc")),
        fixedCtc: f.get("fixedCtc") === "" ? null : Number(f.get("fixedCtc")),
        variableCtc: f.get("variableCtc") === "" ? null : Number(f.get("variableCtc")),
        bonus: f.get("bonus") === "" ? null : Number(f.get("bonus")),
      }) });
      setEditingOfferId(null);
      await load();
    } catch (cause) {
      if (cause instanceof AuthRequiredError) router.replace("/login");
      else setError(cause instanceof HttpRequestError ? cause.message : "Unable to revise offer.");
    } finally { setBusy(null); }
  }

  async function changeStatus(offer: Offer, status: string) {
    setBusy(offer.id);
    setError("");
    try {
      await authedFetch("/placements/offers/" + offer.id + "/status", { method: "POST", body: JSON.stringify({ status }) });
      await load();
    } catch (cause) {
      if (cause instanceof AuthRequiredError) router.replace("/login");
      else setError(cause instanceof HttpRequestError ? cause.message : "Unable to update offer status.");
    } finally { setBusy(null); }
  }

  async function verifyJoining(event: FormEvent<HTMLFormElement>, offer: Offer) {
    event.preventDefault();
    const f = new FormData(event.currentTarget);
    setBusy(offer.id);
    setError("");
    try {
      await authedFetch("/placements/offers/" + offer.id + "/joining-verification", { method: "POST", body: JSON.stringify({
        status: "VERIFIED",
        actualJoiningDate: f.get("actualJoiningDate") ? new Date(String(f.get("actualJoiningDate"))).toISOString() : undefined,
        notes: String(f.get("notes") || "").trim() || undefined,
      }) });
      await load();
    } catch (cause) {
      if (cause instanceof AuthRequiredError) router.replace("/login");
      else setError(cause instanceof HttpRequestError ? cause.message : "Unable to verify joining.");
    } finally { setBusy(null); }
  }

  return (
    <DashboardShell title="Placement Offers" subtitle="Track offer issuance, student responses, joining readiness and verified joining outcomes." allowedRoles={["PLACEMENT"]}>
      <div className="mx-auto max-w-7xl space-y-6">
        {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
        <form onSubmit={create} className="grid gap-3 rounded-3xl border bg-white p-6 md:grid-cols-2">
          <h2 className="text-lg font-black md:col-span-2">Create offer</h2>
          <label className="flex flex-col gap-1 text-sm font-semibold text-slate-700">Selected candidate<select name="applicationId" required className="rounded-xl border bg-white px-4 py-3"><option value="">Select selected candidate</option>{apps.filter(a => a.status === "SELECTED").map(a => <option key={a.id} value={a.id}>{a.student.firstName} {a.student.lastName} · {a.opportunity.organization}</option>)}</select><span className="text-xs font-normal text-slate-500">Only explicitly selected candidates are offerable. Interview scheduling alone never issues an offer.</span></label>
          <label className="flex flex-col gap-1 text-sm font-semibold text-slate-700">Offered role<input name="role" required minLength={2} maxLength={200} className="rounded-xl border px-4 py-3" placeholder="Job title" /></label>
          <label className="flex flex-col gap-1 text-sm font-semibold text-slate-700">Offer date<input name="offerDate" type="datetime-local" required className="rounded-xl border px-4 py-3" /></label>
          <label className="flex flex-col gap-1 text-sm font-semibold text-slate-700">Student response deadline<input name="responseDeadline" type="datetime-local" className="rounded-xl border px-4 py-3" /><span className="text-xs font-normal text-slate-500">An in-app reminder is scheduled for the final 24 hours and final hour.</span></label>
          <label className="flex flex-col gap-1 text-sm font-semibold text-slate-700">Expected joining date<input name="joiningDate" type="datetime-local" className="rounded-xl border px-4 py-3" /></label>
          <label className="flex flex-col gap-1 text-sm font-semibold text-slate-700">Total CTC (INR)<input name="totalCtc" type="number" min="0" step="0.01" className="rounded-xl border px-4 py-3" /></label>
          <label className="flex flex-col gap-1 text-sm font-semibold text-slate-700">Fixed CTC (INR)<input name="fixedCtc" type="number" min="0" step="0.01" className="rounded-xl border px-4 py-3" /></label>
          <label className="flex flex-col gap-1 text-sm font-semibold text-slate-700">Variable CTC (INR)<input name="variableCtc" type="number" min="0" step="0.01" className="rounded-xl border px-4 py-3" /></label>
          <label className="flex flex-col gap-1 text-sm font-semibold text-slate-700">Bonus (INR)<input name="bonus" type="number" min="0" step="0.01" className="rounded-xl border px-4 py-3" /></label>
          <button disabled={busy !== null} className="rounded-xl bg-emerald-700 px-5 py-3 text-sm font-black text-white disabled:opacity-50 md:col-span-2">{busy === "create" ? "Creating offer…" : "Create offer"}</button>
        </form>
        <section className="space-y-4">
          <div className="grid gap-3 rounded-2xl border bg-white p-4 md:grid-cols-2 lg:grid-cols-3">
            <label className="flex flex-col gap-1 text-sm font-semibold text-slate-700">Search offers<input value={search} onChange={e => setSearch(e.target.value)} placeholder="Student, company, role…" className="rounded-xl border px-3 py-3 font-normal" /></label>
            <label className="flex flex-col gap-1 text-sm font-semibold text-slate-700">Offer status<select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="rounded-xl border bg-white px-3 py-3"><option value="ALL">All statuses</option>{[...new Set(offers.map(o => o.status))].sort().map(s => <option key={s} value={s}>{s.replaceAll("_", " ")}</option>)}</select></label>
            <label className="flex flex-col gap-1 text-sm font-semibold text-slate-700">Joining status<select value={joiningStatusFilter} onChange={e => setJoiningStatusFilter(e.target.value)} className="rounded-xl border bg-white px-3 py-3"><option value="ALL">All joining statuses</option>{[...new Set(offers.map(o => o.joiningStatus || "NOT_SET"))].sort().map(s => <option key={s} value={s}>{s.replaceAll("_", " ")}</option>)}</select></label>
            <label className="flex flex-col gap-1 text-sm font-semibold text-slate-700">Company<select value={companyFilter} onChange={e => setCompanyFilter(e.target.value)} className="rounded-xl border bg-white px-3 py-3"><option value="ALL">All companies</option>{[...new Set(offers.map(o => o.company.name))].sort().map(s => <option key={s}>{s}</option>)}</select></label>
            <label className="flex flex-col gap-1 text-sm font-semibold text-slate-700">Offer date from<input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="rounded-xl border px-3 py-3 font-normal" /></label>
            <label className="flex flex-col gap-1 text-sm font-semibold text-slate-700">Offer date to<input type="date" value={dateTo} min={dateFrom || undefined} onChange={e => setDateTo(e.target.value)} className="rounded-xl border px-3 py-3 font-normal" /></label>
            <div className="flex flex-wrap items-end gap-2 lg:col-span-3"><button type="button" onClick={() => { setSearch(""); setStatusFilter("ALL"); setJoiningStatusFilter("ALL"); setCompanyFilter("ALL"); setDateFrom(""); setDateTo(""); }} className="rounded-xl border px-4 py-2 text-sm font-bold">Clear filters</button><DataExportActions type="placement-offers" filters={exportFilters} compact /></div>
          </div>
          <p className="text-sm text-slate-600">{visibleOffers.length} offer(s) match the current filters.</p>
          <div className="grid gap-4 md:grid-cols-2">
            {visibleOffers.map(o => <article key={o.id} className="space-y-3 rounded-2xl border bg-white p-5">
              <div className="flex justify-between gap-3"><div><h2 className="font-black">{o.company.name}</h2><p className="text-sm text-slate-600">{o.role}{o.student ? " · " + o.student.firstName + " " + o.student.lastName : ""}</p></div><span className="h-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-black">{o.status.replaceAll("_", " ")}</span></div>
              <p className="text-sm font-bold">{o.totalCtc == null ? "Package not set" : o.currency + " " + Number(o.totalCtc).toLocaleString("en-IN")}</p>
              <p className="text-xs text-slate-500">Offered {new Date(o.offerDate).toLocaleDateString("en-IN")}{o.responseDeadline ? " · Respond by " + new Date(o.responseDeadline).toLocaleString("en-IN") : ""}{o.joiningDate ? " · Expected joining " + new Date(o.joiningDate).toLocaleDateString("en-IN") : ""}</p>
              {o.status === "OFFERED" && <button type="button" disabled={busy !== null} onClick={() => setEditingOfferId(editingOfferId === o.id ? null : o.id)} className="rounded-xl border px-3 py-2 text-sm font-bold disabled:opacity-50">{editingOfferId === o.id ? "Close revision" : "Revise offer"}</button>}
              {editingOfferId === o.id && o.status === "OFFERED" && <form onSubmit={(event) => void reviseOffer(event, o)} className="grid gap-2 rounded-xl border border-emerald-100 bg-emerald-50/40 p-3 sm:grid-cols-2">
                <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600 sm:col-span-2">Role<input name="role" required minLength={2} maxLength={200} defaultValue={o.role} className="rounded-lg border bg-white px-3 py-2 text-sm font-normal" /></label>
                <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">Offer date<input name="offerDate" type="datetime-local" required defaultValue={toDateTimeLocal(o.offerDate)} className="rounded-lg border bg-white px-3 py-2 text-sm font-normal" /></label>
                <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">Response deadline<input name="responseDeadline" type="datetime-local" defaultValue={toDateTimeLocal(o.responseDeadline)} className="rounded-lg border bg-white px-3 py-2 text-sm font-normal" /></label>
                <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">Joining date<input name="joiningDate" type="datetime-local" defaultValue={toDateTimeLocal(o.joiningDate)} className="rounded-lg border bg-white px-3 py-2 text-sm font-normal" /></label>
                <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">Total CTC<input name="totalCtc" type="number" min="0" step="0.01" defaultValue={o.totalCtc ?? ""} className="rounded-lg border bg-white px-3 py-2 text-sm font-normal" /></label>
                <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">Fixed CTC<input name="fixedCtc" type="number" min="0" step="0.01" defaultValue={o.fixedCtc ?? ""} className="rounded-lg border bg-white px-3 py-2 text-sm font-normal" /></label>
                <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">Variable CTC<input name="variableCtc" type="number" min="0" step="0.01" defaultValue={o.variableCtc ?? ""} className="rounded-lg border bg-white px-3 py-2 text-sm font-normal" /></label>
                <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">Bonus<input name="bonus" type="number" min="0" step="0.01" defaultValue={o.bonus ?? ""} className="rounded-lg border bg-white px-3 py-2 text-sm font-normal" /></label>
                <button type="submit" disabled={busy !== null} className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-bold text-white disabled:opacity-50 sm:col-span-2">{busy === o.id ? "Saving revision…" : "Save offer revision"}</button>
              </form>}
              {o.status === "ACCEPTED" && <button type="button" disabled={busy !== null} onClick={() => void changeStatus(o, "JOINING_PENDING")} className="rounded-xl border border-emerald-200 px-3 py-2 text-sm font-bold text-emerald-800 disabled:opacity-50">Mark joining pending</button>}
              {["ACCEPTED", "JOINING_PENDING"].includes(o.status) && <form onSubmit={e => void verifyJoining(e, o)} className="grid gap-2 rounded-xl bg-slate-50 p-3">
                <p className="text-sm font-black">Verify joining</p>
                <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">Actual joining date<input name="actualJoiningDate" type="datetime-local" className="rounded-lg border bg-white px-3 py-2 text-sm font-normal" /></label>
                <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">Verification notes<textarea name="notes" maxLength={3000} rows={2} className="rounded-lg border bg-white px-3 py-2 text-sm font-normal" /></label>
                <button type="submit" disabled={busy !== null} className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-bold text-white disabled:opacity-50">{busy === o.id ? "Verifying…" : "Confirm joined"}</button>
              </form>}
            </article>)}
          </div>
          {!visibleOffers.length && <div className="rounded-2xl border border-dashed bg-white p-10 text-center text-sm text-slate-600">No offers match these filters.</div>}
        </section>
      </div>
    </DashboardShell>
  );
}
