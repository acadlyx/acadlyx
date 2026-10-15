"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AuthRequiredError, authedFetch, HttpRequestError } from "@/lib/auth";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import DataExportActions from "@/components/dashboard/DataExportActions";

type Option = { id: string; name: string };
type Company = Option;
type Criteria = {
  campuses: Option[];
  departments: Array<Option & { campusId: string | null }>;
  programs: Array<Option & { departmentId: string }>;
  batches: Array<Option & { programId: string; admissionYear: number; completionYear: number }>;
  semesters: Array<Option & { programId: string; academicYearId: string; number: number }>;
  skills: Option[];
};
type Drive = {
  id: string;
  title: string;
  status: string;
  applicationDeadline: string | null;
  driveDate: string | null;
  company: Company;
  opening: { role: string } | null;
  campusId?: string | null;
  eligiblePrograms?: string[];
  eligibleDepartments?: string[];
  eligibleBatches?: string[];
  eligibleSemesters?: string[];
  cgpaRequirement?: number | null;
  maxBacklogs?: number | null;
  venue?: string | null;
  requiredSkills?: string[];
  academicRequirements?: any;
  vacancies?: number | null;
};

const NEXT_STATUS: Record<string, string> = {
  DRAFT: "PUBLISHED",
  PUBLISHED: "APPLICATION_OPEN",
  APPLICATION_OPEN: "APPLICATION_CLOSED",
  APPLICATION_CLOSED: "SHORTLISTING",
  SHORTLISTING: "TEST",
  TEST: "INTERVIEW",
  INTERVIEW: "OFFERED",
  OFFERED: "ACCEPTED",
  ACCEPTED: "JOINED",
};

