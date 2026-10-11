"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { AuthRequiredError, authedFetch } from "@/lib/auth";

type Workspace = { stats: Record<string, number> };
const metrics = [["Examinations", "exams"], ["Published/results records", "examResults"], ["Internal mark records", "internalMarks"], ["Attendance sessions", "attendanceSessions"]] as const;
const links = [["Student oversight", "/chairman/students"], ["Intelligence", "/chairman/intelligence"], ["Reports", "/chairman/reports"], ["Operations", "/chairman/operations"]] as const;

export default function CHAIRMANExaminationsPage() {
  const router = useRouter();
  const [data, setData] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const load = useCallback(async () => {
    setLoading(true); setUnavailable(false);
    try {
      const response = await authedFetch<{ data: Workspace }>("/erp/me/workspace");
      setData(response.data);
    } catch (error) {
      if (error instanceof AuthRequiredError) { router.replace("/login"); return; }
      setUnavailable(true);
    } finally { setLoading(false); }
  }, [router]);
  useEffect(() => { void load(); }, [load]);
  return <DashboardShell title="Chairman Examination Oversight" subtitle="Institution-wide examination readiness and academic outcome visibility" allowedRoles={["CHAIRMAN"]}>
    <main className="mx-auto max-w-7xl space-y-6">
      <header className="rounded-3xl border border-amber-100 bg-[#faf7ef] p-7">
        <p className="text-xs font-black uppercase tracking-widest text-slate-500">Examination governance</p>
        <h1 className="mt-2 text-3xl font-black text-slate-950">Chairman Examination Oversight</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-700">Review institution-wide examination signals from the authenticated leadership workspace. This page is read-only; operational changes must use the examination workflow with its own permission and state checks.</p>
      </header>
      {unavailable && <section role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-slate-800"><span>Examination oversight metrics are temporarily unavailable. No values are being reported as zero.</span><button type="button" onClick={() => void load()} disabled={loading} className="rounded-lg bg-emerald-700 px-4 py-2 font-bold text-white disabled:opacity-50">Retry</button></section>}
      <section aria-busy={loading} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map(([label, key]) => { const value = data?.stats[key]; return <article key={key} className="rounded-2xl border bg-white p-5"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-3 text-3xl font-black text-slate-950">{loading || value === undefined || !Number.isFinite(value) ? "—" : value.toLocaleString("en-IN")}</p><p className="mt-2 text-xs text-slate-500">{loading ? "Loading" : value === undefined ? "Unavailable" : "Current scoped workspace result"}</p></article>; })}
      </section>
      <section className="rounded-2xl border bg-white p-5"><h2 className="text-lg font-black text-slate-950">Related role-specific workspaces</h2><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{links.map(([label, href]) => <Link key={href} href={href} className="rounded-xl border p-4 font-bold text-slate-900 hover:shadow-md">{label}<span className="mt-2 block text-xs font-normal text-slate-500">Open dedicated page →</span></Link>)}</div></section>
    </main>
  </DashboardShell>;
}
