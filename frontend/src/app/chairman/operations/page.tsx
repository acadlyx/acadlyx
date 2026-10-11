"use client";

import Link from "next/link";
import { DashboardShell } from "@/components/dashboard/DashboardShell";

const sections = [
  { title: "Examination lifecycle", description: "Schedule examinations, review marks, approve publication and manage revaluation requests.", href: "/chairman/examinations/operations", label: "Open examination operations" },
  { title: "Executive overview", description: "Institution-wide operational signals and executive priorities.", href: "/chairman/intelligence", label: "Open institutional intelligence" },
  { title: "Fee structure decisions", description: "Review and decide fee structures assigned to the Chairman approval workflow.", href: "/chairman/fee-approvals", label: "Review fee approvals" },
  { title: "Finance oversight", description: "Review institution-level financial activity and collection summaries.", href: "/chairman/fees", label: "Open finance oversight" },
  { title: "Academic oversight", description: "Review examination readiness and academic outcome indicators.", href: "/chairman/examinations", label: "Review examinations" },
  { title: "Student lifecycle", description: "Review institutional student and enrollment information available to your role.", href: "/chairman/students", label: "Review students" },
  { title: "Placement outcomes", description: "Review authorized institutional placement and career outcome information.", href: "/chairman/placements", label: "Review placements" },
  { title: "Institutional reports", description: "Open reports and reporting-period summaries for executive review.", href: "/chairman/reports", label: "Open reports" },
] as const;

export default function ChairmanOperationsPage() {
  return (
    <DashboardShell title="Chairman Operations" subtitle="Institution-wide oversight within your assigned institutional scope" allowedRoles={["CHAIRMAN"]}>
      <main className="mx-auto w-full max-w-7xl space-y-6">
        <section className="rounded-3xl border border-amber-100 bg-[#faf7ef] p-6 shadow-sm sm:p-8">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Chairman workspace</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">Institutional operations</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-700">Review institution-wide performance and open the dedicated page for each operational area. Approval authority remains governed by the workflow, current state, and explicit action permissions.</p>
        </section>
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sections.map((section) => (
            <article key={section.href} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="font-black text-slate-950">{section.title}</h2>
              <p className="mt-2 min-h-12 text-sm leading-6 text-slate-600">{section.description}</p>
              <Link href={section.href} className="mt-4 inline-flex rounded-xl bg-emerald-700 px-4 py-2 text-sm font-bold text-white transition hover:bg-emerald-800">{section.label}</Link>
            </article>
          ))}
        </section>
      </main>
    </DashboardShell>
  );
}
