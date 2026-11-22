"use client";

import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { AttendanceExportPanel } from "@/components/attendance/AttendanceExportPanel";

export default function HodAttendancePage() {
  return (
    <DashboardShell
      title="Department Attendance"
      subtitle="Department-scoped attendance reporting"
      allowedRoles={["HOD"]}
    >
      <div className="acadlyx-content-standard space-y-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          
          <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
            Attendance
          </h1>
          
        </section>
        <div role="note" className="my-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600">Review and export attendance within the authenticated HOD department scope.
            The backend remains the final authority for every record and filter.</div>
        <AttendanceExportPanel />
      </div>
    </DashboardShell>
  );
}
