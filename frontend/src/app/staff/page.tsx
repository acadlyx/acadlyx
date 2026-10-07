"use client";

import { useEffect, useState } from "react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { AuthRequiredError, authedFetch } from "@/lib/auth";

export default function StaffPage() {
  const [error, setError] = useState("");
  const [stats, setStats] = useState<Record<string, number>>({});

  useEffect(() => {
    void authedFetch<{ success: boolean; data?: { stats?: Record<string, number> } }>("/erp/me/workspace")
      .then((response) => setStats(response.data?.stats ?? {}))
      .catch((reason) => {
        setError(
          reason instanceof AuthRequiredError
            ? "Your session has expired. Please sign in again."
            : reason instanceof Error
              ? reason.message
              : "Unable to load staff workspace."
        );
      });
  }, []);

  return (
    <DashboardShell
      title="Staff Workspace"
      subtitle="Institutional staff operations"
      allowedRoles={["STAFF"]}
    >
      <main className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-600">Staff</p>
          <h1 className="mt-2 text-3xl font-black text-slate-950">Staff Workspace</h1>
          <p className="mt-2 text-sm text-slate-500">A dedicated workspace for the authenticated staff role.</p>
        </section>
        {error ? (
          <p className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>
        ) : (
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Object.entries(stats).slice(0, 8).map(([label, value]) => (
              <article key={label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{label}</p>
                <p className="mt-2 text-3xl font-black text-slate-950">{Number(value).toLocaleString("en-IN")}</p>
              </article>
            ))}
          </section>
        )}
      </main>
    </DashboardShell>
  );
}
