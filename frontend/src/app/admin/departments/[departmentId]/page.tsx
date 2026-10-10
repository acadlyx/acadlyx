"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import { AuthRequiredError, authedFetch } from "@/lib/auth";

type Workspace = {
  department: { id: string; name: string; code: string; isActive: boolean; campus?: { id: string; name: string; code: string } | null };
  metrics: { students: number; faculty: number; programs: number; sections: number; courses: number; offerings: number };
};

const modules = [
  { key: "students", label: "Students", description: "Student master records and canonical academic enrollment.", href: "/admin/students", metric: "students", group: "People" },
  { key: "faculty", label: "Faculty", description: "Teaching people assigned to this department.", href: "/admin/users?category=faculty", metric: "faculty", group: "People" },
  { key: "programs", label: "Programs", description: "Programs owned by this department.", href: "/admin/programs", metric: "programs", group: "Academic Structure" },
  { key: "academic-years", label: "Academic Years", description: "Institution-wide academic year definitions used by this department.", href: "/admin/academic-years", metric: null, group: "Academic Structure" },
  { key: "semesters", label: "Semesters", description: "Program and academic-year semester contexts.", href: "/admin/semesters", metric: null, group: "Academic Structure" },
  { key: "sections", label: "Sections", description: "Sections under the department's semester contexts.", href: "/admin/sections", metric: "sections", group: "Academic Structure" },
  { key: "courses", label: "Courses", description: "Department-owned curriculum and course master data.", href: "/admin/courses", metric: "courses", group: "Curriculum" },
  { key: "course-offerings", label: "Course Offerings", description: "Actual course delivery by semester, section and faculty.", href: "/admin/course-offerings", metric: "offerings", group: "Curriculum" },
];

export default function DepartmentWorkspacePage() {
  const params = useParams<{ departmentId: string }>();
  const router = useRouter();
  const departmentId = String(params.departmentId || "");
  const [data, setData] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!departmentId) return;
    let alive = true;
    setLoading(true);
    authedFetch<{ data: Workspace }>(`/departments/${encodeURIComponent(departmentId)}/workspace`)
      .then((response) => { if (alive) setData(response.data); })
      .catch((reason) => {
        if (!alive) return;
        if (reason instanceof AuthRequiredError) { router.replace("/login"); return; }
        setError(reason instanceof Error ? reason.message : "Unable to load department workspace.");
      })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [departmentId, router]);

  const groups = useMemo(() => {
    const map = new Map<string, typeof modules>();
    for (const item of modules) {
      const list = map.get(item.group) || [];
      list.push(item);
      map.set(item.group, list);
    }
    return Array.from(map.entries());
  }, []);

  return (
    <DashboardShell title={data?.department.name || "Department"} subtitle="Department-scoped institutional administration" allowedRoles={["INSTITUTION_ADMIN"]}>
      <main className="mx-auto w-full max-w-[1500px] space-y-6 p-4 pb-12 sm:p-6 lg:p-8">
        <DashboardPageHeader
          eyebrow="Institution administration"
          title={data?.department.name || "Department"}
          description={`Department-scoped workspace · ${data?.department.code || "Loading department"}${data?.department.campus ? ` · ${data.department.campus.name}` : ""}`}
          breadcrumbs={[
            { label: "Admin", href: "/admin" },
            { label: "Departments", href: "/admin/departments" },
            { label: data?.department.name || "Department" },
          ]}
          actions={data ? <span className={`rounded-full px-3 py-1.5 text-xs font-bold ${data.department.isActive ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{data.department.isActive ? "Active" : "Inactive"}</span> : null}
        />

        {loading ? <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">{Array.from({length: 6}, (_, i) => <div key={i} className="h-28 animate-pulse rounded-3xl bg-white border border-slate-200" />)}</section> : null}
        {error ? <section className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm font-semibold text-rose-700">{error}</section> : null}

        {data ? <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
            {Object.entries(data.metrics).map(([key, value]) => <div key={key} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">{key}</p>
              <p className="mt-3 text-3xl font-black tracking-[-0.04em] text-slate-950">{new Intl.NumberFormat("en-IN").format(value)}</p>
              <p className="mt-1 text-xs text-slate-500">Active department-scoped records</p>
            </div>)}
          </section>

          {groups.map(([group, items]) => <section key={group} className="space-y-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#315c4a]">{group}</p>
              <h2 className="mt-1 text-2xl font-black tracking-[-0.035em] text-slate-950">{group}</h2>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {items.map((item) => {
                const href = item.key === "academic-years" ? item.href : `${item.href}${item.href.includes("?") ? "&" : "?"}departmentId=${encodeURIComponent(departmentId)}`;
                const metric = item.metric ? data.metrics[item.metric as keyof Workspace["metrics"]] : null;
                return <Link key={item.key} href={href} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-lg">
                  <div className="flex items-start justify-between gap-4">
                    <div><h3 className="text-lg font-black text-slate-950">{item.label}</h3><p className="mt-1 text-sm leading-6 text-slate-500">{item.description}</p></div>
                    {metric !== null ? <span className="rounded-2xl bg-slate-50 px-3 py-2 text-sm font-black text-slate-900">{metric}</span> : null}
                  </div>
                  <span className="mt-5 inline-flex text-xs font-black text-blue-600">Open {item.label} →</span>
                </Link>;
              })}
            </div>
          </section>)}
        </> : null}
      </main>
    </DashboardShell>
  );
}
