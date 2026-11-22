"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { AuthRequiredError } from "@/lib/auth";
import { getErpWorkspaceSummary } from "@/lib/erpApi";

type Summary = { stats?: Record<string, number> };
const metrics = [["Students","students"],["Faculty","faculty"],["Programs","programs"],["Courses","courses"],["Assignments","assignments"],["Examinations","exams"]] as const;
const workflows = [
  { label:"Academic quality and outcomes", href:"/dean/obe" },
  { label:"Student records", href:"/dean/students" },
  { label:"Examination oversight", href:"/dean/examinations" },
  { label:"Fee oversight", href:"/dean/fees" },
  { label:"Placement outcomes", href:"/dean/placements" },
  { label:"Academic reports", href:"/dean/reports" },
];

export function DeanDashboard() {
  const router = useRouter();
  const [stats,setStats] = useState<Record<string,number>|null>(null);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState("");

  const loadWorkspace = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response: Summary = await getErpWorkspaceSummary();
      setStats(response.stats ?? {});
    } catch (err) {
      if (err instanceof AuthRequiredError) { router.replace("/login"); return; }
      setError(err instanceof Error ? err.message : "Unable to load the academic workspace.");
    } finally { setLoading(false); }
  },[router]);

  useEffect(() => { void loadWorkspace(); },[loadWorkspace]);

  return (
    <DashboardShell title="Dean Workspace" subtitle="School-level academic leadership, performance and approvals" allowedRoles={["DEAN"]}>
      <main className="mx-auto w-full max-w-7xl space-y-6">
        <header className="border-b border-slate-200 pb-5">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#315c4a]">Academic leadership</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">Academic performance and quality</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Review the academic indicators available within your assigned school scope, then open the workflow that needs attention.</p>
        </header>
        {error ? <section role="alert" className="flex flex-wrap items-center justify-between gap-3 border-y border-red-200 bg-red-50 px-4 py-4 text-sm text-red-800">
          <p className="min-w-0 flex-1">{error}</p>
          <button type="button" onClick={() => void loadWorkspace()} disabled={loading} className="min-h-11 rounded-lg border border-red-300 bg-white px-4 py-2 font-semibold text-red-800 disabled:opacity-50">Retry</button>
        </section> : null}
        <section aria-busy={loading} className="grid gap-0 border-y border-slate-200 sm:grid-cols-2 lg:grid-cols-3">
          {metrics.map(([label,key]) => {
            const value=stats?.[key];
            const available=typeof value==="number" && Number.isFinite(value);
            return <article key={key} className="min-w-0 border-b border-slate-200 px-4 py-5 sm:border-r sm:px-5">
              <p className="text-xs font-semibold text-slate-500">{label}</p>
              <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight text-slate-950">{loading || !available ? "—" : value.toLocaleString("en-IN")}</p>
              <p className="mt-1 text-xs text-slate-500">{loading ? "Loading" : available ? "Within the current workspace" : "Not reported"}</p>
            </article>;
          })}
        </section>
        <section aria-labelledby="dean-workflows-heading">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Workflows</p>
          <h2 id="dean-workflows-heading" className="mt-1 text-lg font-semibold text-slate-950">Academic responsibilities</h2>
          <nav aria-label="Dean workspace workflows" className="mt-3 divide-y divide-slate-200 border-y border-slate-200">
            {workflows.map((workflow) => <Link key={workflow.href} href={workflow.href} className="flex min-h-14 items-center justify-between gap-4 px-3 py-3 text-sm font-semibold text-slate-800 transition-colors hover:bg-[#f4eee4] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#315c4a]">
              <span className="min-w-0">{workflow.label}</span><span aria-hidden="true" className="shrink-0 text-xs font-semibold text-[#315c4a]">Open →</span>
            </Link>)}
          </nav>
        </section>
      </main>
    </DashboardShell>
  );
}
