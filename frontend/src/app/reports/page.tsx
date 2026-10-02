"use client";

import { useEffect, useState } from "react";

import { AttendanceExportPanel } from "@/components/attendance/AttendanceExportPanel";
import { UnifiedDashboardFrame } from "@/components/dashboard/UnifiedDashboardFrame";
import {
  AuthRequiredError,
  getCurrentUser,
} from "@/lib/auth";
import { navigationForUser } from "@/lib/navigation";

export default function ReportsPage() {
  const [user, setUser] = useState<any>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;

    getCurrentUser()
      .then((currentUser) => {
        if (alive) setUser(currentUser);
      })
      .catch((reason) => {
        if (!alive) return;

        if (reason instanceof AuthRequiredError) {
          window.location.replace("/login");
          return;
        }

        setError(reason instanceof Error ? reason.message : "Unable to load reports.");
      });

    return () => {
      alive = false;
    };
  }, []);

  if (!user) {
    return (
      <main className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-5xl rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-600 shadow-sm">
          {error || "Loading reports…"}
        </div>
      </main>
    );
  }

  const navigation = navigationForUser(user);

  return (
    <UnifiedDashboardFrame
      navigation={navigation}
      title="Reports & Downloads"
      subtitle="Export attendance within your authorised reporting scope."
      userName={`${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || user.email}
      userEmail={user.email}
      userRole={user.roles?.[0] ?? "User"}
      institutionName={user.institution?.name ?? user.institutionName}
    >
      <div className="mx-auto w-full max-w-7xl space-y-6">
        <section>
          <div className="mb-5">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-600">Reporting</p>
            <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-900">Attendance exports</h1>
            <p className="mt-1 max-w-3xl text-sm text-slate-500">
              Faculty accounts see assigned teaching data, HOD accounts see their managed departments, and institution leadership sees tenant-wide attendance reporting.
            </p>
          </div>

          <AttendanceExportPanel />
        </section>
      </div>
    </UnifiedDashboardFrame>
  );
}
