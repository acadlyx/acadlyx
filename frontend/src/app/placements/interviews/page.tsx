"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AuthRequiredError, authedFetch, HttpRequestError } from "@/lib/auth";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import DataExportActions from "@/components/dashboard/DataExportActions";

type Participant = { student: { firstName: string; lastName: string }; attendanceStatus: string; resultStatus: string };
type Interview = { id: string; roundNumber: number; roundType: string; startsAt: string; status: string; drive: { title: string; company: { name: string } }; participants: Participant[] };
type Drive = { id: string; title: string; status: string; company: { name: string } };
type ScopeOption = { id: string; name: string; code?: string; completionYear?: number };
type Student = { id: string; firstName: string; lastName: string; idNumber?: string | null };
type AudiencePreview = { matchingCount: number; sample: Array<{ id: string; firstName: string; lastName: string }>; truncated: boolean };
function toDateTimeLocal(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

export default function PlacementInterviewsPage() {
  const router = useRouter();
  const [items, setItems] = useState<Interview[]>([]);
  const [drives, setDrives] = useState<Drive[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [campuses, setCampuses] = useState<ScopeOption[]>([]);
  const [departments, setDepartments] = useState<ScopeOption[]>([]);
  const [programs, setPrograms] = useState<ScopeOption[]>([]);
  const [batches, setBatches] = useState<ScopeOption[]>([]);
  const [semesters, setSemesters] = useState<ScopeOption[]>([]);
  const [sections, setSections] = useState<ScopeOption[]>([]);
  const [audiencePreview, setAudiencePreview] = useState<AudiencePreview | null>(null);
  const [previewingAudience, setPreviewingAudience] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const [interviews, driveList, studentList] = await Promise.all([
        authedFetch<{ data: Interview[] }>("/placements/interviews"),
        authedFetch<{ data: Drive[] }>("/placements/drives?page=1&pageSize=100"),
        authedFetch<{ data: Student[] }>("/placements/students?page=1&pageSize=100"),
      ]);
      setItems(interviews.data || []);
      setDrives(driveList.data || []);
      setStudents(studentList.data || []);
      const criteriaResult = await Promise.allSettled([
        authedFetch<{ data: ScopeOption[] }>("/campuses"),
        authedFetch<{ data: ScopeOption[] }>("/departments"),
        authedFetch<{ data: ScopeOption[] }>("/programs"),
        authedFetch<{ data: ScopeOption[] }>("/batches"),
        authedFetch<{ data: { semesters: ScopeOption[]; sections: ScopeOption[] } }>("/placements/criteria-options"),
      ]);
      const [campusResult, departmentResult, programResult, batchResult, placementCriteriaResult] = criteriaResult;
      if (campusResult.status === "fulfilled") setCampuses(campusResult.value.data || []);
      if (departmentResult.status === "fulfilled") setDepartments(departmentResult.value.data || []);
      if (programResult.status === "fulfilled") setPrograms(programResult.value.data || []);
      if (batchResult.status === "fulfilled") setBatches(batchResult.value.data || []);
      if (placementCriteriaResult.status === "fulfilled") {
        setSemesters(placementCriteriaResult.value[4].status === "fulfilled" ? placementCriteriaResult.value[4].value.data.semesters || [] : []);
        setSections(placementCriteriaResult.value[4].status === "fulfilled" ? placementCriteriaResult.value[4].value.data.sections || [] : []);
      }

    } catch (e) {
      if (e instanceof AuthRequiredError) router.replace("/login");
      else setError(e instanceof HttpRequestError ? e.message : "Unable to load interviews.");
    }
  }, [router]);

  useEffect(() => { void load(); }, [load]);

  const exportFilters = useMemo(() => ({
    ...(search.trim() ? { search: search.trim() } : {}),
    ...(statusFilter !== "ALL" ? { status: statusFilter } : {}),
    ...(dateFrom ? { dateFrom: new Date(dateFrom + "T00:00:00").toISOString() } : {}),
    ...(dateTo ? { dateTo: new Date(dateTo + "T23:59:59.999").toISOString() } : {}),
  }), [search, statusFilter, dateFrom, dateTo]);

  const visibleItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((item) => {
      const matchesSearch = !q || [item.drive.title, item.drive.company.name, item.roundType, item.status].some(v => v.toLowerCase().includes(q));
      const matchesStatus = statusFilter === "ALL" || item.status === statusFilter;
      const time = new Date(item.startsAt).getTime();
      const from = dateFrom ? new Date(dateFrom + "T00:00:00").getTime() : null;
      const to = dateTo ? new Date(dateTo + "T23:59:59.999").getTime() : null;
      return matchesSearch && matchesStatus && (from === null || time >= from) && (to === null || time <= to);
    });
  }, [items, search, statusFilter, dateFrom, dateTo]);

  async function deleteDraft(id: string) {
    setBusy(true);
    setError("");
    try {
      await authedFetch("/placements/interviews/" + id, { method: "DELETE" });
      await load();
    } catch (cause) {
      if (cause instanceof AuthRequiredError) router.replace("/login");
      else setError(cause instanceof HttpRequestError ? cause.message : "Unable to delete this unused draft.");
    } finally { setBusy(false); }
  }

  async function updateInterview(id: string, payload: { startsAt?: string; status?: "DRAFT" | "SCHEDULED" | "CANCELLED" }) {
    setBusy(true);
    setError("");
    try {
      await authedFetch(`/placements/interviews/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
      await load();
    } catch (e) {
      if (e instanceof AuthRequiredError) router.replace("/login");
      else setError(e instanceof HttpRequestError ? e.message : "Unable to update interview.");
    } finally { setBusy(false); }
  }

  async function previewAudience(formElement: HTMLFormElement | null) {
    if (!formElement) return;
    const form = new FormData(formElement);
    const targeting = {
      campusIds: form.getAll("campusIds").filter((value): value is string => typeof value === "string"),
      departmentIds: form.getAll("departmentIds").filter((value): value is string => typeof value === "string"),
      programIds: form.getAll("programIds").filter((value): value is string => typeof value === "string"),
      batchIds: form.getAll("batchIds").filter((value): value is string => typeof value === "string"),
      semesterIds: form.getAll("semesterIds").filter((value): value is string => typeof value === "string"),
      sectionIds: form.getAll("sectionIds").filter((value): value is string => typeof value === "string"),
      graduatingYears: String(form.get("graduatingYears") || "").split(",").map((value) => Number(value.trim())).filter((value) => Number.isInteger(value) && value >= 2000 && value <= 2200),
    };
    const studentIds = form.getAll("studentIds").filter((value): value is string => typeof value === "string");
    setPreviewingAudience(true);
    setAudiencePreview(null);
    setError("");
    try {
      const response = await authedFetch<{ data: AudiencePreview }>("/placements/audience/preview", {
        method: "POST",
        body: JSON.stringify({ targeting, studentIds, driveId: form.get("driveId"), applicationStatuses: ["INTERVIEW"] }),
      });
      setAudiencePreview(response.data);
    } catch (cause) {
      if (cause instanceof AuthRequiredError) router.replace("/login");
      else setError(cause instanceof HttpRequestError ? cause.message : "Unable to preview interview candidates.");
    } finally { setPreviewingAudience(false); }
  }

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const schedulingStatus = String(form.get("status") || "SCHEDULED");
    if (schedulingStatus === "SCHEDULED" && (!audiencePreview || audiencePreview.matchingCount === 0)) {
      setError("Preview at least one intended candidate before scheduling this interview round.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await authedFetch("/placements/interviews", {
        method: "POST",
        body: JSON.stringify({
          driveId: form.get("driveId"),
          roundNumber: Number(form.get("roundNumber")),
          roundType: String(form.get("roundType") || "").trim(),
          status: String(form.get("status") || "SCHEDULED"),
          startsAt: new Date(String(form.get("startsAt"))).toISOString(),
          endsAt: form.get("endsAt") ? new Date(String(form.get("endsAt"))).toISOString() : undefined,
          venue: String(form.get("venue") || "").trim() || undefined,
          onlineLink: String(form.get("onlineLink") || "").trim() || undefined,
          interviewer: String(form.get("interviewer") || "").trim() || undefined,
          studentIds: form.getAll("studentIds").filter((value): value is string => typeof value === "string"),
          targeting: {
            campusIds: form.getAll("campusIds").filter((value): value is string => typeof value === "string"),
            departmentIds: form.getAll("departmentIds").filter((value): value is string => typeof value === "string"),
            programIds: form.getAll("programIds").filter((value): value is string => typeof value === "string"),
            batchIds: form.getAll("batchIds").filter((value): value is string => typeof value === "string"),
            semesterIds: form.getAll("semesterIds").filter((value): value is string => typeof value === "string"),
            sectionIds: form.getAll("sectionIds").filter((value): value is string => typeof value === "string"),
            graduatingYears: String(form.get("graduatingYears") || "").split(",").map((value) => Number(value.trim())).filter((value) => Number.isInteger(value) && value >= 2000 && value <= 2200),
          },
        }),
      });
      formElement.reset();
      await load();
    } catch (e) {
      if (e instanceof AuthRequiredError) router.replace("/login");
      else setError(e instanceof HttpRequestError ? e.message : "Unable to schedule interview.");
    } finally { setBusy(false); }
  }

  return (
    <DashboardShell title="Placement Interviews" subtitle="Schedule interview rounds, target institutional cohorts, manage timing and track student outcomes." allowedRoles={["PLACEMENT"]}>
      <div className="mx-auto max-w-6xl space-y-6">
        {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
        <form onSubmit={create} onChange={() => setAudiencePreview(null)} className="grid gap-3 rounded-3xl border bg-white p-6 md:grid-cols-2">
          <h2 className="text-lg font-black text-slate-950 md:col-span-2">Schedule interview round</h2>
          <label className="flex flex-col gap-1 text-sm font-semibold text-slate-700">Placement drive
            <select name="driveId" required className="rounded-xl border px-4 py-3"><option value="">Select drive</option>{drives.filter(d => !["DRAFT", "CANCELLED", "CLOSED"].includes(d.status)).map(d => <option key={d.id} value={d.id}>{d.title} · {d.company.name}</option>)}</select>
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold text-slate-700">Round number
            <input name="roundNumber" type="number" min="1" max="50" required className="rounded-xl border px-4 py-3" />
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold text-slate-700">Round type
            <input name="roundType" required placeholder="Technical / HR / GD" className="rounded-xl border px-4 py-3" />
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold text-slate-700">Start date and time
            <input name="startsAt" type="datetime-local" required className="rounded-xl border px-4 py-3" />
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold text-slate-700">Publication
            <select name="status" className="rounded-xl border bg-white px-4 py-3"><option value="SCHEDULED">Schedule and notify assigned students</option><option value="DRAFT">Save as draft without notifying students</option></select>
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold text-slate-700">End date and time
            <input name="endsAt" type="datetime-local" className="rounded-xl border px-4 py-3" />
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold text-slate-700">Venue
            <input name="venue" placeholder="Venue" className="rounded-xl border px-4 py-3" />
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold text-slate-700">Online link
            <input name="onlineLink" type="url" placeholder="https://…" className="rounded-xl border px-4 py-3" />
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold text-slate-700">Interviewer
            <input name="interviewer" placeholder="Interviewer name" className="rounded-xl border px-4 py-3" />
          </label>
          <fieldset className="grid gap-3 rounded-2xl border border-emerald-100 bg-emerald-50/40 p-4 md:col-span-2">
            <legend className="px-2 text-sm font-black text-slate-800">Cohort targeting</legend>
            <p className="text-xs font-normal text-slate-600">Matches active enrollments. Graduation year uses the configured batch completion year. Candidates already at the Interview stage are also assigned.</p>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm font-semibold text-slate-700">Campus<select name="campusIds" multiple size={3} className="rounded-xl border bg-white px-3 py-2 text-sm font-normal">{campuses.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
              <label className="flex flex-col gap-1 text-sm font-semibold text-slate-700">Department<select name="departmentIds" multiple size={3} className="rounded-xl border bg-white px-3 py-2 text-sm font-normal">{departments.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
              <label className="flex flex-col gap-1 text-sm font-semibold text-slate-700">Programme<select name="programIds" multiple size={3} className="rounded-xl border bg-white px-3 py-2 text-sm font-normal">{programs.map(x => <option key={x.id} value={x.id}>{x.name}{x.code ? ` · ${x.code}` : ""}</option>)}</select></label>
              <label className="flex flex-col gap-1 text-sm font-semibold text-slate-700">Batch<select name="batchIds" multiple size={3} className="rounded-xl border bg-white px-3 py-2 text-sm font-normal">{batches.map(x => <option key={x.id} value={x.id}>{x.name}{x.completionYear ? ` · graduates ${x.completionYear}` : ""}</option>)}</select></label>
              <label className="flex flex-col gap-1 text-sm font-semibold text-slate-700">Semester<select name="semesterIds" multiple size={3} className="rounded-xl border bg-white px-3 py-2 text-sm font-normal">{semesters.map(x => <option key={x.id} value={x.id}>{x.name}{x.code ? ` · ${x.code}` : ""}</option>)}</select></label>
              <label className="flex flex-col gap-1 text-sm font-semibold text-slate-700">Section<select name="sectionIds" multiple size={3} className="rounded-xl border bg-white px-3 py-2 text-sm font-normal">{sections.map(x => <option key={x.id} value={x.id}>{x.name}{x.code ? ` · ${x.code}` : ""}</option>)}</select></label>
              <label className="flex flex-col gap-1 text-sm font-semibold text-slate-700 md:col-span-2">Graduating year(s)<input name="graduatingYears" inputMode="numeric" placeholder="2027, 2028" className="rounded-xl border bg-white px-3 py-3 font-normal" /></label>
            </div>
          </fieldset>
          <label className="flex flex-col gap-1 text-sm font-semibold text-slate-700 md:col-span-2">Also target individual students (optional)
            <select name="studentIds" multiple size={4} className="rounded-xl border bg-white px-3 py-2 text-sm font-normal">{students.map(s => <option key={s.id} value={s.id}>{s.firstName} {s.lastName}{s.idNumber ? ` · ${s.idNumber}` : ""}</option>)}</select>
          </label>
          <div className="flex flex-wrap items-center gap-3 md:col-span-2">
            <button type="button" disabled={busy || previewingAudience} onClick={(event) => void previewAudience(event.currentTarget.form)} className="rounded-xl border border-emerald-300 px-4 py-2 text-sm font-bold text-emerald-800 disabled:opacity-50">{previewingAudience ? "Counting candidates…" : "Preview candidates"}</button>
            {audiencePreview && <span className="text-sm font-bold text-slate-800">{audiencePreview.matchingCount.toLocaleString("en-IN")} candidate(s){audiencePreview.truncated ? " · preview capped at 10,000" : ""}</span>}
          </div>
          {audiencePreview && <p className="rounded-xl border bg-slate-50 p-3 text-xs text-slate-700 md:col-span-2">Sample: {audiencePreview.sample.map((student) => student.firstName + " " + student.lastName).join(", ") || "No matching candidates"}{audiencePreview.matchingCount > audiencePreview.sample.length ? "…" : ""}</p>}
          <button disabled={busy} className="rounded-xl bg-emerald-700 px-5 py-3 text-sm font-black text-white disabled:opacity-50 md:col-span-2">{busy ? "Scheduling…" : "Schedule interview round"}</button>
        </form>
        <section className="grid gap-3 rounded-2xl border bg-white p-4 md:grid-cols-2 lg:grid-cols-4">
          <label className="flex flex-col gap-1 text-sm font-semibold text-slate-700 lg:col-span-2">Search interviews<input value={search} onChange={e => setSearch(e.target.value)} placeholder="Drive, company, round…" className="rounded-xl border px-3 py-3 font-normal" /></label>
          <label className="flex flex-col gap-1 text-sm font-semibold text-slate-700">Status<select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="rounded-xl border bg-white px-3 py-3"><option value="ALL">All statuses</option>{[...new Set(items.map(x => x.status))].sort().map(x => <option key={x}>{x}</option>)}</select></label>
          <div className="flex items-end"><DataExportActions type="placement-interviews" filters={exportFilters} compact /></div>
          <label className="flex flex-col gap-1 text-sm font-semibold text-slate-700">Scheduled from<input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="rounded-xl border px-3 py-3 font-normal" /></label>
          <label className="flex flex-col gap-1 text-sm font-semibold text-slate-700">Scheduled to<input type="date" value={dateTo} min={dateFrom || undefined} onChange={e => setDateTo(e.target.value)} className="rounded-xl border px-3 py-3 font-normal" /></label>
          <div className="flex items-end"><button type="button" onClick={() => { setSearch(""); setStatusFilter("ALL"); setDateFrom(""); setDateTo(""); }} className="rounded-xl border px-4 py-3 text-sm font-bold">Clear filters</button><span className="ml-3 text-sm text-slate-600">{visibleItems.length} interview(s)</span></div>
        </section>
        <section className="space-y-3">
        {visibleItems.map(i => <article key={i.id} className="rounded-2xl border bg-white p-5">
          <div className="flex flex-wrap justify-between gap-3"><div><h2 className="font-black">{i.drive.title} · Round {i.roundNumber}</h2><p className="text-sm text-slate-600">{i.drive.company.name} · {i.roundType}</p></div><span className="text-xs font-black">{i.status}</span></div>
          <p className="mt-2 text-xs text-slate-500">{new Date(i.startsAt).toLocaleString("en-IN")}</p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">{i.participants.map((p, index) => <div key={p.student.firstName + p.student.lastName + index} className="rounded-xl bg-slate-50 p-3 text-sm"><p className="font-bold">{p.student.firstName} {p.student.lastName}</p><p className="text-xs text-slate-500">{p.attendanceStatus} · {p.resultStatus}</p></div>)}</div>
          <div className="mt-4 flex flex-wrap items-end gap-2 border-t pt-3">
            <form className="flex flex-wrap items-end gap-2" onSubmit={e => { e.preventDefault(); const value = new FormData(e.currentTarget).get("startsAt"); if (typeof value === "string" && value) void updateInterview(i.id, { startsAt: new Date(value).toISOString() }); }}>
              <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">Reschedule<input name="startsAt" type="datetime-local" required defaultValue={toDateTimeLocal(i.startsAt)} disabled={busy || i.status === "CANCELLED"} className="rounded-lg border px-2 py-2 text-sm" /></label>
              <button type="submit" disabled={busy || i.status === "CANCELLED"} className="rounded-lg border px-3 py-2 text-xs font-bold disabled:opacity-50">Save time</button>
            </form>
            {i.status === "DRAFT" && <button type="button" disabled={busy} onClick={() => { if (window.confirm("Permanently delete this unused interview draft? Drafts with candidate assignments must be retained.")) void deleteDraft(i.id); }} className="rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-700 disabled:opacity-50">Delete draft</button>}
            {i.status === "DRAFT" && <button type="button" disabled={busy} onClick={() => void updateInterview(i.id, { status: "SCHEDULED" })} className="rounded-lg border border-emerald-200 px-3 py-2 text-xs font-bold text-emerald-800 disabled:opacity-50">Publish interview</button>}
            {i.status !== "CANCELLED" && <button type="button" disabled={busy} onClick={() => { if (window.confirm("Cancel this interview and notify assigned students?")) void updateInterview(i.id, { status: "CANCELLED" }); }} className="rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-700 disabled:opacity-50">Cancel interview</button>}
          </div>
        </article>)}
        {!visibleItems.length && <div className="rounded-2xl border border-dashed p-10 text-center text-sm text-slate-500">No interviews match the current filters.</div>}
        </section>
        <button type="button" onClick={() => void load()} disabled={busy} className="rounded-xl border bg-white px-4 py-2 text-sm font-bold">Refresh interviews</button>
      </div>
    </DashboardShell>
  );
}
