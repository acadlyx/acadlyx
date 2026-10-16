"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AuthRequiredError, authedFetch, HttpRequestError } from "@/lib/auth";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import DataExportActions from "@/components/dashboard/DataExportActions";

type Visit = { id: string; type: string; status: string; startsAt: string; endsAt: string | null; venue: string | null; purpose: string | null; participatingStudentIds?: string[] | null; company: { id: string; name: string }; drive: { id: string; title: string; status: string } | null };

function toDateTimeLocal(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}
type Company = { id: string; name: string };
type Drive = { id: string; title: string; status: string; company: { id: string; name: string } };
type Student = { id: string; firstName: string; lastName: string; idNumber?: string | null };
type ScopeOption = { id: string; name: string; code?: string; completionYear?: number; program?: { name: string } };
type AudiencePreview = { matchingCount: number; sample: Array<{ id: string; firstName: string; lastName: string }>; truncated: boolean };

export default function PlacementVisitsPage() {
  const router = useRouter();
  const [items, setItems] = useState<Visit[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
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
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [editingVisitId, setEditingVisitId] = useState<string | null>(null);
  const [editingAudienceVisitId, setEditingAudienceVisitId] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [visitsResponse, companiesResponse, studentsResponse, drivesResponse] = await Promise.all([
        authedFetch<{ data: Visit[] }>("/placements/visits"),
        authedFetch<{ data: Company[] }>("/placements/companies"),
        authedFetch<{ data: Student[] }>("/placements/students?page=1&pageSize=100"),
        authedFetch<{ data: Drive[] }>("/placements/drives?page=1&pageSize=100"),
      ]);
      setItems(visitsResponse.data || []);
      setCompanies(companiesResponse.data || []);
      setStudents(studentsResponse.data || []);
      setDrives((drivesResponse.data || []).filter((drive) => !["CANCELLED", "CLOSED"].includes(drive.status)));
      // Scope dictionaries are optional for older institutional configurations;
      // their failure must not prevent staff from using explicit targeting.
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
        setSemesters(placementCriteriaResult.value.data.semesters || []);
        setSections(placementCriteriaResult.value.data.sections || []);
      }

    } catch (e) {
      if (e instanceof AuthRequiredError) router.replace("/login");
      else setError(e instanceof HttpRequestError ? e.message : "Unable to load company visits.");
    } finally {
      setLoading(false);
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
      const matchesSearch = !q || [item.type, item.company.name, item.purpose || "", item.venue || "", item.status].some(v => v.toLowerCase().includes(q));
      const matchesStatus = statusFilter === "ALL" || item.status === statusFilter;
      const time = new Date(item.startsAt).getTime();
      const from = dateFrom ? new Date(dateFrom + "T00:00:00").getTime() : null;
      const to = dateTo ? new Date(dateTo + "T23:59:59.999").getTime() : null;
      return matchesSearch && matchesStatus && (from === null || time >= from) && (to === null || time <= to);
    });
  }, [items, search, statusFilter, dateFrom, dateTo]);

  async function updateVisit(id: string, payload: { type?: string; startsAt?: string; endsAt?: string | null; venue?: string | null; purpose?: string | null; status?: "DRAFT" | "PUBLISHED" | "CANCELLED"; participatingStudentIds?: string[]; targeting?: { campusIds?: string[]; departmentIds?: string[]; programIds?: string[]; batchIds?: string[]; semesterIds?: string[]; sectionIds?: string[]; graduatingYears?: number[] } }) {
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

  async function saveDetails(event: FormEvent<HTMLFormElement>, visit: Visit) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const startsAt = String(form.get("startsAt") || "");
    const endsAt = String(form.get("endsAt") || "");
    if (!startsAt) { setError("An activity start time is required."); return; }
    setBusy(true);
    setError("");
    try {
      await authedFetch(`/placements/visits/${visit.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          type: String(form.get("type") || "").trim(),
          startsAt: new Date(startsAt).toISOString(),
          endsAt: endsAt ? new Date(endsAt).toISOString() : null,
          venue: String(form.get("venue") || "").trim() || null,
          purpose: String(form.get("purpose") || "").trim() || null,
        }),
      });
      setEditingVisitId(null);
      await load();
    } catch (cause) {
      if (cause instanceof AuthRequiredError) router.replace("/login");
      else setError(cause instanceof HttpRequestError ? cause.message : "Unable to save activity changes.");
    } finally { setBusy(false); }
  }

  async function saveAudience(event: FormEvent<HTMLFormElement>, visit: Visit) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const studentIds = form.getAll("studentIds").filter((value): value is string => typeof value === "string");
    setBusy(true);
    setError("");
    try {
      await authedFetch(`/placements/visits/${visit.id}`, {
        method: "PATCH",
        body: JSON.stringify({ participatingStudentIds: studentIds }),
      });
      setEditingAudienceVisitId(null);
      setAudiencePreview(null);
      await load();
    } catch (cause) {
      if (cause instanceof AuthRequiredError) router.replace("/login");
      else setError(cause instanceof HttpRequestError ? cause.message : "Unable to update the activity audience.");
    } finally { setBusy(false); }
  }

  async function deleteDraft(visit: Visit) {
    if (visit.status !== "DRAFT") return;
    if (!window.confirm("Permanently delete this unused draft activity? Published activities are cancelled so student and audit history is preserved.")) return;
    setBusy(true);
    setError("");
    try {
      await authedFetch(`/placements/visits/${visit.id}`, { method: "DELETE" });
      await load();
    } catch (e) {
      if (e instanceof AuthRequiredError) router.replace("/login");
      else setError(e instanceof HttpRequestError ? e.message : "Unable to delete this draft activity.");
    } finally {
      setBusy(false);
    }
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
        method: "POST", body: JSON.stringify({
          targeting,
          studentIds,
          driveId: form.get("driveId") || undefined,
          applicationStatuses: ["APPLICATION_SUBMITTED", "SHORTLISTED", "TEST", "INTERVIEW", "SELECTED", "OFFERED", "ACCEPTED", "JOINED"],
        }),
      });
      setAudiencePreview(response.data);
    } catch (cause) {
      if (cause instanceof AuthRequiredError) router.replace("/login");
      else setError(cause instanceof HttpRequestError ? cause.message : "Unable to preview this placement audience.");
    } finally {
      setPreviewingAudience(false);
    }
  }

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const publicationStatus = String(form.get("status") || "PUBLISHED");
    if (publicationStatus === "PUBLISHED" && (!audiencePreview || audiencePreview.matchingCount === 0)) {
      setError("Preview an audience with at least one matching student before publishing this activity.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await authedFetch("/placements/visits", {
        method: "POST",
        body: JSON.stringify({
          companyId: form.get("companyId"),
          driveId: form.get("driveId") || undefined,
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
      else setError(e instanceof HttpRequestError ? e.message : "Unable to create company visit.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <DashboardShell title="Company Visits & Presentations" subtitle="Schedule pre-placement talks, recruiter meetings, campus visits and targeted student events." allowedRoles={["PLACEMENT"]}>
      <div className="mx-auto max-w-7xl space-y-6">
        {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
        <form onSubmit={create} onChange={() => setAudiencePreview(null)} className="grid gap-4 rounded-3xl border bg-white p-6 md:grid-cols-2">
          <h2 className="text-lg font-black text-slate-950 md:col-span-2">Create a placement event</h2>
          <label className="flex flex-col gap-1 text-sm font-semibold text-slate-700">Company
            <select name="companyId" required className="rounded-xl border bg-white px-3 py-3"><option value="">Select company</option>{companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}</select>
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold text-slate-700">Activity type
            <input name="type" required minLength={2} maxLength={80} placeholder="Pre-placement talk / orientation / recruiter meeting" className="rounded-xl border px-3 py-3" />
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold text-slate-700 md:col-span-2">Related placement drive (optional)
            <select name="driveId" className="rounded-xl border bg-white px-3 py-3"><option value="">No linked drive · use cohort/student targeting</option>{drives.filter((drive) => !["DRAFT", "CANCELLED", "CLOSED"].includes(drive.status)).map((drive) => <option key={drive.id} value={drive.id}>{drive.title} · {drive.company.name} · {drive.status}</option>)}</select>
            <span className="text-xs font-normal text-slate-500">When linked, the activity is restricted to that drive&apos;s student scope and may target its active applicants.</span>
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
              <label className="flex flex-col gap-1 text-sm font-semibold text-slate-700">Semester
                <select name="semesterIds" multiple size={3} className="rounded-xl border bg-white px-3 py-2 text-sm font-normal">{semesters.map((item) => <option key={item.id} value={item.id}>{item.name}{item.code ? ` · ${item.code}` : ""}</option>)}</select>
              </label>
              <label className="flex flex-col gap-1 text-sm font-semibold text-slate-700">Section
                <select name="sectionIds" multiple size={3} className="rounded-xl border bg-white px-3 py-2 text-sm font-normal">{sections.map((item) => <option key={item.id} value={item.id}>{item.name}{item.code ? ` · ${item.code}` : ""}</option>)}</select>
              </label>
              <label className="flex flex-col gap-1 text-sm font-semibold text-slate-700 md:col-span-2">Graduating year(s)
                <input name="graduatingYears" inputMode="numeric" placeholder="2027, 2028" className="rounded-xl border bg-white px-3 py-3 font-normal" />
              </label>
            </div>
          </fieldset>
          <div className="flex flex-wrap items-center gap-3 md:col-span-2">
            <button type="button" disabled={busy || previewingAudience} onClick={(event) => void previewAudience(event.currentTarget.form)} className="rounded-xl border border-emerald-300 px-4 py-2 text-sm font-bold text-emerald-800 disabled:opacity-50">{previewingAudience ? "Counting audience…" : "Preview audience"}</button>
            {audiencePreview && <span className="text-sm font-bold text-slate-800">{audiencePreview.matchingCount.toLocaleString("en-IN")} matching student(s){audiencePreview.truncated ? " · preview capped at 10,000" : ""}</span>}
          </div>
          {audiencePreview && <div className="rounded-xl border bg-slate-50 p-3 text-sm md:col-span-2">
            <p className="font-bold text-slate-900">Audience preview</p>
            <p className="mt-1 text-xs text-slate-600">Cohort filters and individual selections are combined. Published activities keep existing recipients in history when the audience is expanded.</p>
            {audiencePreview.sample.length > 0 && <p className="mt-2 text-xs text-slate-700">Sample: {audiencePreview.sample.map((student) => student.firstName + " " + student.lastName).join(", ")}{audiencePreview.matchingCount > audiencePreview.sample.length ? "…" : ""}</p>}
            {audiencePreview.matchingCount === 0 && <p className="mt-2 text-xs font-semibold text-amber-800">No students match these criteria. Choose a cohort or students before publishing.</p>}
          </div>}
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
        <section className="space-y-3">
          <div className="grid gap-3 rounded-2xl border bg-white p-4 md:grid-cols-2 lg:grid-cols-4">
            <label className="flex flex-col gap-1 text-sm font-semibold text-slate-700 lg:col-span-2">Search activities<input value={search} onChange={e => setSearch(e.target.value)} placeholder="Activity, company, venue…" className="rounded-xl border px-3 py-3 font-normal" /></label>
            <label className="flex flex-col gap-1 text-sm font-semibold text-slate-700">Status<select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="rounded-xl border bg-white px-3 py-3"><option value="ALL">All statuses</option>{[...new Set(items.map(x => x.status))].sort().map(x => <option key={x}>{x}</option>)}</select></label>
            <div className="flex items-end"><DataExportActions type="placement-visits" filters={exportFilters} compact /></div>
            <label className="flex flex-col gap-1 text-sm font-semibold text-slate-700">Starts from<input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="rounded-xl border px-3 py-3 font-normal" /></label>
            <label className="flex flex-col gap-1 text-sm font-semibold text-slate-700">Starts to<input type="date" value={dateTo} min={dateFrom || undefined} onChange={e => setDateTo(e.target.value)} className="rounded-xl border px-3 py-3 font-normal" /></label>
            <div className="flex items-end"><button type="button" onClick={() => { setSearch(""); setStatusFilter("ALL"); setDateFrom(""); setDateTo(""); }} className="rounded-xl border px-4 py-3 text-sm font-bold">Clear filters</button><span className="ml-3 text-sm text-slate-600">{visibleItems.length} event(s)</span></div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
          {visibleItems.map((visit) => <article key={visit.id} className="rounded-2xl border bg-white p-5">
            <div className="flex flex-wrap justify-between gap-3"><div><h2 className="font-black text-slate-950">{visit.company.name}</h2><p className="text-sm text-slate-600">{visit.type}{visit.drive ? ` · ${visit.drive.title}` : ""}</p></div><time className="text-xs font-bold text-slate-500">{new Date(visit.startsAt).toLocaleString("en-IN")}</time></div>
            {visit.endsAt && <p className="mt-2 text-xs text-slate-500">Ends {new Date(visit.endsAt).toLocaleString("en-IN")}</p>}
            {visit.venue && <p className="mt-3 text-sm">Venue: {visit.venue}</p>}
            {visit.purpose && <p className="mt-1 text-sm text-slate-600">{visit.purpose}</p>}
              {editingVisitId === visit.id && visit.status !== "CANCELLED" && <form onSubmit={(event) => void saveDetails(event, visit)} className="mt-4 grid gap-3 rounded-xl border bg-slate-50 p-4 sm:grid-cols-2">
                <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">Activity title/type<input name="type" required minLength={2} maxLength={80} defaultValue={visit.type} className="rounded-lg border bg-white px-3 py-2 text-sm font-normal" /></label>
                <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">Start<input name="startsAt" type="datetime-local" required defaultValue={toDateTimeLocal(visit.startsAt)} className="rounded-lg border bg-white px-3 py-2 text-sm font-normal" /></label>
                <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">End<input name="endsAt" type="datetime-local" defaultValue={toDateTimeLocal(visit.endsAt)} className="rounded-lg border bg-white px-3 py-2 text-sm font-normal" /></label>
                <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">Venue / meeting details<input name="venue" maxLength={300} defaultValue={visit.venue || ""} className="rounded-lg border bg-white px-3 py-2 text-sm font-normal" /></label>
                <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600 sm:col-span-2">Purpose / student instructions<textarea name="purpose" maxLength={1000} defaultValue={visit.purpose || ""} rows={2} className="rounded-lg border bg-white px-3 py-2 text-sm font-normal" /></label>
                <button type="submit" disabled={busy} className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-bold text-white disabled:opacity-50 sm:col-span-2">{busy ? "Saving…" : "Save activity changes"}</button>
              </form>}
              {editingAudienceVisitId === visit.id && visit.status !== "CANCELLED" && <form onSubmit={(event) => void saveAudience(event, visit)} className="mt-3 grid gap-2 rounded-xl border bg-slate-50 p-4">
                <p className="text-xs text-slate-600">{visit.status === "DRAFT" ? "For drafts, this replaces the current saved student audience." : "Published audience changes only add students; existing recipients are preserved for history and schedule updates."}</p>
                <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">Student audience<select name="studentIds" multiple size={5} defaultValue={visit.participatingStudentIds || []} className="rounded-lg border bg-white px-3 py-2 text-sm font-normal">{students.map((student) => <option key={student.id} value={student.id}>{student.firstName} {student.lastName}{student.idNumber ? ` · ${student.idNumber}` : ""}</option>)}</select></label>
                <button type="submit" disabled={busy} className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-bold text-white disabled:opacity-50">{busy ? "Saving…" : "Save audience"}</button>
              </form>}
            <div className="mt-4 flex flex-wrap items-end gap-2 border-t pt-3">
              <form className="flex flex-wrap items-end gap-2" onSubmit={(event) => { event.preventDefault(); const value = new FormData(event.currentTarget).get("startsAt"); if (typeof value === "string" && value) void updateVisit(visit.id, { startsAt: new Date(value).toISOString() }); }}>
                <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">Reschedule
                  <input name="startsAt" type="datetime-local" required defaultValue={toDateTimeLocal(visit.startsAt)} disabled={busy || visit.status === "CANCELLED"} className="rounded-lg border px-2 py-2 text-sm" />
                </label>
                <button type="submit" disabled={busy || visit.status === "CANCELLED"} className="rounded-lg border px-3 py-2 text-xs font-bold disabled:opacity-50">Save time</button>
              </form>
              <span className="text-xs font-bold text-slate-500">Status: {visit.status}</span>
              {visit.status !== "CANCELLED" && <button type="button" disabled={busy} onClick={() => setEditingVisitId(editingVisitId === visit.id ? null : visit.id)} className="rounded-lg border px-3 py-2 text-xs font-bold disabled:opacity-50">{editingVisitId === visit.id ? "Close details editor" : "Edit details"}</button>}
              {visit.status !== "CANCELLED" && <button type="button" disabled={busy} onClick={() => setEditingAudienceVisitId(editingAudienceVisitId === visit.id ? null : visit.id)} className="rounded-lg border px-3 py-2 text-xs font-bold disabled:opacity-50">{editingAudienceVisitId === visit.id ? "Close audience editor" : "Edit audience"}</button>}
              {visit.status === "DRAFT" && <button type="button" disabled={busy} onClick={() => void updateVisit(visit.id, { status: "PUBLISHED" })} className="rounded-lg border border-emerald-200 px-3 py-2 text-xs font-bold text-emerald-800 disabled:opacity-50">Publish activity</button>}
              {visit.status === "DRAFT" && <button type="button" disabled={busy} onClick={() => void deleteDraft(visit)} className="rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-700 disabled:opacity-50">Delete draft</button>}
              {visit.status !== "CANCELLED" && <button type="button" disabled={busy} onClick={() => { if (window.confirm("Cancel this placement activity and notify its targeted students?")) void updateVisit(visit.id, { status: "CANCELLED" }); }} className="rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-700 disabled:opacity-50">Cancel activity</button>}
            </div>
          </article>)}
          {!loading && visibleItems.length === 0 && <div className="rounded-2xl border border-dashed p-10 text-center text-sm text-slate-500 md:col-span-2">No activities match the current filters.</div>}
          </div>
        </section>
        <button type="button" onClick={() => void load()} disabled={loading} className="rounded-xl border bg-white px-4 py-2 text-sm font-bold">{loading ? "Refreshing…" : "Refresh events"}</button>
      </div>
    </DashboardShell>
  );
}
