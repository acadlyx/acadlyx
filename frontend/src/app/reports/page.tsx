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
            
            <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-900">
              Attendance exports
            </h1>
            
          </div>

          <AttendanceExportPanel />
        </section>
        <div role="note" className="my-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600">Export attendance using the reporting scope enforced by the
              authenticated role.</div>
      </div>
    </DashboardShell>
  );
}
