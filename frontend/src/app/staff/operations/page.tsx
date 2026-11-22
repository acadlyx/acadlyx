"use client";

import Link from "next/link";
import { DashboardShell } from "@/components/dashboard/DashboardShell";



export default function StaffOperationsPage() {
  return (
    <DashboardShell title="Staff Operations" subtitle="Staff-authorized institutional services" allowedRoles={["STAFF", "ACCOUNTS"]}>
      <main className="acadlyx-content-standard space-y-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          
          <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">Operations</h1>
          
        </section>
        <div role="note" className="my-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600">Only services permitted to this workspace are surfaced here. Restricted administrative ERP modules are not exposed as view-only pages.</div>
        <section className="grid gap-4 sm:grid-cols-2">
          <Link href="/events-gallery" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md">
            <h2 className="font-black text-slate-950">Events &amp; Gallery</h2>
            <p className="mt-1 text-sm text-slate-500">Open institution events and gallery.</p>
          </Link>
        </section>
      </main>
    </DashboardShell>
  );
}
