"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import { getCurrentUser } from "@/lib/auth";
import {
  listMyExamEligibility, registerForExam, listStudentHallTickets,
  downloadHallTicketPdf, downloadMarksheetPdf, getMyExamPerformance, getMyPublishedExamResults
} from "@/lib/examinationsApi";

type View = "upcoming" | "registration" | "admit-cards" | "performance" | "results";
const links: Array<[View,string,string]> = [
  ["upcoming","Upcoming Examinations","/student/examinations"],
  ["registration","Exam Registration","/student/examinations/registration"],
  ["admit-cards","Admit Cards","/student/examinations/admit-cards"],
  ["performance","Performance","/student/examinations/performance"],
  ["results","Results","/student/examinations/results"],
];
const date = (v?: string | null) => {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"});
};

function Shell({ view, children }: { view: View; children: React.ReactNode }) {
  return <DashboardShell title="Examinations" subtitle="Your examination registration, admit cards, performance and results" allowedRoles={["STUDENT"]}>
    <div className="mx-auto max-w-6xl space-y-5 pb-10">
      <DashboardPageHeader
        eyebrow="Student workspace"
        title="Examinations"
        description="Your examination registration, admit cards, performance and published results."
        breadcrumbs={[{ label: "Student dashboard", href: "/student" }, { label: "Examinations" }]}
      />
      <nav className="flex flex-wrap gap-2" aria-label="Examination sections">
        {links.map(([key,label,href]) => <Link key={key} href={href} className={view===key ? "rounded-xl bg-slate-950 px-3 py-2 text-xs font-bold text-white" : "rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600"}>{label}</Link>)}
      </nav>
      {children}
    </div>
  </DashboardShell>;
}

