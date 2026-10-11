"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { AuthRequiredError, authedFetch } from "@/lib/auth";

type Intelligence = {
  kpis: { students: number; faculty: number; departments: number; attendance: number; pendingAssignments: number };
  recommendedActions: string[];
  atRiskStudents: Array<{ student: { firstName: string; lastName: string }; risk: string; scores: { academicHealth: number }; recommendations: string[] }>;
};

const shortcuts = [
  ["Fee approvals", "/chairman/fee-approvals"],
  ["Institution finance", "/chairman/fees"],
  ["Examination oversight", "/chairman/examinations"],
  ["Institution reports", "/chairman/reports"],
] as const;

export default function ChairmanIntelligencePage() {
  const router = useRouter();
  const [data, setData] = useState<Intelligence | null>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    setUnavailable(false);
    try {
      const response = await authedFetch<{ data: Intelligence }>("/intelligence/command-center");
      setData(response.data);
    } catch (error) {
      if (error instanceof AuthRequiredError) { router.replace("/login"); return; }
      setUnavailable(true);
    } finally { setLoading(false); }
  }, [router]);
  useEffect(() => { void load(); }, [load]);

  const values: Array<[string, string | number]> = data ? [
    ["Students", data.kpis.students],
    ["Faculty", data.kpis.faculty],
    ["Departments", data.kpis.departments],
    ["Attendance", `${data.kpis.attendance}%`],
    ["Pending assignments", data.kpis.pendingAssignments],
  ] : [];
  return <DashboardShell title="Chairman Intelligence" subtitle="Institution-wide executive intelligence and oversight" allowedRoles={["CHAIRMAN"]}>
    <main className="mx-auto max-w-7xl space-y-6">
      <header className="rounded-3xl border border-amber-100 bg-[#faf7ef] p-7">
        <p className="text-xs font-black uppercase tracking-widest text-slate-500">Executive intelligence</p>
        <h1 className="mt-2 text-3xl font-black text-slate-950">Institutional performance & priorities</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-700">Metrics and risk signals come from the authenticated intelligence service. Decisions and record access remain subject to server-side permissions.</p>
      </header>
      {unavailable && <section role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm"><span>Institutional intelligence is temporarily unavailable. No missing values are shown as zero.</span><button type="button" onClick={() => void load()} disabled={loading} className="rounded-lg bg-emerald-700 px-4 py-2 font-bold text-white disabled:opacity-50">Retry</button></section>}
      <section aria-busy={loading} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {["Students", "Faculty", "Departments", "Attendance", "Pending assignments"].map((label, index) => <article key={label} className="rounded-2xl border bg-white p-5"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-3 text-3xl font-black text-slate-950">{loading || !data ? "—" : String(values[index]?.[1] ?? "—")}</p><p className="mt-2 text-xs text-slate-500">{loading ? "Loading" : data ? "Current service result" : "Unavailable"}</p></article>)}
      </section>
      <section className="grid gap-5 lg:grid-cols-2">
        <article className="rounded-2xl border bg-white p-5"><h2 className="text-lg font-black text-slate-950">Institutional priorities</h2>{data?.recommendedActions.length ? <ul className="mt-4 space-y-3">{data.recommendedActions.map((action, i) => <li key={`${i}-${action}`} className="rounded-xl bg-slate-50 p-3 text-sm leading-6 text-slate-700">{action}</li>)}</ul> : <p className="mt-4 text-sm text-slate-500">{loading ? "Loading current priorities…" : "No current priorities were returned by the service."}</p>}</article>
        <article className="rounded-2xl border bg-white p-5"><h2 className="text-lg font-black text-slate-950">Students surfaced for review</h2>{data?.atRiskStudents.length ? <ul className="mt-4 divide-y">{data.atRiskStudents.map((row, i) => <li key={`${row.student.firstName}-${row.student.lastName}-${i}`} className="py-3"><div className="flex flex-wrap justify-between gap-2"><p className="font-bold text-slate-900">{`${row.student.firstName} ${row.student.lastName}`.trim()}</p><span className="rounded-full bg-amber-50 px-2 py-1 text-xs font-bold text-amber-800">{row.risk}</span></div><p className="mt-1 text-xs text-slate-500">{row.recommendations?.[0] || "Review current academic signals"}</p></li>)}</ul> : <p className="mt-4 text-sm text-slate-500">{loading ? "Loading risk signals…" : "No flagged records were returned in the permitted scope."}</p>}</article>
      </section>
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{shortcuts.map(([label, href]) => <Link key={href} href={href} className="rounded-xl border bg-white p-4 font-bold text-slate-900 hover:shadow-md">{label}<span className="mt-2 block text-xs font-normal text-slate-500">Open dedicated page →</span></Link>)}</section>
    </main>
  </DashboardShell>;
}