function MultiSelect({ label, name, options, selected = [] }: { label: string; name: string; options: Option[]; selected?: string[] }) {
  return (
    <label className="flex min-w-0 flex-col gap-1 text-sm font-semibold text-slate-700">
      {label}
      <select name={name} multiple defaultValue={selected} className="min-h-28 rounded-xl border bg-white px-3 py-2 text-sm font-normal" size={4}>
        {options.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
      </select>
      <span className="text-xs font-normal text-slate-500">Leave unselected to include all.</span>
    </label>
  );
}

export default function PlacementDrivesPage() {
  const router = useRouter();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [drives, setDrives] = useState<Drive[]>([]);
  const [criteria, setCriteria] = useState<Criteria | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [transitioning, setTransitioning] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [companyFilter, setCompanyFilter] = useState("ALL");
  const [campusFilter, setCampusFilter] = useState("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  async function load() {
    setError("");
    try {
      const [companyResponse, driveResponse, criteriaResponse] = await Promise.all([
        authedFetch<{ data: Company[] }>("/placements/companies"),
        authedFetch<{ data: Drive[] }>("/placements/drives?page=1&pageSize=100"),
        authedFetch<{ data: Criteria }>("/placements/criteria-options"),
      ]);
      setCompanies(companyResponse.data || []);
      setDrives(driveResponse.data || []);
      setCriteria(criteriaResponse.data);
    } catch (e) {
      if (e instanceof AuthRequiredError) router.replace("/login");
      else setError(e instanceof HttpRequestError ? e.message : "Unable to load placement drive setup.");
    }
  }

  useEffect(() => { void load(); }, []);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setBusy(true);
    setError("");
    const academicStatus = String(form.get("academicStatus") || "").trim();
    const payload = {
      companyId: form.get("companyId"),
      title: form.get("title"),
      campusId: form.get("campusId") || undefined,
      applicationDeadline: form.get("deadline") ? new Date(String(form.get("deadline"))).toISOString() : undefined,
      driveDate: form.get("driveDate") ? new Date(String(form.get("driveDate"))).toISOString() : undefined,
      venue: form.get("venue") || undefined,
      vacancies: form.get("vacancies") ? Number(form.get("vacancies")) : undefined,
      cgpaRequirement: form.get("cgpa") ? Number(form.get("cgpa")) : undefined,
      maxBacklogs: form.get("backlogs") !== "" ? Number(form.get("backlogs")) : undefined,
      eligiblePrograms: form.getAll("eligiblePrograms").filter((v): v is string => typeof v === "string"),
      eligibleDepartments: form.getAll("eligibleDepartments").filter((v): v is string => typeof v === "string"),
      eligibleBatches: form.getAll("eligibleBatches").filter((v): v is string => typeof v === "string"),
      eligibleSemesters: form.getAll("eligibleSemesters").filter((v): v is string => typeof v === "string"),
      requiredSkills: form.getAll("requiredSkills").filter((v): v is string => typeof v === "string"),
      academicRequirements: {
        ...(academicStatus ? { academicStatus } : {}),
        ...(form.get("graduationEligible") === "on" ? { graduationEligible: true } : {}),
        ...(form.get("allowIneligibleStudents") === "on" ? { allowIneligibleStudents: true } : {}),
      },
    };
    try {
      await authedFetch("/placements/drives", { method: "POST", body: JSON.stringify(payload) });
      formElement.reset();
      await load();
    } catch (e) {
      if (e instanceof AuthRequiredError) router.replace("/login");
      else setError(e instanceof HttpRequestError ? e.message : "Unable to create placement drive.");
    } finally {
      setBusy(false);
    }
  }

  const exportFilters = useMemo(() => ({
    ...(search.trim() ? { search: search.trim() } : {}),
    ...(statusFilter !== "ALL" ? { status: statusFilter } : {}),
    ...(companyFilter !== "ALL" ? { company: companies.find(c => c.id === companyFilter)?.name || companyFilter } : {}),
    ...(campusFilter !== "ALL" ? { campusId: campusFilter === "INSTITUTION" ? "__NULL__" : campusFilter } : {}),
    ...(dateFrom ? { dateFrom: new Date(dateFrom + "T00:00:00").toISOString() } : {}),
    ...(dateTo ? { dateTo: new Date(dateTo + "T23:59:59.999").toISOString() } : {}),
  }), [search, statusFilter, companyFilter, campusFilter, dateFrom, dateTo, companies]);

  const visibleDrives = useMemo(() => {
    const query = search.trim().toLowerCase();
    return drives.filter((drive) => {
      const matchesSearch = !query || [drive.title, drive.company.name, drive.opening?.role || "", drive.status].some(v => v.toLowerCase().includes(query));
      const matchesStatus = statusFilter === "ALL" || drive.status === statusFilter;
      const matchesCompany = companyFilter === "ALL" || drive.company.id === companyFilter;
      const matchesCampus = campusFilter === "ALL" || (drive.campusId || "ALL") === campusFilter;
      const date = drive.driveDate ? new Date(drive.driveDate).getTime() : null;
      const from = dateFrom ? new Date(dateFrom + "T00:00:00").getTime() : null;
      const to = dateTo ? new Date(dateTo + "T23:59:59").getTime() : null;
      const matchesDate = (from === null || (date !== null && date >= from)) && (to === null || (date !== null && date <= to));
      return matchesSearch && matchesStatus && matchesCompany && matchesCampus && matchesDate;
    });
  }, [drives, search, statusFilter, companyFilter, campusFilter, dateFrom, dateTo]);

  async function transition(drive: Drive) {
    const next = NEXT_STATUS[drive.status];
    if (!next) return;
    setTransitioning(drive.id);
    setError("");
    try {
      await authedFetch("/placements/drives/" + drive.id + "/status", {
        method: "POST",
        body: JSON.stringify({ status: next }),
      });
      await load();
    } catch (e) {
      if (e instanceof AuthRequiredError) router.replace("/login");
      else setError(e instanceof HttpRequestError ? e.message : "Unable to advance the drive workflow.");
    } finally {
      setTransitioning(null);
    }
  }

  async function deleteDraft(drive: Drive) {
    if (drive.status !== "DRAFT") return;
    if (!window.confirm("Permanently delete this unused draft drive? Published or related recruitment records are never destructively deleted.")) return;
    setTransitioning(drive.id);
    setError("");
    try {
      await authedFetch("/placements/drives/" + drive.id, { method: "DELETE" });
      await load();
    } catch (e) {
      if (e instanceof AuthRequiredError) router.replace("/login");
      else setError(e instanceof HttpRequestError ? e.message : "Unable to delete this draft drive.");
    } finally {
      setTransitioning(null);
    }
  }

  return (
    <DashboardShell title="Placement Drives" subtitle="Configure drive-specific eligibility, academic cohorts, and the recruitment lifecycle." allowedRoles={["PLACEMENT"]}>
      <div className="mx-auto max-w-7xl space-y-6">
        {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
        <form onSubmit={create} className="grid gap-4 rounded-3xl border bg-white p-6 md:grid-cols-2">
          <h2 className="text-lg font-black text-slate-950 md:col-span-2">Create a drive with its own criteria</h2>
          <label className="flex flex-col gap-1 text-sm font-semibold text-slate-700">Company
            <select name="companyId" required className="rounded-xl border bg-white px-4 py-3"><option value="">Select company</option>{companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}</select>
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold text-slate-700">Drive title
            <input name="title" required minLength={2} maxLength={200} className="rounded-xl border px-4 py-3" placeholder="e.g. Graduate Software Engineer" />
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold text-slate-700">Campus
            <select name="campusId" className="rounded-xl border bg-white px-4 py-3"><option value="">Institution-wide / all campuses</option>{criteria?.campuses.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}</select>
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold text-slate-700">Application deadline
            <input name="deadline" type="datetime-local" className="rounded-xl border px-4 py-3" />
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold text-slate-700">Drive date
            <input name="driveDate" type="datetime-local" className="rounded-xl border px-4 py-3" />
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold text-slate-700">Venue / online note
            <input name="venue" maxLength={300} className="rounded-xl border px-4 py-3" placeholder="Venue or online details" />
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold text-slate-700">Vacancies
            <input name="vacancies" type="number" min="1" max="100000" className="rounded-xl border px-4 py-3" placeholder="Number of openings" />
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold text-slate-700">Minimum CGPA (0–10)
            <input name="cgpa" type="number" min="0" max="10" step="0.01" className="rounded-xl border px-4 py-3" placeholder="No minimum" />
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold text-slate-700">Maximum active backlogs
            <input name="backlogs" type="number" min="0" max="100" step="1" className="rounded-xl border px-4 py-3" placeholder="No limit" />
          </label>
          {criteria && <>
            <MultiSelect label="Eligible programmes" name="eligiblePrograms" options={criteria.programs} />
            <MultiSelect label="Eligible departments" name="eligibleDepartments" options={criteria.departments} />
            <MultiSelect label="Eligible admission batches" name="eligibleBatches" options={criteria.batches.map((b) => ({ id: b.id, name: b.name + " (" + b.admissionYear + "–" + b.completionYear + ")" }))} />
            <MultiSelect label="Eligible semesters" name="eligibleSemesters" options={criteria.semesters.map((s) => ({ id: s.id, name: s.name }))} />
            <MultiSelect label="Required skills" name="requiredSkills" options={criteria.skills} />
          </>}
          <label className="flex flex-col gap-1 text-sm font-semibold text-slate-700">Required academic status
            <select name="academicStatus" className="rounded-xl border bg-white px-4 py-3"><option value="">Any status / no extra rule</option><option value="GOOD_STANDING">Good standing</option><option value="AT_RISK">At risk</option><option value="PROBATION">Probation</option></select>
          </label>
          <label className="flex items-center gap-3 rounded-xl border p-3 text-sm font-semibold text-slate-700">
            <input type="checkbox" name="graduationEligible" /> Must be confirmed eligible to graduate
          </label>
          <label className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm font-semibold text-amber-950 md:col-span-2">
            <input type="checkbox" name="allowIneligibleStudents" className="mt-1" />
            <span>Allow all otherwise-ineligible students to apply
              <span className="mt-1 block text-xs font-normal leading-5">Temporary override for incomplete CGPA, backlog or other eligibility data. Active enrollment, institution/campus security, duplicate prevention, application status and deadline are still enforced.</span>
            </span>
          </label>
          <p className="text-xs leading-5 text-slate-500 md:col-span-2">Eligibility is checked by the backend against the student’s active enrollment, authoritative academic snapshot and placement skills. Missing CGPA/backlog evidence does not silently qualify a student.</p>
          <button disabled={busy} className="rounded-xl bg-emerald-700 px-5 py-3 text-sm font-black text-white disabled:opacity-50 md:col-span-2">{busy ? "Creating…" : "Create draft drive"}</button>
        </form>

        <section className="space-y-3">
          <div><h2 className="text-xl font-black text-slate-950">Recruitment pipeline</h2><p className="text-sm text-slate-600">Advance each drive through the allowed server-side status transitions.</p></div>
          <div className="grid gap-3 rounded-2xl border bg-white p-4 md:grid-cols-2 lg:grid-cols-3">
            <label className="flex flex-col gap-1 text-sm font-semibold text-slate-700">Search drives<input value={search} onChange={e => setSearch(e.target.value)} placeholder="Drive, role, company…" className="rounded-xl border px-3 py-3 font-normal" /></label>
            <label className="flex flex-col gap-1 text-sm font-semibold text-slate-700">Lifecycle status<select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="rounded-xl border bg-white px-3 py-3"><option value="ALL">All statuses</option>{[...new Set(drives.map(d => d.status))].sort().map(s => <option key={s}>{s}</option>)}</select></label>
            <label className="flex flex-col gap-1 text-sm font-semibold text-slate-700">Company<select value={companyFilter} onChange={e => setCompanyFilter(e.target.value)} className="rounded-xl border bg-white px-3 py-3"><option value="ALL">All companies</option>{companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
            <label className="flex flex-col gap-1 text-sm font-semibold text-slate-700">Campus<select value={campusFilter} onChange={e => setCampusFilter(e.target.value)} className="rounded-xl border bg-white px-3 py-3"><option value="ALL">All campuses</option><option value="INSTITUTION">Institution-wide</option>{criteria?.campuses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
            <label className="flex flex-col gap-1 text-sm font-semibold text-slate-700">Drive date from<input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="rounded-xl border px-3 py-3 font-normal" /></label>
            <label className="flex flex-col gap-1 text-sm font-semibold text-slate-700">Drive date to<input type="date" value={dateTo} min={dateFrom || undefined} onChange={e => setDateTo(e.target.value)} className="rounded-xl border px-3 py-3 font-normal" /></label>
            <div className="flex flex-wrap items-end gap-2 lg:col-span-3"><button type="button" onClick={() => { setSearch(""); setStatusFilter("ALL"); setCompanyFilter("ALL"); setCampusFilter("ALL"); setDateFrom(""); setDateTo(""); }} className="rounded-xl border px-4 py-2 text-sm font-bold">Clear filters</button><DataExportActions type="placement-drives" filters={exportFilters} compact /></div>
          </div>
          <p className="text-sm text-slate-600">{visibleDrives.length} drive(s) match the current filters.</p>
          {visibleDrives.map((drive) => {
            const next = NEXT_STATUS[drive.status];
            return <article key={drive.id} className="rounded-2xl border bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div><h3 className="font-black text-slate-950">{drive.title}</h3><p className="text-sm text-slate-600">{drive.company.name}{drive.opening ? " · " + drive.opening.role : ""}</p></div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-700">{drive.status}</span>
              </div>
              <p className="mt-3 text-xs text-slate-500">{drive.applicationDeadline ? "Deadline " + new Date(drive.applicationDeadline).toLocaleString("en-IN") : "No deadline set"}{drive.driveDate ? " · Drive " + new Date(drive.driveDate).toLocaleString("en-IN") : ""}</p>
              {(drive.eligiblePrograms?.length || drive.eligibleDepartments?.length || drive.eligibleBatches?.length || drive.eligibleSemesters?.length) ? <p className="mt-2 text-xs text-slate-600">Academic cohort restrictions are configured for this drive.</p> : <p className="mt-2 text-xs text-slate-500">No programme, department, batch or semester restriction.</p>}
              <details className="mt-4 rounded-xl border p-3">
                <summary className="cursor-pointer text-sm font-bold text-emerald-800">Edit drive details and eligibility</summary>
                <form className="mt-3 grid gap-3 md:grid-cols-2" onSubmit={async (event) => {
                  event.preventDefault();
                  const form = new FormData(event.currentTarget);
                  const academicRequirements = { ...(drive.academicRequirements && typeof drive.academicRequirements === "object" ? drive.academicRequirements : {}), allowIneligibleStudents: form.get("allowIneligibleStudents") === "on" };
                  const payload = {
                    title: String(form.get("title") || "").trim(),
                    applicationDeadline: form.get("deadline") ? new Date(String(form.get("deadline"))).toISOString() : null,
                    driveDate: form.get("driveDate") ? new Date(String(form.get("driveDate"))).toISOString() : null,
                    venue: String(form.get("venue") || "").trim() || null,
                    cgpaRequirement: form.get("cgpa") === "" ? null : Number(form.get("cgpa")),
                    maxBacklogs: form.get("backlogs") === "" ? null : Number(form.get("backlogs")),
                    vacancies: form.get("vacancies") === "" ? null : Number(form.get("vacancies")),
                    eligiblePrograms: form.getAll("eligiblePrograms").filter((v): v is string => typeof v === "string"),
                    eligibleDepartments: form.getAll("eligibleDepartments").filter((v): v is string => typeof v === "string"),
                    eligibleBatches: form.getAll("eligibleBatches").filter((v): v is string => typeof v === "string"),
                    eligibleSemesters: form.getAll("eligibleSemesters").filter((v): v is string => typeof v === "string"),
                    requiredSkills: form.getAll("requiredSkills").filter((v): v is string => typeof v === "string"),
                    academicRequirements,
                  };
                  setTransitioning(drive.id); setError("");
                  try { await authedFetch("/placements/drives/" + drive.id, { method: "PATCH", body: JSON.stringify(payload) }); await load(); }
                  catch (e) { if (e instanceof AuthRequiredError) router.replace("/login"); else setError(e instanceof HttpRequestError ? e.message : "Unable to save drive changes."); }
                  finally { setTransitioning(null); }
                }}>
                  <label className="flex flex-col gap-1 text-xs font-semibold">Drive title<input name="title" required defaultValue={drive.title} className="rounded-lg border px-3 py-2 text-sm font-normal" /></label>
                  <label className="flex flex-col gap-1 text-xs font-semibold">Venue<input name="venue" defaultValue={drive.venue ?? ""} placeholder="Venue / online note" className="rounded-lg border px-3 py-2 text-sm font-normal" /></label>
                  <label className="flex flex-col gap-1 text-xs font-semibold">Application deadline<input name="deadline" type="datetime-local" defaultValue={drive.applicationDeadline ? new Date(new Date(drive.applicationDeadline).getTime()-new Date(drive.applicationDeadline).getTimezoneOffset()*60000).toISOString().slice(0,16) : ""} className="rounded-lg border px-3 py-2 text-sm font-normal" /></label>
                  <label className="flex flex-col gap-1 text-xs font-semibold">Drive date<input name="driveDate" type="datetime-local" defaultValue={drive.driveDate ? new Date(new Date(drive.driveDate).getTime()-new Date(drive.driveDate).getTimezoneOffset()*60000).toISOString().slice(0,16) : ""} className="rounded-lg border px-3 py-2 text-sm font-normal" /></label>
                  <label className="flex flex-col gap-1 text-xs font-semibold">Minimum CGPA<input name="cgpa" type="number" min="0" max="10" step="0.01" defaultValue={drive.cgpaRequirement ?? ""} className="rounded-lg border px-3 py-2 text-sm font-normal" /></label>
                  <label className="flex flex-col gap-1 text-xs font-semibold">Maximum backlogs<input name="backlogs" type="number" min="0" max="100" defaultValue={drive.maxBacklogs ?? ""} className="rounded-lg border px-3 py-2 text-sm font-normal" /></label>
                  <label className="flex flex-col gap-1 text-xs font-semibold">Vacancies<input name="vacancies" type="number" min="1" max="100000" defaultValue={drive.vacancies ?? ""} className="rounded-lg border px-3 py-2 text-sm font-normal" /></label>
                  <label className="flex items-center gap-2 rounded-lg border p-3 text-xs font-semibold md:col-span-2"><input type="checkbox" name="allowIneligibleStudents" defaultChecked={Boolean(drive.academicRequirements && typeof drive.academicRequirements === "object" && (drive.academicRequirements as Record<string, unknown>).allowIneligibleStudents === true)} /> Allow otherwise-ineligible students to apply (academic-data override)</label>
                  {criteria && <>
                    <MultiSelect label="Eligible programmes (empty = all)" name="eligiblePrograms" options={criteria.programs} />
                    <MultiSelect label="Eligible departments (empty = all)" name="eligibleDepartments" options={criteria.departments} />
                    <MultiSelect label="Eligible batches (empty = all)" name="eligibleBatches" options={criteria.batches.map(b => ({ id: b.id, name: b.name + " (" + b.admissionYear + "–" + b.completionYear + ")" }))} />
                    <MultiSelect label="Eligible semesters (empty = all)" name="eligibleSemesters" options={criteria.semesters.map(s => ({ id: s.id, name: s.name }))} />
                    <MultiSelect label="Required skills (empty = none)" name="requiredSkills" options={criteria.skills} />
                  </>}
                  <p className="text-xs text-slate-500 md:col-span-2">Choose the complete intended cohort; empty selections remove that restriction.</p>
                  <button disabled={transitioning === drive.id} className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50 md:col-span-2">{transitioning === drive.id ? "Saving…" : "Save drive changes"}</button>
                </form>
              </details>
              <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" onClick={() => router.push("/placements/drives/" + drive.id + "/eligibility")} className="min-h-10 rounded-xl border px-4 py-2 text-sm font-bold">Review student eligibility</button>
                {next && <button type="button" onClick={() => void transition(drive)} disabled={transitioning === drive.id} className="min-h-10 rounded-xl border border-emerald-700 px-4 py-2 text-sm font-bold text-emerald-800 disabled:opacity-50">{transitioning === drive.id ? "Updating…" : drive.status === "DRAFT" ? "Publish drive" : "Advance to " + next.replaceAll("_", " ")}</button>}
                {drive.status === "DRAFT" && <button type="button" onClick={() => void deleteDraft(drive)} disabled={transitioning === drive.id} className="min-h-10 rounded-xl border border-red-200 px-4 py-2 text-sm font-bold text-red-700 disabled:opacity-50">{transitioning === drive.id ? "Working…" : "Delete draft"}</button>}
              </div>
            </article>;
          })}
          {!visibleDrives.length && <p className="rounded-xl border bg-white p-6 text-sm text-slate-600">No drives match the current filters.</p>}
        </section>
      </div>
    </DashboardShell>
  );
}
