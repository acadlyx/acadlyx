"use client";

import Link from "next/link";
import { DashboardShell } from "@/components/dashboard/DashboardShell";

const links = [
  ["Courses", "/courses"],
  ["Course Offerings", "/course-offerings"],
  ["Timetable", "/timetable"],
  ["Assignments", "/faculty/assignments"],
  ["Attendance", "/faculty/attendance"],
  ["Examinations", "/faculty/examinations"],
] as const;

export default function FacultyOperationsPage() {
  return (
    <DashboardShell title="Faculty Operations" subtitle="Teaching and academic delivery workspace" allowedRoles={["FACULTY"]}>
      <main className="mx-auto w-full max-w-7xl space-y-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Faculty workspace</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">Teaching Operations</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">Faculty see teaching responsibilities as dedicated destinations instead of an institution-wide ERP surface.</p>
        </section>
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {links.map(([label, href]) => (
            <Link key={href} href={href} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md">
              <h2 className="font-black text-slate-950">{label}</h2>
              <p className="mt-1 text-sm text-slate-500">Open {label.toLowerCase()}.</p>
            </Link>
          ))}
        </section>
      </main>
    </DashboardShell>
  );
}
