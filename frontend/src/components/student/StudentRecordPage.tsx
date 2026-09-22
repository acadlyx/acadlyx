"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { AuthRequiredError } from "@/lib/auth";
import { getMyStudentPortal, StudentPortalData } from "@/lib/portalApi";

type View = "profile" | "fees" | "results" | "examinations";

function money(value: number) { return `₹${value.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`; }
function date(value: string | null) { return value ? new Date(value).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—"; }

export function StudentRecordPage({ view }: { view: View }) {
  const router = useRouter();
  const [data, setData] = useState<StudentPortalData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const load = () => {
    setLoading(true); setError("");
    getMyStudentPortal().then(setData).catch((reason: Error) => {
      if (reason instanceof AuthRequiredError) router.replace("/login"); else setError(reason.message);
    }).finally(() => setLoading(false));
  };
  useEffect(load, [router]);
  const title = { profile: "My Profile", fees: "Fees", results: "Results", examinations: "Examinations" }[view];
  return <DashboardShell title={title} subtitle="Student workspace" allowedRoles={["STUDENT"]}><main className="mx-auto max-w-5xl space-y-5">
    {loading && <div className="space-y-3"><div className="h-24 animate-pulse rounded-lg bg-slate-200" /><div className="h-48 animate-pulse rounded-lg bg-slate-200" /></div>}
    {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}<button onClick={load} className="ml-3 font-semibold underline">Retry</button></div>}
    {!loading && !error && data && <Content view={view} data={data} />}
  </main></DashboardShell>;
}

function Content({ view, data }: { view: View; data: StudentPortalData }) {
  if (view === "profile") { const p = data.student.profile; const e = data.enrollment; return <><section className="rounded-lg border border-slate-200 bg-white p-6"><h1 className="text-xl font-semibold">{data.student.firstName} {data.student.lastName}</h1><p className="mt-1 text-sm text-slate-500">{data.student.email}{data.student.phone ? ` · ${data.student.phone}` : ""}</p></section><section className="grid gap-4 md:grid-cols-2"><Card title="Academic record"><Row label="Admission number" value={p?.admissionNumber || "—"}/><Row label="Program" value={e?.program.name || "—"}/><Row label="Academic year" value={e?.academicYear.name || "—"}/><Row label="Section" value={e?.section ? `${e.section.semester.name} · ${e.section.name}` : "—"}/></Card><Card title="Academic summary"><Row label="Attendance" value={`${data.attendance.percentage}%`}/><Row label="Subjects with marks" value={String(data.marks.length)}/><Row label="Outstanding fees" value={money(data.fees.reduce((sum, item) => sum + item.balance, 0))}/><Row label="Documents" value={String(data.documents.length)}/></Card></section></>; }
  if (view === "fees") return <List title="Fee records" empty="No fee records are available." items={data.fees.map((item) => <div key={item.id} className="flex justify-between gap-4"><div><p className="font-medium">{item.title}</p><p className="text-sm text-slate-500">Due {date(item.dueDate)} · {item.status}</p></div><p className="text-right text-sm">{money(item.paid)} paid<br/><span className="text-slate-500">{money(item.balance)} balance</span></p></div>)}/>;
  if (view === "results") return <List title="Published results" empty="No examination results have been published." items={data.exams.filter((item) => item.result).map((item) => <div key={item.id} className="flex justify-between gap-4"><div><p className="font-medium">{item.course.code} · {item.title}</p><p className="text-sm text-slate-500">{date(item.examDate)}</p></div><p className="font-semibold">{item.result?.marks}/{item.maxMarks}</p></div>)}/>;
  if (view === "examinations") return <List title="Examinations" empty="No examinations are scheduled." items={data.exams.map((item) => <div key={item.id} className="flex justify-between gap-4"><div><p className="font-medium">{item.course.code} · {item.title}</p><p className="text-sm text-slate-500">{date(item.examDate)}</p></div><p className="text-sm text-slate-600">Max {item.maxMarks}</p></div>)}/>;
  return null;
}
function Row({ label, value }: { label: string; value: string }) { return <div className="flex justify-between gap-4 border-b border-slate-100 py-2 text-sm last:border-0"><span className="text-slate-500">{label}</span><span className="text-right font-medium text-slate-800">{value}</span></div>; }
function Card({ title, children }: { title: string; children: React.ReactNode }) { return <section className="rounded-lg border border-slate-200 bg-white p-5"><h2 className="mb-3 font-semibold">{title}</h2>{children}</section>; }
function List({ title, empty, items }: { title: string; empty: string; items: React.ReactNode[] }) { return <section className="rounded-lg border border-slate-200 bg-white"><header className="border-b border-slate-100 px-5 py-4"><h1 className="font-semibold">{title}</h1></header>{items.length ? <div className="divide-y divide-slate-100">{items.map((item, index) => <article key={index} className="p-5">{item}</article>)}</div> : <p className="p-8 text-center text-sm text-slate-500">{empty}</p>}</section>; }
