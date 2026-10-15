"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AuthRequiredError, authedFetch, HttpRequestError } from "@/lib/auth";
import { DashboardShell } from "@/components/dashboard/DashboardShell";

type Participant = { student: { firstName: string; lastName: string }; attendanceStatus: string; resultStatus: string };
type Interview = { id: string; roundNumber: number; roundType: string; startsAt: string; status: string; drive: { title: string; company: { name: string } }; participants: Participant[] };
type Drive = { id: string; title: string; status: string; company: { name: string } };
type ScopeOption = { id: string; name: string; code?: string; completionYear?: number };
type Student = { id: string; firstName: string; lastName: string; idNumber?: string | null };

export default function PlacementInterviewsPage() {
  const router = useRouter();
  const [items, setItems] = useState<Interview[]>([]);
  const [drives, setDrives] = useState<Drive[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [campuses, setCampuses] = useState<ScopeOption[]>([]);
  const [departments, setDepartments] = useState<ScopeOption[]>([]);
  const [programs, setPrograms] = useState<ScopeOption[]>([]);
  const [batches, setBatches] = useState<ScopeOption[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

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
      const [c, d, p, b] = await Promise.allSettled([
        authedFetch<{ data: ScopeOption[] }>("/campuses"),
        authedFetch<{ data: ScopeOption[] }>("/departments"),
        authedFetch<{ data: ScopeOption[] }>("/programs"),
        authedFetch<{ data: ScopeOption[] }>("/batches"),
      ]);
      if (c.status === "fulfilled") setCampuses(c.value.data || []);
      if (d.status === "fulfilled") setDepartments(d.value.data || []);
      if (p.status === "fulfilled") setPrograms(p.value.data || []);
      if (b.status === "fulfilled") setBatches(b.value.data || []);
    } catch (e) {
      if (e instanceof AuthRequiredError) router.replace("/login");
      else setError(e instanceof HttpRequestError ? e.message : "Unable to load interviews.");
    }
  }, [router]);

  useEffect(() => { void load(); }, [load]);

  async function updateInterview(id: string, payload: { startsAt?: string; status?: "CANCELLED" }) {
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

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setBusy(true);
    setError("");
    try {
      await authedFetch("/placements/interviews", {
        method: "POST",
        body: JSON.stringify({
          driveId: form.get("driveId"),
          roundNumber: Number(form.get("roundNumber")),
          roundType: String(form.get("roundType") || "").trim(),
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
        <form onSubmit={create} className="grid gap-3 rounded-3xl border bg-white p-6 md:grid-cols-2">
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
              <label className="flex flex-col gap-1 text-sm font-semibold text-slate-700 md:col-span-2">Graduating year(s)<input name="graduatingYears" inputMode="numeric" placeholder="2027, 2028" className="rounded-xl border bg-white px-3 py-3 font-normal" /></label>
            </div>
          </fieldset>
          <label className="flex flex-col gap-1 text-sm font-semibold text-slate-700 md:col-span-2">Also target individual students (optional)
            <select name="studentIds" multiple size={4} className="rounded-xl border bg-white px-3 py-2 text-sm font-normal">{students.map(s => <option key={s.id} value={s.id}>{s.firstName} {s.lastName}{s.idNumber ? ` · ${s.idNumber}` : ""}</option>)}</select>
          </label>
          <button disabled={busy} className="rounded-xl bg-emerald-700 px-5 py-3 text-sm font-black text-white disabled:opacity-50 md:col-span-2">{busy ? "Scheduling…" : "Schedule interview round"}</button>
        </form>
        {items.map(i => <article key={i.id} className="rounded-2xl border bg-white p-5">
          <div className="flex flex-wrap justify-between gap-3"><div><h2 className="font-black">{i.drive.title} · Round {i.roundNumber}</h2><p className="text-sm text-slate-600">{i.drive.company.name} · {i.roundType}</p></div><span className="text-xs font-black">{i.status}</span></div>
          <p className="mt-2 text-xs text-slate-500">{new Date(i.startsAt).toLocaleString("en-IN")}</p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">{i.participants.map((p, index) => <div key={p.student.firstName + p.student.lastName + index} className="rounded-xl bg-slate-50 p-3 text-sm"><p className="font-bold">{p.student.firstName} {p.student.lastName}</p><p className="text-xs text-slate-500">{p.attendanceStatus} · {p.resultStatus}</p></div>)}</div>
          <div className="mt-4 flex flex-wrap items-end gap-2 border-t pt-3">
            <form className="flex flex-wrap items-end gap-2" onSubmit={e => { e.preventDefault(); const value = new FormData(e.currentTarget).get("startsAt"); if (typeof value === "string" && value) void updateInterview(i.id, { startsAt: new Date(value).toISOString() }); }}>
              <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">Reschedule<input name="startsAt" type="datetime-local" required defaultValue={new Date(i.startsAt).toISOString().slice(0, 16)} disabled={busy || i.status === "CANCELLED"} className="rounded-lg border px-2 py-2 text-sm" /></label>
              <button type="submit" disabled={busy || i.status === "CANCELLED"} className="rounded-lg border px-3 py-2 text-xs font-bold disabled:opacity-50">Save time</button>
            </form>
            {i.status !== "CANCELLED" && <button type="button" disabled={busy} onClick={() => { if (window.confirm("Cancel this interview and notify assigned students?")) void updateInterview(i.id, { status: "CANCELLED" }); }} className="rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-700 disabled:opacity-50">Cancel interview</button>}
          </div>
        </article>)}
        {!items.length && <div className="rounded-2xl border border-dashed p-10 text-center text-sm text-slate-500">No interviews scheduled.</div>}
        <button type="button" onClick={() => void load()} disabled={busy} className="rounded-xl border bg-white px-4 py-2 text-sm font-bold">Refresh interviews</button>
      </div>
    </DashboardShell>
  );
}
