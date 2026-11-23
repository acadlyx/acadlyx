"use client";

import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { AttendanceExportPanel } from "@/components/attendance/AttendanceExportPanel";

export function RoleScopedReports({
  role,
  title,
  subtitle,
}: {
  role: string;
  title: string;
  subtitle: string;
}) {
  return (
    <DashboardShell title={title} subtitle={subtitle} allowedRoles={[role]}>
      <main className="acadlyx-content-standard space-y-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <h1 className="text-2xl font-black tracking-tight text-slate-950">Institutional reports</h1>
        </section>
        <div role="note" className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600">Reports are scoped to this role&apos;s authority. This workspace is intentionally separate from other dashboards so users only manage the reporting responsibilities assigned to them.</div>
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <AttendanceExportPanel />
        </section>
      </main>
    </DashboardShell>
  );
}
