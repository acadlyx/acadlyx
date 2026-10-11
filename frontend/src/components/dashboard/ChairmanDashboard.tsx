"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardShell } from "./DashboardShell";
import { authedFetch, AuthRequiredError } from "@/lib/auth";

type WorkspaceData = { stats: Record<string, number> };

const metrics = [
  ["Students", "students", "count"],
  ["Faculty", "faculty", "count"],
  ["Departments", "departments", "count"],
  ["Invoiced", "totalInvoiced", "currency"],
  ["Paid invoices", "paidInvoices", "count"],
  ["Exam results", "examResults", "count"],
] as const;



export function ChairmanDashboard() {
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
    <DashboardShell title="Chairman Command Center" subtitle="Executive oversight, institutional intelligence and strategic decisions" allowedRoles={["CHAIRMAN"]}>
      <main className="mx-auto w-full max-w-7xl space-y-6">
        <section className="rounded-3xl bg-slate-950 p-7 text-white">
          <p className="text-xs font-bold uppercase tracking-[.2em] text-emerald-300">Executive oversight</p>
          <h1 className="mt-2 text-3xl font-black">Institutional Command Center</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-300">Institution-wide executive visibility. Use the left sidebar to open each dedicated workspace; all financial and academic records remain subject to backend authorization.</p>
        </section>
        {unavailable && (
          <section role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-slate-800">
            <span>Institutional metrics are temporarily unavailable. No values are being reported as zero.</span>
            <button type="button" onClick={() => void loadWorkspace()} disabled={loading} className="rounded-lg bg-emerald-700 px-4 py-2 font-bold text-white disabled:opacity-50">Retry</button>
          </section>
        )}
        <section aria-busy={loading} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {metrics.map(([label, key, format]) => {
            const value = stats?.[key];
            const display = loading || value === undefined || !Number.isFinite(value)
              ? "—"
              : format === "currency"
                ? `₹${value.toLocaleString("en-IN")}`
                : value.toLocaleString("en-IN");
            return <article key={key} className="rounded-2xl border border-slate-200 bg-white p-5">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
              <p className="mt-2 text-3xl font-black text-slate-950">{display}</p>
              <p className="mt-1 text-xs text-slate-500">{loading ? "Loading" : value === undefined ? "Unavailable" : "Current authorized scope"}</p>
            </article>;
          })}
        </section>
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="font-black text-slate-950">Workspace navigation</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">Use the left sidebar to move between dedicated Chairman pages. All records and actions are constrained to your institution-wide authority; this overview intentionally avoids duplicating the navigation menu.</p>
        </section>

      </main>
    </DashboardShell>
  );
}
