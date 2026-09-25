"use client";

import Link from "next/link";

import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { StudentManagement } from "@/components/dashboard/StudentManagement";

export default function StudentsPage() {
  return (
    <DashboardShell
      title="Students"
      subtitle="Student master records, enrolments and family information"
      allowedRoles={[
        "INSTITUTION_ADMIN",
      ]}
    >
      <main className="mx-auto max-w-[1400px] space-y-5 pb-10">
        <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_12px_32px_rgba(15,23,42,0.04)] sm:p-7">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <Link
                href="/user-management"
                className="text-xs font-extrabold text-blue-600 hover:text-blue-700"
              >
                ← People
              </Link>

              <p className="mt-4 text-[10px] font-black uppercase tracking-[0.2em] text-blue-600">
                STUDENT RECORDS
              </p>

              <h1 className="mt-2 text-3xl font-black tracking-[-0.03em] text-slate-950">
                Students
              </h1>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                Create and maintain complete student records. A student account is created together with its master profile and first academic enrolment, so the workflow cannot leave a half-created student behind.
              </p>
            </div>

            <div className="rounded-[18px] border border-blue-100 bg-blue-50 px-4 py-3 text-xs font-bold text-blue-700">
              Institution-scoped access
            </div>
          </div>
        </section>

        <StudentManagement />
      </main>
    </DashboardShell>
  );
}
