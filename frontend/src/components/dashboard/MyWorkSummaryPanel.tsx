"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { getMyWork, type MyWorkSummary, type WorkPriority } from "@/lib/myWorkApi";

const WORKSPACE_QUERY_KEYS = ["campusId", "departmentId", "programId", "academicYearId", "batchId", "semesterId", "sectionId"];

const PRIORITY_META: Record<WorkPriority, { label: string; className: string }> = {
  critical: { label: "Critical", className: "border-red-200 bg-red-50 text-red-800" },
  high: { label: "High", className: "border-amber-200 bg-amber-50 text-amber-800" },
  normal: { label: "Next", className: "border-slate-200 bg-slate-50 text-slate-600" },
};

function carryWorkspaceQuery(href: string, currentQuery: string): string {
  const workspace = new URLSearchParams();
  const current = new URLSearchParams(currentQuery);
  for (const key of WORKSPACE_QUERY_KEYS) {
    const value = current.get(key);
    if (value) workspace.set(key, value);
  }
  if (!workspace.size) return href;
  const separator = href.indexOf("?");
  const path = separator >= 0 ? href.slice(0, separator) : href;
  const query = new URLSearchParams(separator >= 0 ? href.slice(separator + 1) : "");
  workspace.forEach((value, key) => query.set(key, value));
  const suffix = query.toString();
  return suffix ? `${path}?${suffix}` : path;
}

export function MyWorkSummaryPanel() {
  const searchParams = useSearchParams();
  const [summary, setSummary] = useState<MyWorkSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const currentQuery = searchParams.toString();

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    getMyWork()
      .then((result) => {
        if (active) setSummary(result);
      })
      .catch((reason) => {
        if (!active) return;
        setError(reason instanceof Error ? reason.message : "Unable to load your action queue.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [reloadKey]);

  const viewAllHref = carryWorkspaceQuery("/my-work", currentQuery);

  return (
    <section aria-labelledby="my-work-summary-title" className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-700">Action queue</p>
          <h2 id="my-work-summary-title" className="mt-1 text-lg font-extrabold text-slate-900">Your work at a glance</h2>
          <p className="mt-1 text-sm text-slate-500">Open operational items returned for your authenticated workspace.</p>
        </div>
        <Link href={viewAllHref} className="inline-flex min-h-10 items-center justify-center rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 transition hover:border-emerald-500 hover:text-emerald-800">
          Open My Work
        </Link>
      </div>

      {loading ? (
        <div role="status" className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <span className="sr-only">Loading your action queue…</span>
          {[1, 2, 3, 4].map((item) => <div key={item} className="h-24 animate-pulse rounded-xl bg-slate-100" />)}
        </div>
      ) : error ? (
        <div className="mt-4 flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p role="alert" className="text-sm text-amber-900">{error}</p>
          <button type="button" onClick={() => setReloadKey((value) => value + 1)} className="min-h-10 rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm font-bold text-slate-800">
            Retry
          </button>
        </div>
      ) : summary && summary.items.length ? (
        <>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {summary.items.slice(0, 4).map((item) => {
              const priority = PRIORITY_META[item.priority];
              return (
                <article key={item.id} className="flex min-w-0 flex-col rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="min-w-0 text-sm font-bold text-slate-900">{item.title}</h3>
                    <span className={`shrink-0 rounded-full border px-2 py-1 text-[10px] font-black ${priority.className}`}>{priority.label}</span>
                  </div>
                  <p className="mt-3 text-2xl font-black tabular-nums text-slate-900">{item.count.toLocaleString("en-IN")}</p>
                  <p className="mt-1 flex-1 text-xs leading-5 text-slate-600">{item.detail}</p>
                  <Link href={carryWorkspaceQuery(item.href, currentQuery)} className="mt-3 inline-flex min-h-9 items-center justify-center rounded-lg bg-white px-3 py-2 text-xs font-bold text-slate-800 ring-1 ring-slate-200 transition hover:ring-emerald-500">
                    Open item
                  </Link>
                </article>
              );
            })}
          </div>
          <div className="mt-3 flex flex-wrap gap-3 text-xs font-semibold text-slate-500">
            <span><strong className="text-slate-900">{summary.total}</strong> open items</span>
            <span><strong className="text-red-700">{summary.critical}</strong> critical</span>
            <span><strong className="text-amber-700">{summary.high}</strong> high priority</span>
          </div>
        </>
      ) : (
        <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center">
          <p className="text-sm font-bold text-slate-800">No outstanding actions were returned.</p>
          <p className="mt-1 text-xs text-slate-500">The queue will populate when the backend reports work for your role.</p>
        </div>
      )}
    </section>
  );
}
