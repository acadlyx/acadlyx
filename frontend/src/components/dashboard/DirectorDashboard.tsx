"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardShell } from "./DashboardShell";
import { authedFetch, AuthRequiredError } from "@/lib/auth";

type WorkspaceData = { stats: Record<string, number> };

const metrics = [
  ["Students", "students"],
  ["Faculty", "faculty"],
  ["Departments", "departments"],
  ["Courses", "courses"],
  ["Exams", "exams"],
  ["Results", "examResults"],
] as const;

const shortcuts = [
  ["Campus examination operations", "/director/examinations/operations"],
  ["Campus intelligence", "/director/intelligence"],
  ["Campus operations", "/director/operations"],
  ["Campus students", "/director/students"],
  ["Campus finance", "/director/fees"],
  ["Campus fee approvals", "/director/fee-approvals"],
  ["Placement outcomes", "/director/placements"],
] as const;

export function DirectorDashboard() {
  const router = useRouter();
  const [data, setData] = useState<WorkspaceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);

  const loadWorkspace = useCallback(async () => {
    setLoading(true);
    setUnavailable(false);
    try {
      const response = await authedFetch<{ success: true; data: WorkspaceData }>("/erp/me/workspace");
      setData(response.data);
    } catch (error) {
      if (error instanceof AuthRequiredError) {
        router.replace("/login");
        return;
      }
      setUnavailable(true);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { void loadWorkspace(); }, [loadWorkspace]);

  const stats = data?.stats;
  return (
    <DashboardShell title="Director Workspace" subtitle="Campus operations, academic performance and authorized decisions" allowedRoles={["DIRECTOR"]}>
      <main className="mx-auto w-full max-w-7xl space-y-6">
        <section className="rounded-3xl bg-slate-900 p-7 text-white">
          <p className="text-xs font-bold uppercase tracking-[.2em] text-sky-300">Campus leadership</p>
          <h1 className="mt-2 text-3xl font-black">Director Command Center</h1>
          <p className="mt-2 text-sm text-slate-300">Operational visibility for campuses assigned to your account.</p>
        </section>
        {unavailable && (
          <section role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-slate-800">
            <span>Campus metrics are temporarily unavailable. No values are being reported as zero.</span>
            <button type="button" onClick={() => void loadWorkspace()} disabled={loading} className="rounded-lg bg-emerald-700 px-4 py-2 font-bold text-white disabled:opacity-50">Retry</button>
          </section>
        )}
        <section aria-busy={loading} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {metrics.map(([label, key]) => {
            const value = stats?.[key];
            return <article key={key} className="rounded-2xl border border-slate-200 bg-white p-5">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
              <p className="mt-2 text-3xl font-black text-slate-950">{loading || value === undefined || !Number.isFinite(value) ? "—" : value.toLocaleString("en-IN")}</p>
              <p className="mt-1 text-xs text-slate-500">{loading ? "Loading" : value === undefined ? "Unavailable" : "Assigned-campus scope"}</p>
            </article>;
          })}
        </section>
        <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {shortcuts.map(([label, href]) => <button key={href} type="button" onClick={() => router.push(href)} className="rounded-2xl border border-slate-200 bg-white p-5 text-left font-bold text-slate-950 hover:shadow-md">
            {label}<span className="mt-2 block text-xs font-normal text-slate-500">Open dedicated campus view →</span>
          </button>)}
        </section>
      </main>
    </DashboardShell>
  );
}
