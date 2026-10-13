"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardShell } from "./DashboardShell";
import { AuthRequiredError } from "@/lib/auth";
import { getErpWorkspaceSummary } from "@/lib/erpApi";

type WorkspaceData = { stats: Record<string, number> };

const metrics = [
  ["Students", "students"],
  ["Faculty", "faculty"],
  ["Departments", "departments"],
  ["Courses", "courses"],
  ["Exams", "exams"],
  ["Results", "examResults"],
] as const;



export function DirectorDashboard() {
  const router = useRouter();
  const [data, setData] = useState<WorkspaceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [scopeMissing, setScopeMissing] = useState(false);

  const loadWorkspace = useCallback(async () => {
    setLoading(true);
    setUnavailable(false);
    setScopeMissing(false);
    try {
      const response = await getErpWorkspaceSummary();
      setData({ stats: response.stats || {} });
    } catch (error) {
      if (error instanceof AuthRequiredError) {
        router.replace("/login");
        return;
      }
      setUnavailable(true);
      setScopeMissing(error instanceof Error && /no campus scope is assigned|campus scope.*assigned/i.test(error.message));
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { void loadWorkspace(); }, [loadWorkspace]);

  const stats = data?.stats;
  return (
    <DashboardShell title="Director Workspace" subtitle="Campus operations, academic performance and authorized decisions" allowedRoles={["DIRECTOR"]}>
      <main className="mx-auto w-full max-w-7xl space-y-6">
        {unavailable && (
          <section role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-slate-800">
            <span>{scopeMissing ? "No campus is assigned to this Director account. Ask Institution Admin to open Admin → People → Edit user, assign one or more active campuses, and save. Metrics remain unavailable until that scope exists." : "Campus metrics are temporarily unavailable. No values are being reported as zero."}</span>
            <button type="button" onClick={() => void loadWorkspace()} disabled={loading} className="rounded-lg bg-emerald-700 px-4 py-2 font-bold text-white disabled:opacity-50">Retry</button>
          </section>
        )}
        <section aria-busy={loading} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {metrics.map(([label, key]) => {
            const value = stats?.[key];
            return <article key={key} className="rounded-2xl border border-slate-200 bg-white p-5">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
              <p className="mt-2 text-3xl font-black text-slate-950">{loading || value === undefined || !Number.isFinite(value) ? "—" : value.toLocaleString("en-IN")}</p>
              {(loading || value === undefined) && <p className="mt-1 text-xs text-slate-500">{loading ? "Loading" : "Unavailable"}</p>}
            </article>;
          })}
        </section>
      </main>
    </DashboardShell>
  );
}
