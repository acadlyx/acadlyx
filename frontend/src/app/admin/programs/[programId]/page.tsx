"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import { ExpandableList } from "@/components/ui/ExpandableList";
import { AuthRequiredError, authedFetch } from "@/lib/auth";

type Program = {
  id: string;
  name: string;
  code: string;
  level: string;
  durationYears: number;
  isActive: boolean;
  department?: { id: string; name: string; code: string } | null;
};
type Semester = {
  id: string;
  name: string;
  number: number;
  isActive: boolean;
  startDate?: string | null;
  endDate?: string | null;
  academicYear?: { id: string; name: string } | null;
};

export default function ProgramWorkspacePage() {
  const params = useParams<{ programId: string }>();
  const router = useRouter();
  const programId = String(params.programId || "");
  const [program, setProgram] = useState<Program | null>(null);
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!programId) {
      setError("A valid program is required.");
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    setError("");
    Promise.all([
      authedFetch<{ data: Program }>(`/programs/${encodeURIComponent(programId)}`),
      authedFetch<{ data: Semester[]; meta?: { total?: number } }>(
        `/semesters?page=1&pageSize=100&programId=${encodeURIComponent(programId)}`,
      ),
    ]).then(([programResponse, semesterResponse]) => {
      if (!active) return;
      setProgram(programResponse.data);
      setSemesters(semesterResponse.data);
      setTotal(semesterResponse.meta?.total ?? semesterResponse.data.length);
    }).catch((reason) => {
      if (!active) return;
      if (reason instanceof AuthRequiredError) {
        router.replace("/login");
        return;
      }
      setError(reason instanceof Error ? reason.message : "Unable to load program information.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [programId, router]);

  return (
    <DashboardShell title={program?.name || "Program"} subtitle="Program-scoped academic structure" allowedRoles={["INSTITUTION_ADMIN"]}>
      <main className="mx-auto w-full max-w-7xl space-y-5 p-4 pb-12 sm:p-6 lg:p-8">
        <DashboardPageHeader
          eyebrow="Academic structure"
          title={program?.name || "Program workspace"}
          description={program ? `${program.code} · ${program.level} · ${program.durationYears} year(s)` : "Semesters and academic-year context for this program."}
          breadcrumbs={[
            { label: "Admin", href: "/admin" },
            { label: "Departments", href: "/admin/departments" },
            ...(program?.department ? [{ label: program.department.name, href: `/admin/departments/${encodeURIComponent(program.department.id)}` }] : []),
            { label: program?.name || "Program" },
          ]}
          actions={program ? <span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${program.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{program.isActive ? "Active" : "Inactive"}</span> : null}
        />

        {loading ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map((i) => <div key={i} className="h-36 animate-pulse rounded-2xl border border-slate-200 bg-white" />)}</div> : null}
        {error ? <section role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">{error}<button type="button" onClick={() => window.location.reload()} className="ml-3 font-semibold underline">Retry</button></section> : null}

        {!loading && !error ? (
          <>
            <section className="flex flex-wrap items-center justify-between gap-3">
              <div><h2 className="text-lg font-bold text-slate-900">Academic years and semesters</h2><p className="mt-1 text-sm text-slate-500">{total.toLocaleString("en-IN")} semesters across the program&apos;s academic years</p></div>
              <Link href={`/admin/semesters?programId=${encodeURIComponent(programId)}`} className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-700">Manage semesters</Link>
            </section>
            <ExpandableList
              items={semesters}
              getKey={(semester) => semester.id}
              label="semesters"
              className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
              empty={<section className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">No semesters are configured for this program yet.</section>}
              renderItem={(semester) => (
                <Link href={`/admin/semesters/${encodeURIComponent(semester.id)}`} className="block rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-blue-200 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{semester.academicYear?.name || "Academic year not assigned"}</p>
                  <h3 className="mt-1 text-lg font-bold text-slate-900">{semester.name}</h3>
                  <p className="mt-2 text-sm text-slate-500">Semester {semester.number}</p>
                  <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
                    <span className="text-xs text-slate-500">{semester.startDate ? new Date(semester.startDate).toLocaleDateString("en-IN") : "Start date not set"}</span>
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${semester.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{semester.isActive ? "Active" : "Inactive"}</span>
                  </div>
                  <p className="mt-4 text-sm font-semibold text-blue-700">Open semester →</p>
                </Link>
              )}
            />
          </>
        ) : null}
      </main>
    </DashboardShell>
  );
}
