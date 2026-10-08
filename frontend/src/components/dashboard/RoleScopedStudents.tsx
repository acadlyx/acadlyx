"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { AuthRequiredError, authedFetch } from "@/lib/auth";

type Student = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  profile?: { admissionNumber?: string | null } | null;
};

type Envelope = {
  success: boolean;
  data: Student[];
};

export function RoleScopedStudents({
  role,
  title,
  subtitle,
  detailBasePath = "/students",
}: {
  role: string;
  title: string;
  subtitle: string;
  detailBasePath?: string;
}) {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    void authedFetch<Envelope>("/students?page=1&pageSize=25")
      .then((response) => {
        if (alive) setStudents(response.data ?? []);
      })
      .catch((reason) => {
        if (!alive) return;
        setError(
          reason instanceof AuthRequiredError
            ? "Your session has expired. Please sign in again."
            : reason instanceof Error
              ? reason.message
              : "Unable to load students."
        );
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, []);

  return (
    <DashboardShell title={title} subtitle={subtitle} allowedRoles={[role]}>
      <div className="mx-auto w-full max-w-7xl space-y-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-600">
            {role} workspace
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
            Students
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
            {subtitle}
          </p>
        </section>

        {error ? (
          <section className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
            {error}
          </section>
        ) : loading ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-500">
            Loading students…
          </section>
        ) : students.length === 0 ? (
          <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
            No students are available in your authorised scope.
          </section>
        ) : (
          <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="divide-y divide-slate-100">
              {students.map((student) => (
                <Link
                  key={student.id}
                  href={`${detailBasePath}/${encodeURIComponent(student.id)}`}
                  className="block px-5 py-4 transition hover:bg-slate-50 sm:px-6"
                >
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-bold text-slate-950">
                        {student.firstName} {student.lastName}
                      </p>
                      <p className="text-xs text-slate-500">
                        {student.profile?.admissionNumber || student.email}
                      </p>
                    </div>
                    <span className="text-xs font-semibold text-blue-600">
                      View Full Profile →
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </DashboardShell>
  );
}
