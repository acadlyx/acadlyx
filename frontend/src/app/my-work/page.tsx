"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { AuthRequiredError } from "@/lib/auth";
import { getMyWork, type MyWorkSummary, type WorkPriority } from "@/lib/myWorkApi";

const priorityLabel: Record<WorkPriority, string> = {
  critical: "Critical",
  high: "High",
  normal: "Next",
};

export default function MyWorkPage() {
  const router = useRouter();
  const [data, setData] = useState<MyWorkSummary | null>(null);
  const [error, setError] = useState("");

  async function load() {
    setError("");
    try {
      setData(await getMyWork());
    } catch (reason) {
      if (reason instanceof AuthRequiredError) {
        router.replace("/login");
        return;
      }
      setError(reason instanceof Error ? reason.message : "Unable to load My Work.");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <DashboardShell
      title="My Work"
      subtitle="One action-oriented view of everything that needs your attention"
    >
      <main className="mx-auto max-w-6xl space-y-6 pb-10">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Action center</p>
          <div className="mt-2 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
            <div>
              <h1 className="text-3xl font-black tracking-tight text-slate-950">What needs your attention?</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                My Work is generated from live ACADLYX records. It is not a manually maintained task list.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void load()}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
            >
              Refresh
            </button>
          </div>
        </section>

        {error ? (
          <section role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
            {error}
          </section>
        ) : null}

        {data ? (
          <>
            <section className="grid gap-3 sm:grid-cols-3">
              {[
                ["Actions", data.total, "Total work items"],
                ["Critical", data.critical, "Needs priority attention"],
                ["High priority", data.high, "Should be handled soon"],
              ].map(([label, value, detail]) => (
                <div key={String(label)} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <p className="text-xs font-black uppercase tracking-[0.15em] text-slate-400">{label}</p>
                  <p className="mt-2 text-3xl font-black text-slate-950">{Number(value).toLocaleString("en-IN")}</p>
                  <p className="mt-1 text-xs text-slate-500">{detail}</p>
                </div>
              ))}
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="mb-5">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Next actions</p>
                <h2 className="mt-1 text-xl font-black text-slate-950">Work that is actually waiting</h2>
              </div>

              {data.items.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                  <p className="text-base font-black text-slate-900">You are all caught up.</p>
                  <p className="mt-1 text-sm text-slate-500">No action requiring your attention was detected.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {data.items.map((item) => (
                    <Link
                      key={item.id}
                      href={item.href}
                      className="group flex flex-col gap-4 rounded-2xl border border-slate-200 p-4 transition hover:border-slate-300 hover:bg-slate-50 sm:flex-row sm:items-center"
                    >
                      <div className="flex min-w-0 flex-1 items-start gap-4">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-lg font-black text-white">
                          {item.count > 99 ? "99+" : item.count}
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-black text-slate-900">{item.title}</h3>
                            <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-slate-500">
                              {priorityLabel[item.priority]}
                            </span>
                          </div>
                          <p className="mt-1 text-sm leading-6 text-slate-500">{item.detail}</p>
                        </div>
                      </div>
                      <span className="shrink-0 text-sm font-black text-slate-400 transition group-hover:translate-x-1 group-hover:text-slate-900">
                        Open →
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </section>

            <p className="text-xs text-slate-400">
              Last calculated {new Date(data.generatedAt).toLocaleString("en-IN")}
            </p>
          </>
        ) : (
          <section className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <p className="text-sm font-semibold text-slate-500">Building your action list…</p>
          </section>
        )}
      </main>
    </DashboardShell>
  );
}
