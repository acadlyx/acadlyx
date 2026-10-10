"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import { ExpandableList } from "@/components/ui/ExpandableList";
import { AuthRequiredError, authedFetch } from "@/lib/auth";

type Semester = {
  id: string;
  name: string;
  number: number;
  isActive: boolean;
  startDate?: string | null;
  endDate?: string | null;
  program?: { id: string; name: string; code: string } | null;
  academicYear?: { id: string; name: string } | null;
};
type Section = {
  id: string;
  name: string;
  capacity: number | null;
  isActive: boolean;
  semester?: { id: string; name: string; program?: { id: string; name: string; code: string }; academicYear?: { id: string; name: string } } | null;
};

export default function SemesterWorkspacePage() {
  const params = useParams<{ semesterId: string }>();
  const router = useRouter();
  const semesterId = String(params.semesterId || "");
  const [semester, setSemester] = useState<Semester | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!semesterId) {
      setError("A valid semester is required.");
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    setError("");
    Promise.all([
      authedFetch<{ data: Semester }>(`/semesters/${encodeURIComponent(semesterId)}`),
      authedFetch<{ data: Section[]; meta?: { total?: number } }>(
        `/sections?page=1&pageSize=100&semesterId=${encodeURIComponent(semesterId)}`,
      ),
    ]).then(([semesterResponse, sectionResponse]) => {
      if (!active) return;
      setSemester(semesterResponse.data);
      setSections(sectionResponse.data);
      setTotal(sectionResponse.meta?.total ?? sectionResponse.data.length);
    }).catch((reason) => {
      if (!active) return;
      if (reason instanceof AuthRequiredError) {
        router.replace("/login");
        return;
      }
      setError(reason instanceof Error ? reason.message : "Unable to load semester information.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [semesterId, router]);

  return (
    <DashboardShell title={semester?.name || "Semester"} subtitle="Semester-scoped sections and academic context" allowedRoles={["INSTITUTION_ADMIN"]}>
      <main className="mx-auto w-full max-w-7xl space-y-5 p-4 pb-12 sm:p-6 lg:p-8">
        <DashboardPageHeader
          eyebrow="Academic structure"
          title={semester?.name || "Semester workspace"}
          description={semester ? `${semester.program?.name || "Program"} · ${semester.academicYear?.name || "Academic year not assigned"}` : "Sections belonging to this semester."}
          breadcrumbs={[
            { label: "Admin", href: "/admin" },
            ...(semester?.program ? [{ label: semester.program.name, href: `/admin/programs/${encodeURIComponent(semester.program.id)}` }] : []),
            { label: semester?.name || "Semester" },
          ]}
          actions={semester ? <span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${semester.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{semester.isActive ? "Active" : "Inactive"}</span> : null}
        />

        {loading ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map((i) => <div key={i} className="h-36 animate-pulse rounded-2xl border border-slate-200 bg-white" />)}</div> : null}
        {error ? <section role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">{error}<button type="button" onClick={() => window.location.reload()} className="ml-3 font-semibold underline">Retry</button></section> : null}

        {!loading && !error ? (
          <>
            <section className="flex flex-wrap items-center justify-between gap-3">
              <div><h2 className="text-lg font-bold text-slate-900">Sections</h2><p className="mt-1 text-sm text-slate-500">{total.toLocaleString("en-IN")} sections in this semester</p></div>
              <Link href={`/admin/sections?semesterId=${encodeURIComponent(semesterId)}`} className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-700">Manage sections</Link>
            </section>
            <ExpandableList
              items={sections}
              getKey={(section) => section.id}
              label="sections"
              className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
              empty={<section className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">No sections are configured for this semester yet.</section>}
              renderItem={(section) => (
                <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Section</p><h3 className="mt-1 text-lg font-bold text-slate-900">{section.name}</h3></div>
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${section.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{section.isActive ? "Active" : "Inactive"}</span>
                  </div>
                  <div className="mt-4 border-t border-slate-100 pt-4"><p className="text-xs text-slate-500">Capacity</p><p className="mt-1 text-xl font-bold text-slate-900">{section.capacity ?? "Not set"}</p></div>
                </article>
              )}
            />
          </>
        ) : null}
      </main>
    </DashboardShell>
  );
}
