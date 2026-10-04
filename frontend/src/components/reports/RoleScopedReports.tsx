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
      <main className="mx-auto w-full max-w-7xl space-y-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">{role} reporting workspace</p>
          <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-950">Institutional reports</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
            Reports are scoped to this role&apos;s authority. This workspace is intentionally separate from other dashboards so users only manage the reporting responsibilities assigned to them.
          </p>
        </section>
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <AttendanceExportPanel />
        </section>
      </main>
    </DashboardShell>
  );
}
