"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import { AuthRequiredError, authedFetch } from "@/lib/auth";

type Campus = {
  id: string;
  name: string;
  code: string;
  address: string | null;
  isActive: boolean;
  _count?: { departments?: number; campusAccesses?: number };
};

type Department = {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
  _count?: { programs?: number; courses?: number };
};

export default function CampusWorkspacePage() {
  const params = useParams<{ campusId: string }>();
  const router = useRouter();
  const campusId = String(params.campusId || "");
  const [campus, setCampus] = useState<Campus | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [totalDepartments, setTotalDepartments] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!campusId) {
      setError("A valid campus is required.");
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    setError("");
    Promise.all([
      authedFetch<{ data: Campus }>(`/campuses/${encodeURIComponent(campusId)}`),
      authedFetch<{ data: Department[]; meta?: { total?: number } }>(
        `/departments?page=1&pageSize=100&campusId=${encodeURIComponent(campusId)}`,
      ),
    ]).then(([campusResponse, departmentResponse]) => {
      if (!active) return;
      setCampus(campusResponse.data);
      setDepartments(departmentResponse.data);
      setTotalDepartments(departmentResponse.meta?.total ?? departmentResponse.data.length);
    }).catch((reason) => {
      if (!active) return;
      if (reason instanceof AuthRequiredError) {
        router.replace("/login");
        return;
      }
      setError(reason instanceof Error ? reason.message : "Unable to load campus information.");
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [campusId, router]);

  return (
    <DashboardShell title={campus?.name || "Campus"} subtitle="Campus-scoped academic structure" allowedRoles={["INSTITUTION_ADMIN"]}>
      <main className="mx-auto w-full max-w-7xl space-y-5 p-4 pb-12 sm:p-6 lg:p-8">
        <DashboardPageHeader
          eyebrow="Institution administration"
          title={campus?.name || "Campus workspace"}
          description={campus?.address || "Departments and academic structure belonging to this campus."}
          breadcrumbs={[
            { label: "Admin", href: "/admin" },
            { label: "Campuses", href: "/admin/campuses" },
            { label: campus?.name || "Campus" },
          ]}
          actions={campus ? <span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${campus.isActive ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{campus.isActive ? "Active" : "Inactive"}</span> : null}
        />

        {loading ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map((item) => <div key={item} className="h-40 animate-pulse rounded-2xl border border-slate-200 bg-white" />)}</div> : null}
        {error ? <section role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700"><p>{error}</p><button type="button" onClick={() => window.location.reload()} className="mt-3 font-semibold underline">Retry</button></section> : null}

        {!loading && !error ? (
          <>
            <section className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Departments</h2>
                <p className="mt-1 text-sm text-slate-500">{totalDepartments.toLocaleString("en-IN")} departments in this campus</p>
              </div>
              <Link href={`/admin/departments?campusId=${encodeURIComponent(campusId)}`} className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-700">Manage departments</Link>
            </section>
            {departments.length ? (
              <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {departments.map((department) => (
                  <Link key={department.id} href={`/admin/departments/${encodeURIComponent(department.id)}`} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{department.code}</p>
                        <h3 className="mt-1 text-lg font-bold text-slate-900">{department.name}</h3>
                      </div>
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${department.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{department.isActive ? "Active" : "Inactive"}</span>
                    </div>
                    <div className="mt-5 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4">
                      <div><p className="text-xs text-slate-500">Programs</p><p className="mt-1 text-xl font-bold text-slate-900">{department._count?.programs ?? "—"}</p></div>
                      <div><p className="text-xs text-slate-500">Courses</p><p className="mt-1 text-xl font-bold text-slate-900">{department._count?.courses ?? "—"}</p></div>
                    </div>
                    <p className="mt-4 text-sm font-semibold text-blue-700">Open department →</p>
                  </Link>
                ))}
              </section>
            ) : (
              <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
                <h3 className="font-semibold text-slate-900">No departments in this campus yet</h3>
                <p className="mt-1 text-sm text-slate-500">Create a department in this campus to start organizing programs and courses.</p>
                <Link href={`/admin/departments?campusId=${encodeURIComponent(campusId)}`} className="mt-4 inline-flex rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white">Create department</Link>
              </section>
            )}
          </>
        ) : null}
      </main>
    </DashboardShell>
  );
}
