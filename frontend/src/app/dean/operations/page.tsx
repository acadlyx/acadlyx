"use client";

import Link from "next/link";
import { DashboardShell } from "@/components/dashboard/DashboardShell";

const links = [
  ["Academic", "/academics"],
  ["Students", "/students"],
  ["Examinations", "/dean/examinations"],
  ["Outcome Based Education", "/dean/obe"],
  ["Results", "/results"],
  ["Reports", "/dean/reports"],
] as const;

export default function DeanOperationsPage() {
  return (
    <DashboardShell title="Dean Operations" subtitle="Academic and institutional oversight" allowedRoles={["DEAN"]}>
      <main className="mx-auto w-full max-w-7xl space-y-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Dean workspace</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">Academic Operations</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">Dean-level academic responsibilities are surfaced as separate destinations rather than a shared generic operations page.</p>
        </section>
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {links.map(([label, href]) => (
            <Link key={href} href={href} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md">
              <h2 className="font-black text-slate-950">{label}</h2>
              <p className="mt-1 text-sm text-slate-500">Open dedicated {label.toLowerCase()} management.</p>
            </Link>
          ))}
        </section>
      </main>
    </DashboardShell>
  );
}
