"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AuthRequiredError, authedFetch, HttpRequestError } from "@/lib/auth";
import { DashboardShell } from "@/components/dashboard/DashboardShell";

type Student = { id: string; firstName: string; lastName: string; idNumber?: string | null; email?: string };
type Eligibility = { eligible: boolean; reasons: string[]; studentId: string };

export default function PlacementDriveEligibilityPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const driveId = params.id;
  const [students, setStudents] = useState<Student[]>([]);
  const [studentId, setStudentId] = useState("");
  const [result, setResult] = useState<Eligibility | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await authedFetch<{ data: Student[] }>("/placements/students?page=1&pageSize=100");
      setStudents(response.data || []);
    } catch (cause) {
      if (cause instanceof AuthRequiredError) { router.replace("/login"); return; }
      setError(cause instanceof HttpRequestError ? cause.message : "Unable to load authorized students.");
    } finally { setLoading(false); }
  }, [router]);

  useEffect(() => { void load(); }, [load]);

  async function check() {
    if (!studentId) { setError("Select a student to check eligibility."); return; }
    setChecking(true);
    setError("");
    setResult(null);
    try {
      const response = await authedFetch<{ data: Eligibility }>(`/placements/drives/${encodeURIComponent(driveId)}/eligibility?studentId=${encodeURIComponent(studentId)}`);
      setResult(response.data);
    } catch (cause) {
      if (cause instanceof AuthRequiredError) router.replace("/login");
      else setError(cause instanceof HttpRequestError ? cause.message : "Unable to evaluate drive eligibility.");
    } finally { setChecking(false); }
  }

  return (
    <DashboardShell title="Drive Eligibility Review" subtitle="Evaluate an individual student against the drive's authoritative enrollment, academic and skills criteria." allowedRoles={["PLACEMENT"]}>
      <div className="mx-auto max-w-4xl space-y-5">
        {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
        <section className="space-y-4 rounded-2xl border bg-white p-6">
          <label className="flex flex-col gap-2 text-sm font-semibold text-slate-700">Student within your authorized placement scope
            <select value={studentId} onChange={e => { setStudentId(e.target.value); setResult(null); }} disabled={loading} className="rounded-xl border bg-white px-4 py-3 font-normal"><option value="">Select student</option>{students.map(s => <option key={s.id} value={s.id}>{s.firstName} {s.lastName}{s.idNumber ? " · " + s.idNumber : ""}{s.email ? " · " + s.email : ""}</option>)}</select>
          </label>
          <p className="text-xs leading-5 text-slate-500">The backend calculates eligibility from active enrollment, campus/programme/department/batch/semester restrictions, deadline and drive status, authoritative academic snapshot, and recorded placement skills. Missing academic evidence is not treated as a pass.</p>
          <div className="flex flex-wrap gap-2"><button type="button" onClick={() => void check()} disabled={checking || loading || !studentId} className="rounded-xl bg-emerald-700 px-5 py-3 text-sm font-black text-white disabled:opacity-50">{checking ? "Checking…" : "Check eligibility"}</button><button type="button" onClick={() => router.push("/placements/drives")} className="rounded-xl border px-5 py-3 text-sm font-bold">Back to drives</button></div>
        </section>
        {result && <section className="rounded-2xl border bg-white p-6">
          <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-black text-slate-950">Eligibility result</h2><span className={result.eligible ? "rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-800" : "rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-800"}>{result.eligible ? "Eligible" : "Not eligible"}</span></div>
          {result.eligible ? <p className="mt-3 text-sm text-slate-600">The backend found no current eligibility blockers for this student and drive. Re-check before acting if academic data changes.</p> : <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-700">{result.reasons.map((reason, index) => <li key={index}>{reason}</li>)}</ul>}
        </section>}
        {!loading && students.length === 0 && <p className="rounded-xl border border-dashed p-6 text-sm text-slate-600">No students are available in your authorized placement scope.</p>}
      </div>
    </DashboardShell>
  );
}
