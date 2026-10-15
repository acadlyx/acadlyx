"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AuthRequiredError, authedFetch, HttpRequestError } from "@/lib/auth";
import { DashboardShell } from "@/components/dashboard/DashboardShell";

type Visit = { id: string; type: string; status: string; startsAt: string; endsAt: string | null; venue: string | null; purpose: string | null; company: { id: string; name: string }; drive: { id: string; title: string; status: string } | null };
type Company = { id: string; name: string };
type Student = { id: string; firstName: string; lastName: string; idNumber?: string | null };
type ScopeOption = { id: string; name: string; code?: string; completionYear?: number; program?: { name: string } };

export default function PlacementVisitsPage() {
  const router = useRouter();
  const [items, setItems] = useState<Visit[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [campuses, setCampuses] = useState<ScopeOption[]>([]);
  const [departments, setDepartments] = useState<ScopeOption[]>([]);
  const [programs, setPrograms] = useState<ScopeOption[]>([]);
  const [batches, setBatches] = useState<ScopeOption[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [visitsResponse, companiesResponse, studentsResponse] = await Promise.all([
        authedFetch<{ data: Visit[] }>("/placements/visits"),
        authedFetch<{ data: Company[] }>("/placements/companies"),
        authedFetch<{ data: Student[] }>("/placements/students?page=1&pageSize=100"),
      ]);
      setItems(visitsResponse.data || []);
      setCompanies(companiesResponse.data || []);
      setStudents(studentsResponse.data || []);
      // Scope dictionaries are optional for older institutional configurations;
      // their failure must not prevent staff from using explicit targeting.
      const [campusResult, departmentResult, programResult, batchResult] = await Promise.allSettled([
        authedFetch<{ data: ScopeOption[] }>("/campuses"),
        authedFetch<{ data: ScopeOption[] }>("/departments"),
        authedFetch<{ data: ScopeOption[] }>("/programs"),
        authedFetch<{ data: ScopeOption[] }>("/batches"),
      ]);
      if (campusResult.status === "fulfilled") setCampuses(campusResult.value.data || []);
      if (departmentResult.status === "fulfilled") setDepartments(departmentResult.value.data || []);
      if (programResult.status === "fulfilled") setPrograms(programResult.value.data || []);
      if (batchResult.status === "fulfilled") setBatches(batchResult.value.data || []);
    } catch (e) {
      if (e instanceof AuthRequiredError) router.replace("/login");
      else setError(e instanceof HttpRequestError ? e.message : "Unable to load company visits.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { void load(); }, [load]);

  async function updateVisit(id: string, payload: { startsAt?: string; status?: "PUBLISHED" | "CANCELLED" }) {
    setBusy(true);
    setError("");
    try {
      await authedFetch(`/placements/visits/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
      await load();
    } catch (e) {
      if (e instanceof AuthRequiredError) router.replace("/login");
      else setError(e instanceof HttpRequestError ? e.message : "Unable to update placement activity.");
    } finally {
      setBusy(false);
    }
  }

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setBusy(true);
    setError("");
    try {
      await authedFetch("/placements/visits", {
        method: "POST",
        body: JSON.stringify({
          companyId: form.get("companyId"),
          type: String(form.get("type") || "").trim(),
          startsAt: new Date(String(form.get("startsAt"))).toISOString(),
          endsAt: form.get("endsAt") ? new Date(String(form.get("endsAt"))).toISOString() : undefined,
          venue: String(form.get("venue") || "").trim() || undefined,
          purpose: String(form.get("purpose") || "").trim() || undefined,
          status: String(form.get("status") || "PUBLISHED"),
          notes: String(form.get("notes") || "").trim() || undefined,
          followUp: String(form.get("followUp") || "").trim() || undefined,
          participatingStudentIds: form.getAll("studentIds").filter((value): value is string => typeof value === "string"),
          targeting: {
            campusIds: form.getAll("campusIds").filter((value): value is string => typeof value === "string"),
            departmentIds: form.getAll("departmentIds").filter((value): value is string => typeof value === "string"),
            programIds: form.getAll("programIds").filter((value): value is string => typeof value === "string"),
            batchIds: form.getAll("batchIds").filter((value): value is string => typeof value === "string"),
            graduatingYears: String(form.get("graduatingYears") || "").split(",").map((value) => Number(value.trim())).filter((value) => Number.isInteger(value) && value >= 2000 && value <= 2200),
          },
        }),
      });
      formElement.reset();
      await load();
    } catch (e) {
      if (e instanceof AuthRequiredError) router.replace("/login");
      else setError(e instanceof HttpRequestError ? e.message : "Unable to create company visit.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <DashboardShell title="Company Visits & Presentations" subtitle="Schedule pre-placement talks, recruiter meetings, campus visits and targeted student events." allowedRoles={["PLACEMENT"]}>
      <div className="mx-auto max-w-7xl space-y-6">
        {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
        <form onSubmit={create} className="grid gap-4 rounded-3xl border bg-white p-6 md:grid-cols-2">
          <h2 className="text-lg font-black text-slate-950 md:col-span-2">Create a placement event</h2>
          <label className="flex flex-col gap-1 text-sm font-semibold text-slate-700">Company
            <select name="companyId" required className="rounded-xl border bg-white px-3 py-3"><option value="">Select company</option>{companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}</select>
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold text-slate-700">Activity type
            <input name="type" required minLength={2} maxLength={80} placeholder="Pre-placement talk / orientation / recruiter meeting" className="rounded-xl border px-3 py-3" />
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold text-slate-700">Start date and time
            <input name="startsAt" type="datetime-local" required className="rounded-xl border px-3 py-3" />
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold text-slate-700">End date and time
            <input name="endsAt" type="datetime-local" className="rounded-xl border px-3 py-3" />
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold text-slate-700">Venue
            <input name="venue" maxLength={300} placeholder="Auditorium / room" className="rounded-xl border px-3 py-3" />
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold text-slate-700">Purpose
            <input name="purpose" maxLength={1000} placeholder="What students should expect" className="rounded-xl border px-3 py-3" />
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold text-slate-700">Publication
            <select name="status" className="rounded-xl border bg-white px-3 py-3"><option value="PUBLISHED">Publish immediately</option><option value="DRAFT">Save as draft</option></select>
          </label>
          <fieldset className="grid gap-3 rounded-2xl border border-emerald-100 bg-emerald-50/40 p-4 md:col-span-2">
            <legend className="px-2 text-sm font-black text-slate-800">Cohort targeting</legend>
            <p className="text-xs font-normal text-slate-600">Select one or more institutional cohorts. A student is included when their active enrollment matches the selected filters; graduating year uses the institution&apos;s batch completion year. Cohort and individually selected students are combined.</p>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm font-semibold text-slate-700">Campus
                <select name="campusIds" multiple size={3} className="rounded-xl border bg-white px-3 py-2 text-sm font-normal">{campuses.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
              </label>
              <label className="flex flex-col gap-1 text-sm font-semibold text-slate-700">Department
                <select name="departmentIds" multiple size={3} className="rounded-xl border bg-white px-3 py-2 text-sm font-normal">{departments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
              </label>
              <label className="flex flex-col gap-1 text-sm font-semibold text-slate-700">Programme
                <select name="programIds" multiple size={3} className="rounded-xl border bg-white px-3 py-2 text-sm font-normal">{programs.map((item) => <option key={item.id} value={item.id}>{item.name}{item.code ? ` · ${item.code}` : ""}</option>)}</select>
              </label>
              <label className="flex flex-col gap-1 text-sm font-semibold text-slate-700">Batch
                <select name="batchIds" multiple size={3} className="rounded-xl border bg-white px-3 py-2 text-sm font-normal">{batches.map((item) => <option key={item.id} value={item.id}>{item.name}{item.completionYear ? ` · graduates ${item.completionYear}` : ""}</option>)}</select>
              </label>
              <label className="flex flex-col gap-1 text-sm font-semibold text-slate-700 md:col-span-2">Graduating year(s)
                <input name="graduatingYears" inputMode="numeric" placeholder="2027, 2028" className="rounded-xl border bg-white px-3 py-3 font-normal" />
              </label>
            </div>
          </fieldset>
          <label className="flex flex-col gap-1 text-sm font-semibold text-slate-700 md:col-span-2">Also target individual students (optional)
            <select name="studentIds" multiple size={5} className="rounded-xl border bg-white px-3 py-2 text-sm font-normal">
              {students.map((student) => <option key={student.id} value={student.id}>{student.firstName} {student.lastName}{student.idNumber ? ` · ${student.idNumber}` : ""}</option>)}
            </select>
            <span className="text-xs font-normal text-slate-500">Student choices are limited to records visible to your authorised placement scope; the backend revalidates every selection.</span>
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold text-slate-700">Private staff notes
            <textarea name="notes" rows={2} maxLength={5000} className="rounded-xl border px-3 py-3" />
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold text-slate-700">Staff follow-up
            <textarea name="followUp" rows={2} maxLength={5000} className="rounded-xl border px-3 py-3" />
          </label>
          <button disabled={busy || loading || companies.length === 0} className="rounded-xl bg-emerald-700 px-5 py-3 text-sm font-black text-white disabled:opacity-50 md:col-span-2">{busy ? "Creating…" : "Create targeted event"}</button>
        </form>
        <section className="grid gap-4 md:grid-cols-2">
          {items.map((visit) => <article key={visit.id} className="rounded-2xl border bg-white p-5">
            <div className="flex flex-wrap justify-between gap-3"><div><h2 className="font-black text-slate-950">{visit.company.name}</h2><p className="text-sm text-slate-600">{visit.type}{visit.drive ? ` · ${visit.drive.title}` : ""}</p></div><time className="text-xs font-bold text-slate-500">{new Date(visit.startsAt).toLocaleString("en-IN")}</time></div>
            {visit.endsAt && <p className="mt-2 text-xs text-slate-500">Ends {new Date(visit.endsAt).toLocaleString("en-IN")}</p>}
            {visit.venue && <p className="mt-3 text-sm">Venue: {visit.venue}</p>}
            {visit.purpose && <p className="mt-1 text-sm text-slate-600">{visit.purpose}</p>}
            <div className="mt-4 flex flex-wrap items-end gap-2 border-t pt-3">
              <form className="flex flex-wrap items-end gap-2" onSubmit={(event) => { event.preventDefault(); const value = new FormData(event.currentTarget).get("startsAt"); if (typeof value === "string" && value) void updateVisit(visit.id, { startsAt: new Date(value).toISOString() }); }}>
                <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">Reschedule
                  <input name="startsAt" type="datetime-local" required defaultValue={new Date(visit.startsAt).toISOString().slice(0, 16)} disabled={busy || visit.status === "CANCELLED"} className="rounded-lg border px-2 py-2 text-sm" />
                </label>
                <button type="submit" disabled={busy || visit.status === "CANCELLED"} className="rounded-lg border px-3 py-2 text-xs font-bold disabled:opacity-50">Save time</button>
              </form>
              <span className="text-xs font-bold text-slate-500">Status: {visit.status}</span>
              {visit.status === "DRAFT" && <button type="button" disabled={busy} onClick={() => void updateVisit(visit.id, { status: "PUBLISHED" })} className="rounded-lg border border-emerald-200 px-3 py-2 text-xs font-bold text-emerald-800 disabled:opacity-50">Publish activity</button>}
              {visit.status !== "CANCELLED" && <button type="button" disabled={busy} onClick={() => { if (window.confirm("Cancel this placement activity and notify its targeted students?")) void updateVisit(visit.id, { status: "CANCELLED" }); }} className="rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-700 disabled:opacity-50">Cancel activity</button>}
            </div>
          </article>)}
          {!loading && items.length === 0 && <div className="rounded-2xl border border-dashed p-10 text-center text-sm text-slate-500 md:col-span-2">No company visits or presentations recorded.</div>}
        </section>
        <button type="button" onClick={() => void load()} disabled={loading} className="rounded-xl border bg-white px-4 py-2 text-sm font-bold">{loading ? "Refreshing…" : "Refresh events"}</button>
      </div>
    </DashboardShell>
  );
}
