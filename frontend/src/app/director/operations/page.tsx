"use client";

import Link from "next/link";
import { DashboardShell } from "@/components/dashboard/DashboardShell";

const sections = [
  { title: "Campus intelligence", description: "Review intelligence metrics and risks limited to your assigned campuses.", href: "/director/intelligence", label: "Open campus intelligence" },
  { title: "Student lifecycle", description: "Review students within the Director's assigned campus scope.", href: "/director/students", label: "Review campus students" },
  { title: "Examination readiness", description: "Review campus examination operations and authorized exceptions.", href: "/director/examinations", label: "Review examinations" },
  { title: "Academic outcomes", description: "Review campus outcome-based education indicators.", href: "/director/obe", label: "Review academic outcomes" },
  { title: "Campus finance", description: "Review campus finance information exposed by the scoped finance APIs.", href: "/director/fees", label: "Open campus finance" },
  { title: "Campus fee approvals", description: "Review and decide on pending fee structures linked to your assigned campuses.", href: "/director/fee-approvals", label: "Review fee approvals" },
  { title: "Placement outcomes", description: "Review authorized campus placement and career outcome information.", href: "/director/placements", label: "Review placements" },
  { title: "Campus reports", description: "Open reports for the Director's currently authorized campus scope.", href: "/director/reports", label: "Open campus reports" },
  { title: "Import review", description: "Review import operations available to the Director role.", href: "/director/imports", label: "Open import review" },
] as const;

export default function DirectorOperationsPage() {
  return (
    <DashboardShell title="Director Operations" subtitle="Campus-wide operational oversight for assigned campuses only" allowedRoles={["DIRECTOR"]}>
      <main className="mx-auto w-full max-w-7xl space-y-6">
        <section className="rounded-3xl border border-amber-100 bg-[#faf7ef] p-6 shadow-sm sm:p-8">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Director workspace</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">Campus operations</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-700">Each operational area opens its own Director route. The backend must apply CampusAccess scope to every record, aggregate, export, and mutation; navigation visibility is not authorization.</p>
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
