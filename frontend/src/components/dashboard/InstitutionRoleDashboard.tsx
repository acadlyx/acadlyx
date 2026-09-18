"use client";

import { useEffect, useMemo, useState } from "react";
import { DashboardShell } from "./DashboardShell";
import { authedFetch, AuthRequiredError } from "@/lib/auth";
import { useRouter } from "next/navigation";

type Workspace = { stats: Record<string, number>; notices: { id: string; title: string; body: string }[]; students?: any[]; facultyOfferings?: any[]; departments?: any[]; fees?: any[]; exams?: any[] };

const config: Record<string, { title: string; subtitle: string; focus: string[] }> = {
  DIRECTOR: { title: "Director Dashboard", subtitle: "Institution-wide performance and strategic oversight", focus: ["Institution KPIs", "Department performance", "Academic risk", "Placements", "Strategic actions"] },
  MANAGEMENT: { title: "Management Home", subtitle: "Executive control centre for your institution", focus: ["Institution KPIs", "Growth & operations", "Academic health", "Placement outcomes", "Decision support"] },
  HOD: { title: "HOD Dashboard", subtitle: "Department performance and academic operations", focus: ["Department KPIs", "Faculty workload", "Student risk", "Course performance", "Academic actions"] },
  PARENT: { title: "Parent Dashboard", subtitle: "Your child’s academic and campus progress", focus: ["Child overview", "Attendance", "Marks", "Fees", "Notices"] },
  STAFF: { title: "Staff Dashboard", subtitle: "Institutional operations workspace", focus: ["Operations", "Students", "Academics", "Notices", "Reports"] },
};

export function InstitutionRoleDashboard({ role }: { role: keyof typeof config }) {
  const router = useRouter();
  const [data, setData] = useState<Workspace | null>(null);
  const [error, setError] = useState("");
  const c = config[role];
  useEffect(() => { authedFetch<{ success: true; data: Workspace }>("/erp/me/workspace").then(r => setData(r.data)).catch(e => { if (e instanceof AuthRequiredError) router.replace("/login"); else setError(e.message); }); }, [router]);
  const stats = useMemo(() => data?.stats || {}, [data]);
  const cards = role === "PARENT" ? [["Children", data?.students?.length ?? 0], ["Fees", data?.fees?.length ?? 0], ["Exam results", data?.exams?.length ?? 0], ["Notices", data?.notices?.length ?? 0]] : [["Students", stats.students ?? 0], ["Faculty", stats.faculty ?? 0], ["Departments", stats.departments ?? 0], ["Courses", stats.courses ?? 0], ["Assignments", stats.assignments ?? 0], ["Exams", stats.exams ?? 0], ["Documents", stats.documents ?? 0], ["Notifications", stats.notifications ?? 0]];
  return <DashboardShell title={c.title} subtitle={c.subtitle} allowedRoles={[role]}>
    <div className="mx-auto max-w-7xl"><div className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-slate-400">ACADLYX · CAMPUS INTELLIGENCE</p><h1 className="mt-2 text-2xl font-bold tracking-tight">{c.title}</h1><p className="mt-1 text-sm text-slate-500">{c.subtitle}</p></div><div className="flex flex-wrap gap-2">{c.focus.map(x => <span key={x} className="rounded-full bg-white px-3 py-1.5 text-xs font-medium text-slate-600 ring-1 ring-slate-200">{x}</span>)}</div></div>
    {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{cards.map(([label,value]) => <div key={String(label)} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</p><p className="mt-2 text-3xl font-bold">{Number(value).toLocaleString("en-IN")}</p></div>)}</div>
    <div className="mt-6 grid gap-5 xl:grid-cols-[1.5fr_1fr]"><section className="rounded-2xl border border-slate-200 bg-white p-5"><div className="flex items-center justify-between"><h2 className="font-semibold">Current notices</h2><span className="text-xs text-slate-400">Live</span></div><div className="mt-4 space-y-3">{data?.notices?.length ? data.notices.map(n => <article key={n.id} className="rounded-xl bg-slate-50 p-4"><p className="text-sm font-semibold">{n.title}</p><p className="mt-1 text-sm leading-6 text-slate-500">{n.body}</p></article>) : <p className="text-sm text-slate-500">No active notices.</p>}</div></section><section className="rounded-2xl border border-slate-200 bg-slate-950 p-5 text-white"><p className="text-xs font-bold uppercase tracking-widest text-slate-400">Next actions</p><h2 className="mt-2 text-xl font-semibold">Run the institution from one place.</h2><div className="mt-4 grid gap-2">{["Open Intelligence", "Import institutional data", "Manage public website", "Review placement readiness"].map((x,i) => <button key={x} onClick={() => router.push(["/intelligence","/imports","/site-content","/placements"][i])} className="rounded-lg bg-white/10 px-3 py-2.5 text-left text-sm hover:bg-white/15">{x} →</button>)}</div></section></div></div>
  </DashboardShell>;
}