export function StudentExaminationsModule({ view }: { view: View }) {
  const [items,setItems]=useState<any[]>([]);
  const [tickets,setTickets]=useState<any[]>([]);
  const [rows,setRows]=useState<any[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [busy,setBusy]=useState("");
  const [message,setMessage]=useState("");

  const requestSequence = useRef(0);

  async function load() {
    const sequence = ++requestSequence.current;
    setLoading(true);
    setError("");
    try {
      if (view==="admit-cards") {
        const user=await getCurrentUser();
        const result=await listStudentHallTickets(user.id);
        if (sequence === requestSequence.current) setTickets(result);
      } else if (view==="performance") {
        const result=await getMyExamPerformance();
        if (sequence === requestSequence.current) setRows(result);
      } else if (view==="results") {
        const result=await getMyPublishedExamResults();
        if (sequence === requestSequence.current) setRows(result);
      } else {
        const result=await listMyExamEligibility();
        if (sequence === requestSequence.current) setItems(result);
      }
    } catch(e) {
      if (sequence === requestSequence.current) setError(e instanceof Error ? e.message : "Unable to load examinations.");
    } finally {
      if (sequence === requestSequence.current) setLoading(false);
    }
  }
  useEffect(()=>{
    void load();
    return () => { requestSequence.current += 1; };
  },[view]);

  async function register(sessionId:string) {
    setBusy(sessionId); setError(""); setMessage("");
    try {
      const r=await registerForExam(sessionId);
      setMessage(r.feeStatus==="PENDING" ? "Registration completed. Examination fee is pending in Fees." : "Registration completed.");
      await load();
    } catch(e) { setError(e instanceof Error ? e.message : "Registration failed."); }
    finally { setBusy(""); }
  }

  async function download(sessionId:string) {
    setBusy(sessionId); setError("");
    try {
      const f=await downloadHallTicketPdf(sessionId);
      const url=URL.createObjectURL(f.blob);
      const a=document.createElement("a"); a.href=url; a.download=f.filename; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(()=>URL.revokeObjectURL(url),1000);
    } catch(e) { setError(e instanceof Error ? e.message : "Unable to download admit card."); }
    finally { setBusy(""); }
  }

  return <Shell view={view}>
    {loading && <div className="grid gap-4 md:grid-cols-2"><div className="h-36 animate-pulse rounded-2xl bg-slate-100"/><div className="h-36 animate-pulse rounded-2xl bg-slate-100"/></div>}
    {error && <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">{error}<button onClick={()=>void load()} className="ml-3 font-bold underline">Retry</button></div>}
    {message && <div role="status" className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">{message}</div>}

    {!loading && !error && (view==="upcoming" || view==="registration") && <div className="space-y-4">
      {items.length===0 && <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">No applicable examinations are available.</div>}
      {items.map((x:any)=><section key={x.session.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div><p className="text-lg font-black text-slate-950">{x.session.name}</p><p className="mt-1 text-sm text-slate-500">{String(x.session.examType || "").replaceAll("_"," ")} · {date(x.session.startDate)}–{date(x.session.endDate)}</p><p className="mt-2 text-sm text-slate-600">{x.session.instructions || "Follow the examination instructions issued by the Examination Cell."}</p></div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">{String(x.eligibility.status).replaceAll("_"," ")}</span>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-slate-50 p-3"><p className="text-[10px] font-black uppercase text-slate-400">Registration</p><p className="mt-1 text-sm font-bold">{x.registration?.status || "NOT_REGISTERED"}</p></div>
          <div className="rounded-xl bg-slate-50 p-3"><p className="text-[10px] font-black uppercase text-slate-400">Fee</p><p className="mt-1 text-sm font-bold">{Number(x.session.examFee||0)>0 ? "₹"+Number(x.session.examFee).toLocaleString("en-IN")+" · "+(x.registration?.feeStatus||"PENDING") : "Not required"}</p></div>
          <div className="rounded-xl bg-slate-50 p-3"><p className="text-[10px] font-black uppercase text-slate-400">Deadline</p><p className="mt-1 text-sm font-bold">{date(x.session.registrationEnd)}</p></div>
        </div>
        {x.schedules?.length ? <div className="mt-4 space-y-2">{x.schedules.map((s:any)=><div key={s.id} className="rounded-xl border border-slate-100 p-3"><p className="text-sm font-bold">{s.courseCode} — {s.courseName}</p><p className="text-xs text-slate-500">{date(s.examDate)} · {s.startTime}–{s.endTime} · Max {s.maxMarks} · Pass {s.passMarks}</p></div>)}</div> : null}
        {x.eligibility.reasons?.length ? <p className="mt-3 text-xs font-semibold text-amber-700">{x.eligibility.reasons.join(" · ")}</p> : null}
        {view==="registration" && x.session.registrationRequired && x.eligibility.status==="ELIGIBLE" && x.registration?.status!=="REGISTERED" && <button onClick={()=>void register(x.session.id)} disabled={busy===x.session.id} className="mt-4 rounded-xl bg-slate-950 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50">{busy===x.session.id ? "Registering…" : "Register"}</button>}
      </section>)}
    </div>}

    {!loading && !error && view==="admit-cards" && <div className="space-y-4">
      {tickets.length===0 && <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">No issued admit cards are available yet.</div>}
      {tickets.map((t:any)=><section key={t.ticket.id} className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-black text-slate-950">{t.session.name}</p><p className="text-xs text-slate-500">Serial {t.ticket.serialNumber} · Issued {date(t.ticket.issuedAt)}</p></div><span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">{t.ticket.status}</span></div>
        <div className="mt-4 space-y-2">{t.papers.map((p:any)=><div key={p.examScheduleId} className="rounded-xl bg-slate-50 p-3"><p className="font-bold">{p.courseCode} — {p.courseName}</p><p className="text-xs text-slate-500">{date(p.examDate)} · {p.startTime}–{p.endTime} · {p.roomName} · Seat {p.seatNumber}</p></div>)}</div>
        <button onClick={()=>void download(t.session.id)} disabled={busy===t.session.id} className="mt-4 rounded-xl bg-slate-950 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50">{busy===t.session.id ? "Generating…" : "Download PDF"}</button>
      </section>)}
    </div>}

    {!loading && !error && (view==="performance" || view==="results") && <div className="space-y-3">
      {rows.length===0 && <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">{view==="results" ? "No published results are available yet." : "No approved examination marks are available yet."}</div>}
      {rows.map((r:any,i:number)=><section key={String(r.examScheduleId)+i} className="rounded-2xl border border-slate-200 bg-white p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-bold text-slate-950">{r.courseCode} — {r.courseName}</p><p className="text-xs text-slate-500">{r.examName} · {date(r.examDate)}</p></div><p className="text-sm font-black">{r.marksObtained===null || r.marksObtained===undefined ? "AB" : String(r.marksObtained)+"/"+String(r.maxMarks)}</p></div><div className="mt-2 flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-slate-500">{view==="results" ? "Published "+date(r.publishedAt) : "Status "+r.status}</p>{view==="results" && <button onClick={async()=>{setBusy(String(r.examSessionId));try{const f=await downloadMarksheetPdf(String(r.examSessionId));const u=URL.createObjectURL(f.blob);const a=document.createElement("a");a.href=u;a.download=f.filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),1000);}catch(e){setError(e instanceof Error?e.message:"Unable to download marksheet.");}finally{setBusy("");}}} disabled={busy===String(r.examSessionId)} className="rounded-xl bg-slate-950 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{busy===String(r.examSessionId)?"Generating…":"Download Marksheet"}</button>}</div></section>)}
    </div>}
  </Shell>;
}
