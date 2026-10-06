"use client";

import { useEffect, useState } from "react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import {
  getMyEnrollmentWorkflow,
  submitEnrollmentRequest,
  EnrollmentContext,
  EnrollmentRequest,
} from "@/lib/enrollmentRequestApi";

const labels: Record<string,string> = {
  NOT_STARTED: "Not Started",
  PENDING: "Pending Approval",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  NEEDS_CORRECTION: "Needs Correction",
  CANCELLED: "Cancelled",
};

export default function StudentEnrollmentPage() {
  const [data, setData] = useState<{state:string; enrollment:any; request:EnrollmentRequest|null; eligibleContexts?:EnrollmentContext[]} | null>(null);
  const [selection, setSelection] = useState({ context:"", sectionId:"" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    try { setData(await getMyEnrollmentWorkflow()); }
    catch (e) { setError(e instanceof Error ? e.message : "Unable to load enrollment."); }
  }
  useEffect(() => { void load(); }, []);

  const context = data?.eligibleContexts?.find((x) => x.semester.id === selection.context);
  async function submit() {
    if (!context) return;
    setBusy(true); setError("");
    try {
      await submitEnrollmentRequest({
        programId: context.program.id,
        academicYearId: context.academicYear.id,
        semesterId: context.semester.id,
        sectionId: selection.sectionId || undefined,
      });
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Enrollment request could not be submitted."); }
    finally { setBusy(false); }
  }

  return (
    <DashboardShell title="Academic Enrollment" subtitle="Your authoritative academic context and enrollment approval status" allowedRoles={["STUDENT"]}>
      <div className="space-y-5">
        {error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}
        {!data ? <div className="rounded-3xl bg-white p-6">Loading your academic enrollment…</div> : (
          <>
            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Academic Enrollment</p>
                  <h1 className="mt-1 text-2xl font-black text-slate-950">{labels[data.state] ?? data.state}</h1>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">{labels[data.state] ?? data.state}</span>
              </div>

              {data.enrollment ? (
                <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                  <div><p className="text-xs text-slate-500">Department</p><p className="font-bold">{data.enrollment.program.department.name}</p></div>
                  <div><p className="text-xs text-slate-500">Program</p><p className="font-bold">{data.enrollment.program.name}</p></div>
                  <div><p className="text-xs text-slate-500">Academic Year</p><p className="font-bold">{data.enrollment.academicYear.name}</p></div>
                  <div><p className="text-xs text-slate-500">Semester</p><p className="font-bold">{data.enrollment.semester?.name ?? "—"}</p></div>
                  <div><p className="text-xs text-slate-500">Section</p><p className="font-bold">{data.enrollment.section?.name ?? "—"}</p></div>
                </div>
              ) : null}

              {data.request ? (
                <div className="mt-6 rounded-2xl bg-slate-50 p-4">
                  <p className="font-bold">{data.request.program.name} · {data.request.semester.name}</p>
                  <p className="mt-1 text-sm text-slate-500">{data.request.program.department.name} · {data.request.academicYear.name} · {data.request.section?.name ?? "Section pending"}</p>
                  {data.request.rejectionReason || data.request.correctionNote ? <p className="mt-2 text-sm font-semibold text-red-700">{data.request.rejectionReason ?? data.request.correctionNote}</p> : null}
                </div>
              ) : null}
            </section>

            {data.eligibleContexts?.length ? (
              <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-lg font-black text-slate-950">{data.state === "NEEDS_CORRECTION" ? "Correct enrollment request" : "Request academic enrollment"}</h2>
                <p className="mt-1 text-sm text-slate-500">Only contexts derived from your institutional academic record are available.</p>
                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <select value={selection.context} onChange={(e) => setSelection({context:e.target.value,sectionId:""})} className="rounded-xl border border-slate-200 px-3 py-3 text-sm">
                    <option value="">Select semester</option>
                    {data.eligibleContexts.map((x) => <option key={x.semester.id} value={x.semester.id}>{x.program.name} · {x.semester.name} · {x.academicYear.name}</option>)}
                  </select>
                  <select value={selection.sectionId} onChange={(e) => setSelection((v) => ({...v,sectionId:e.target.value}))} disabled={!context} className="rounded-xl border border-slate-200 px-3 py-3 text-sm disabled:bg-slate-50">
                    <option value="">Select section</option>
                    {context?.sections.map((section) => <option key={section.id} value={section.id}>{section.name}</option>)}
                  </select>
                </div>
                <button type="button" disabled={!context || busy} onClick={() => void submit()} className="mt-4 rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white disabled:opacity-40">
                  {busy ? "Submitting…" : data.state === "NEEDS_CORRECTION" ? "Resubmit Enrollment" : "Submit Enrollment Request"}
                </button>
              </section>
            ) : null}

            {!data.enrollment && !data.request && !data.eligibleContexts?.length ? (
              <section className="rounded-3xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">
                No eligible self-enrollment context is currently available. Your institution must first establish the academic context through the existing admissions/academic administration workflow.
              </section>
            ) : null}
          </>
        )}
      </div>
    </DashboardShell>
  );
}
