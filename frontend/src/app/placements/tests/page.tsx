"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AuthRequiredError, authedFetch, HttpRequestError } from "@/lib/auth";
import { PlacementTeamShell } from "@/components/placement/PlacementTeamShell";

type Test = {
  id: string; title: string; mode: string; scheduledAt: string; durationMinutes: number | null;
  testLink: string | null; instructions: string | null; status: string;
  drive: { id: string; title: string; company: { name: string } };
  participants?: Array<{ studentId: string; attendanceStatus: string; resultStatus: string; score: number | null }>;
};
type Drive = { id: string; title: string; status: string; company: { name: string } };
type ScopeOption = { id: string; name: string; code?: string; completionYear?: number };
type Student = { id: string; firstName: string; lastName: string; idNumber?: string | null; studentEnrollments?: Array<{ program?: { name?: string }; batch?: { name?: string } }> };

export default function PlacementTestsPage() {
  const router = useRouter();
  const [items, setItems] = useState<Test[]>([]);
  const [drives, setDrives] = useState<Drive[]>([]);
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
      const [testsResponse, drivesResponse, studentsResponse] = await Promise.all([
        authedFetch<{ data: Test[] }>("/placements/tests"),
        authedFetch<{ data: Drive[] }>("/placements/drives?page=1&pageSize=100"),
        authedFetch<{ data: Student[] }>("/placements/students?page=1&pageSize=100"),
      ]);
      setItems(testsResponse.data || []);
      setDrives(drivesResponse.data || []);
      setStudents(studentsResponse.data || []);
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
      else setError(e instanceof HttpRequestError ? e.message : "Unable to load placement assessments.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { void load(); }, [load]);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setBusy(true);
    setError("");
    const localDate = String(form.get("scheduledAt") || "");
    const payload = {
      driveId: String(form.get("driveId") || ""),
      title: String(form.get("title") || "").trim(),
      mode: String(form.get("mode") || "ONLINE"),
      scheduledAt: new Date(localDate).toISOString(),
      durationMinutes: form.get("durationMinutes") ? Number(form.get("durationMinutes")) : undefined,
      maxScore: form.get("maxScore") ? Number(form.get("maxScore")) : undefined,
      testLink: String(form.get("testLink") || "").trim() || undefined,
      instructions: String(form.get("instructions") || "").trim() || undefined,
      studentIds: form.getAll("studentIds").filter((value): value is string => typeof value === "string"),
      targeting: {
        campusIds: form.getAll("campusIds").filter((value): value is string => typeof value === "string"),
        departmentIds: form.getAll("departmentIds").filter((value): value is string => typeof value === "string"),
        programIds: form.getAll("programIds").filter((value): value is string => typeof value === "string"),
        batchIds: form.getAll("batchIds").filter((value): value is string => typeof value === "string"),
        graduatingYears: String(form.get("graduatingYears") || "").split(",").map((value) => Number(value.trim())).filter((value) => Number.isInteger(value) && value >= 2000 && value <= 2200),
      },
    };
    try {
      await authedFetch("/placements/tests", { method: "POST", body: JSON.stringify(payload) });
      formElement.reset();
      await load();
    } catch (e) {
      if (e instanceof AuthRequiredError) router.replace("/login");
      else setError(e instanceof HttpRequestError ? e.message : "Unable to create placement assessment.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <PlacementTeamShell>
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-3xl border bg-white p-6">
          <p className="text-xs font-black uppercase tracking-[.18em] text-emerald-700">Placement operations</p>
          <h1 className="mt-2 text-3xl font-black text-slate-950">Tests & Assessments</h1>
          <p className="mt-2 text-sm text-slate-600">Schedule company assessments, assign candidates, and keep participation linked to the placement drive.</p>
        </section>
        {error && <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
        <form onSubmit={create} className="grid gap-4 rounded-3xl border bg-white p-6 md:grid-cols-2">
          <h2 className="text-lg font-black text-slate-950 md:col-span-2">Schedule an assessment</h2>
          <label className="flex flex-col gap-1 text-sm font-semibold text-slate-700">Placement drive
            <select name="driveId" required className="rounded-xl border bg-white px-3 py-3">
              <option value="">Select drive</option>
              {drives.filter((drive) => !["DRAFT", "CANCELLED", "CLOSED"].includes(drive.status)).map((drive) => <option key={drive.id} value={drive.id}>{drive.title} · {drive.company.name}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold text-slate-700">Assessment title
            <input name="title" required minLength={2} maxLength={200} placeholder="Aptitude / coding assessment" className="rounded-xl border px-3 py-3" />
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold text-slate-700">Mode
            <select name="mode" className="rounded-xl border bg-white px-3 py-3"><option value="ONLINE">Online</option><option value="ONSITE">On-site</option><option value="HYBRID">Hybrid</option></select>
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold text-slate-700">Date and time
            <input name="scheduledAt" type="datetime-local" required className="rounded-xl border px-3 py-3" />
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold text-slate-700">Duration (minutes)
            <input name="durationMinutes" type="number" min="1" max="1440" className="rounded-xl border px-3 py-3" />
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold text-slate-700">Maximum score
            <input name="maxScore" type="number" min="0.01" step="any" className="rounded-xl border px-3 py-3" />
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold text-slate-700 md:col-span-2">Assessment link
            <input name="testLink" type="url" placeholder="https://…" className="rounded-xl border px-3 py-3" />
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold text-slate-700 md:col-span-2">Instructions
            <textarea name="instructions" rows={3} maxLength={5000} placeholder="Reporting instructions, allowed materials, and completion guidance" className="rounded-xl border px-3 py-3" />
          </label>
          <fieldset className="grid gap-3 rounded-2xl border border-emerald-100 bg-emerald-50/40 p-4 md:col-span-2">
            <legend className="px-2 text-sm font-black text-slate-800">Cohort targeting</legend>
            <p className="text-xs font-normal text-slate-600">Cohorts use active student enrollments. Graduation year is the configured batch completion year. Existing candidates at the Test stage are still included.</p>
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
            <span className="text-xs font-normal text-slate-500">Candidates already moved to the Test stage for this drive are assigned automatically.</span>
          </label>
          <button disabled={busy || loading || drives.length === 0} className="rounded-xl bg-emerald-700 px-5 py-3 text-sm font-black text-white disabled:opacity-50 md:col-span-2">{busy ? "Scheduling…" : "Schedule assessment"}</button>
        </form>
        <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => <article key={item.id} className="rounded-2xl border bg-white p-5">
            <div className="flex justify-between gap-3"><h2 className="font-black text-slate-950">{item.title}</h2><span className="text-xs font-black">{item.status}</span></div>
            <p className="mt-2 text-sm text-slate-600">{item.drive.company.name} · {item.drive.title}</p>
            <p className="mt-2 text-xs text-slate-500">{new Date(item.scheduledAt).toLocaleString("en-IN")} · {item.mode}{item.durationMinutes ? ` · ${item.durationMinutes} min` : ""}</p>
            {item.instructions && <p className="mt-3 whitespace-pre-wrap text-sm text-slate-600">{item.instructions}</p>}
            {item.testLink && <a href={item.testLink} target="_blank" rel="noreferrer" className="mt-3 inline-flex text-sm font-bold text-emerald-700 underline">Open assessment link</a>}
            <p className="mt-3 text-xs font-semibold text-slate-500">{item.participants?.length ?? 0} candidate(s) assigned</p>
          </article>)}
          {!loading && items.length === 0 && <p className="rounded-2xl border border-dashed p-10 text-center text-sm text-slate-500 md:col-span-2 lg:col-span-3">No placement assessments have been scheduled yet.</p>}
        </section>
        <button type="button" onClick={() => void load()} disabled={loading} className="rounded-xl border bg-white px-4 py-2 text-sm font-bold">{loading ? "Refreshing…" : "Refresh assessments"}</button>
      </div>
    </PlacementTeamShell>
  );
}
