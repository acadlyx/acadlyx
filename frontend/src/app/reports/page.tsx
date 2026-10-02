"use client";

import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { AttendanceExportPanel } from "@/components/attendance/AttendanceExportPanel";

export default function ReportsPage() {
  return (
    <DashboardShell
      title="Reports & Downloads"
      subtitle="Attendance exports within your authorised reporting scope."
    >
      <div className="mx-auto w-full max-w-7xl">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-5">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-acadlyx-secondary">
              Reporting
            </p>
            <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-900">
              Attendance exports
            </h1>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
              Export attendance using the reporting scope enforced by the
              authenticated role.
            </p>
          </div>

          <AttendanceExportPanel />
        </section>
      </div>
    </DashboardShell>
  );
}
