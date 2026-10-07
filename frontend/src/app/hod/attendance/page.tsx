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
      <div className="mx-auto w-full max-w-7xl space-y-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-600">
            HOD workspace
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
            Attendance
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
            Review and export attendance within the authenticated HOD department scope.
            The backend remains the final authority for every record and filter.
          </p>
        </section>
        <AttendanceExportPanel />
      </div>
    </DashboardShell>
  );
}
