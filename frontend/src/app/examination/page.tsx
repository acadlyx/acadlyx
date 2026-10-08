"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { MultiEntityPicker, EntityPicker } from "@/components/common/EntityPicker";
import { listAcademicYears, listCampuses, listDepartments, listPrograms, listSections, listSemesters } from "@/lib/erpApi";
import { DirectoryOption } from "@/lib/directoryApi";
import { AuthRequiredError, getCurrentUser } from "@/lib/auth";
import {
  ExamRoom,
  ExamSchedule,
  ExamSession,
  createExamRoom,
  createExamSchedule,
  createExamSession,
  generateHallTickets,
  getExamSession,
  getMarksSheet,
  listExamRooms,
  listExamSessions,
  listIncidents,
  listMyInvigilation,
  listRevaluations,
  lockSchedule,
  publishResults,
  saveMarks,
  setSessionStatus,
  allocateSeating,
  approveMarks,
  recordExamAttendance,
  getExaminationReadiness,
} from "@/lib/examinationsApi";

type View =
  | "overview" | "examinations" | "create" | "calendar" | "schedule"
  | "rooms" | "invigilators" | "exam-day" | "admit-cards"
  | "incidents" | "marks" | "revaluation" | "reports";

const TYPES = [
  ["REGULAR", "Regular"],
  ["MID_SEMESTER", "Mid Semester"],
  ["INTERNAL_ASSESSMENT", "Internal Assessment"],
  ["END_SEMESTER", "End Semester"],
  ["SEMESTER", "Semester Examination"],
  ["PRACTICAL", "Practical"],
  ["VIVA", "Viva"],
  ["UNIVERSITY", "University"],
  ["SUPPLEMENTARY", "Supplementary"],
  ["BACK_PAPER", "Back Paper"],
  ["IMPROVEMENT", "Improvement"],
  ["REAPPEAR", "Reappear"],
  ["MAKE_UP", "Make-up"],
  ["SPECIAL", "Special"],
  ["REVALUATION", "Revaluation"],
] as const;

function date(v?: string | null) {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

function time(v?: string | null) { return v || "—"; }

function statusTone(s: string) {
  if (["PUBLISHED","RESULTS_PUBLISHED","APPROVED"].includes(s)) return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  if (["ONGOING","SCHEDULED","READY"].includes(s)) return "bg-blue-50 text-blue-700 ring-blue-200";
  if (["LOCKED","AWAITING_APPROVAL"].includes(s)) return "bg-amber-50 text-amber-700 ring-amber-200";
  if (["CANCELLED","REJECTED"].includes(s)) return "bg-red-50 text-red-700 ring-red-200";
  return "bg-slate-100 text-slate-700 ring-slate-200";
}

function Pill({ value }: { value: string }) {
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ring-1 ${statusTone(value)}`}>{value.replaceAll("_", " ")}</span>;
}

export default function ExaminationPage() {
  const params = useSearchParams();
  const initial = (params.get("view") as View) || "overview";
  const [view, setView] = useState<View>(initial);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [sessions, setSessions] = useState<ExamSession[]>([]);
  const [rooms, setRooms] = useState<ExamRoom[]>([]);
  const [schedules, setSchedules] = useState<(ExamSchedule & { examName: string; examType: string })[]>([]);
  const [invigilation, setInvigilation] = useState<Record<string, unknown>[]>([]);
  const [incidents, setIncidents] = useState<Record<string, unknown>[]>([]);
  const [revaluations, setRevaluations] = useState<Record<string, unknown>[]>([]);
  const [selected, setSelected] = useState<(ExamSession & { schedules: ExamSchedule[] }) | null>(null);
  const [marks, setMarks] = useState<{ schedule: ExamSchedule; rows: any[] } | null>(null);
  const [draft, setDraft] = useState<Record<string,string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [readiness, setReadiness] = useState<any>(null);
  const [academicYears, setAcademicYears] = useState<Array<{id:string;name:string;isCurrent?:boolean}>>([]);
  const [campuses, setCampuses] = useState<Array<{id:string;name:string;code?:string}>>([]);
  const [departments, setDepartments] = useState<Array<{id:string;name:string;code?:string}>>([]);
  const [programs, setPrograms] = useState<Array<{id:string;name:string;code?:string}>>([]);
  const [semesters, setSemesters] = useState<Array<{id:string;name:string;number?:number}>>([]);
  const [sections, setSections] = useState<Array<{id:string;name:string;code?:string}>>([]);

  const can = (p: string) => permissions.includes(p);
  const canManage = can("exams.manage");
  const canApprove = can("exams.approve");
  const canMarks = can("marks.read");
  const canEnter = can("marks.enter");
  const canInvigilate = can("exams.invigilate");

  async function run(fn: () => Promise<void>) {
    setBusy(true); setError(""); setNotice("");
    try { await fn(); }
    catch (e) {
      if (e instanceof AuthRequiredError) { window.location.href = "/login"; return; }
      setError(e instanceof Error ? e.message : "Examination operation failed.");
    } finally { setBusy(false); }
  }

  async function load() {
    setLoading(true); setError("");
    try {
      const user = await getCurrentUser();
      setPermissions(user?.permissions ?? []);
      const [ss, rr, ii, rv, rd, years, campusRows, departmentRows, programRows, semesterRows, sectionRows] = await Promise.all([
        listExamSessions({ page: 1 }),
        listExamRooms().catch(() => []),
        listIncidents({ page: 1 }).then(x => x.items).catch(() => []),
        listRevaluations({ page: 1 }).then(x => x.items).catch(() => []),
        getExaminationReadiness().catch(() => null),
        listAcademicYears(),
        listCampuses(),
        listDepartments(),
        listPrograms(),
        listSemesters(),
        listSections(),
      ]);
      setAcademicYears(years); setCampuses(campusRows); setDepartments(departmentRows); setPrograms(programRows); setSemesters(semesterRows); setSections(sectionRows);
      
      setSessions(ss.items); setRooms(rr); setIncidents(ii); setRevaluations(rv); setReadiness(rd);
      if (can("exams.invigilate")) setInvigilation(await listMyInvigilation().catch(() => []));
      const details = await Promise.all(ss.items.slice(0, 12).map(s => getExamSession(s.id).catch(() => null)));
      setSchedules(details.flatMap((d: any) => (d?.schedules ?? []).map((x: any) => ({ ...x, examName: d.name, examType: d.examType }))));
    } catch (e) {
      if (e instanceof AuthRequiredError) { window.location.href = "/login"; return; }
      setError(e instanceof Error ? e.message : "Unable to load examination workspace.");
    } finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, []);
  useEffect(() => { setView(initial); }, [initial]);

  const metrics = useMemo(() => {
    const today = new Date().toISOString().slice(0,10);
    return {
      total: sessions.length,
      upcoming: sessions.filter(s => new Date(s.startDate) > new Date() && !["CANCELLED","PUBLISHED"].includes(s.status)).length,
      active: sessions.filter(s => ["SCHEDULED","ONGOING","COMPLETED"].includes(s.status)).length,
      today: schedules.filter(s => new Date(s.examDate).toISOString().slice(0,10) === today).length,
      rooms: rooms.length,
      missingMarks: schedules.filter(s => ["DRAFT","PUBLISHED"].includes(s.status) && !s.markCount).length,
      ready: schedules.filter(s => s.status === "LOCKED").length,
      incidents: incidents.length,
      revaluation: revaluations.length,
    };
  }, [sessions, schedules, rooms, incidents, revaluations]);

  async function openSession(id: string) {
    await run(async () => setSelected(await getExamSession(id)));
  }

  async function openMarks(id: string) {
    await run(async () => {
      const x = await getMarksSheet(id); setMarks(x);
      setDraft(Object.fromEntries(x.rows.map((r: any) => [r.studentId, r.isAbsent ? "AB" : String(r.marksObtained ?? "")])));
      setView("marks");
    });
  }

  const nav = [
    ["overview","Overview"],["examinations","All Examinations"],["create","Create Examination"],
    ["calendar","Examination Calendar"],["schedule","Schedule & Subjects"],["rooms","Rooms & Seating"],
    ["invigilators","Invigilators"],["exam-day","Exam Day"],["admit-cards","Admit Cards"],
    ["incidents","Incidents"],["marks","Marks & Results"],["revaluation","Revaluation / Backlog"],["reports","Reports"],
  ] as const;

  return (
    <DashboardShell title="Examination Cell" subtitle="Examination operating system — schedule, conduct, marks, results and publication" allowedRoles={["EXAMINATION","DIRECTOR","DEAN","REGISTRAR","HOD","FACULTY","CHAIRMAN","STUDENT"]}>
      <div className="mx-auto max-w-7xl space-y-6 pb-12">
        <header className="rounded-3xl bg-slate-950 p-6 text-white shadow-xl">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-400">EXAMINATION OPERATIONS</p>
              <h1 className="mt-2 text-3xl font-black">Examination Command Center</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">Start with the examination, then operate its scope, subjects, schedule, rooms, invigilators, admit cards, attendance, marks, results and approvals.</p>
            </div>
            <button onClick={() => void load()} disabled={busy || loading} className="rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-slate-950 disabled:opacity-50">Refresh</button>
          </div>
        </header>

        <div className="flex flex-wrap gap-2">
          {nav.filter(([key]) => key === "overview" || key === "examinations" || key === "calendar" || (key === "create" && canManage) || (key === "schedule" && canManage) || (key === "rooms" && canManage) || (key === "invigilators" && canManage) || (key === "exam-day" && canInvigilate) || (key === "admit-cards" && canManage) || key === "incidents" || (key === "marks" && canMarks) || (key === "revaluation" && can("exams.revaluate")) || (key === "reports" && can("reports.read"))).map(([key,label]) =>
            <button key={key} onClick={() => setView(key)} className={view===key ? "rounded-xl bg-slate-950 px-3 py-2 text-xs font-bold text-white" : "rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"}>{label}</button>
          )}
        </div>

        {readiness && <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[.18em] text-slate-400">Examination readiness</p><h2 className="mt-1 text-xl font-black text-slate-950">Live lifecycle completion</h2></div><span className="text-xs text-slate-500">Database-backed</span></div><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{[["Registration","registration"],["Eligibility","eligibility"],["Admit Cards","admitCards"],["Faculty Marks","facultyMarks"],["Result Processing","resultProcessing"]].map(([label,key])=><div key={key} className="rounded-2xl bg-slate-50 p-4"><p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</p><p className="mt-1 text-2xl font-black text-slate-950">{readiness[key]}%</p></div>)}</div><div className="mt-4 grid gap-2 text-xs text-slate-600 sm:grid-cols-4"><span>Registration pending: <b>{readiness.exceptions.registrationPending}</b></span><span>Admit cards pending: <b>{readiness.exceptions.admitCardPending}</b></span><span>Marks pending: <b>{readiness.exceptions.marksPending}</b></span><span>Results pending: <b>{readiness.exceptions.resultsPending}</b></span></div></section>}
        {error && <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</div>}
        {notice && <div role="status" className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">{notice}</div>}

        {loading ? <Loading /> : (
          <>
            {view === "overview" && <Overview metrics={metrics} sessions={sessions} schedules={schedules} incidents={incidents} onOpen={openSession} onView={setView} />}
            {view === "examinations" && <Examinations sessions={sessions} selected={selected} onOpen={openSession} onView={setView} canManage={canManage} canApprove={canApprove} busy={busy} onStatus={(id,status)=>void run(async()=>{await setSessionStatus(id,status); await load();})} onAdmit={(id)=>void run(async()=>{const r=await generateHallTickets(id); setNotice(`Admit cards: ${r.issued} issued, ${r.blocked} blocked, ${r.skipped} already issued.`);})} />}
            {view === "create" && canManage && <CreateExam academicYears={academicYears} campuses={campuses} departments={departments} programs={programs} semesters={semesters} sections={sections} busy={busy} onSubmit={(body)=>void run(async()=>{const x=await createExamSession(body); setNotice(`Examination "${x.name}" created.`); await load(); setView("examinations");})} />}
            {view === "calendar" && <Calendar schedules={schedules} />}
            {view === "schedule" && <Schedule selected={selected} schedules={schedules} rooms={rooms} canManage={canManage} busy={busy} onOpen={openSession} onMarks={openMarks} onSeat={(id,roomIds)=>void run(async()=>{const r=await allocateSeating(id,roomIds); setNotice(`Seating allocated for ${r.seated} students across ${r.rooms} rooms.`); await load();})} onSchedule={(body)=>void run(async()=>{if(!selected) throw new Error("Open an examination first."); await createExamSchedule({...body,examSessionId:selected.id}); setNotice("Examination subject scheduled."); await openSession(selected.id); await load();})} />}
            {view === "rooms" && canManage && <Rooms rooms={rooms} busy={busy} onCreate={(body)=>void run(async()=>{await createExamRoom(body); setNotice("Room created."); await load();})} />}
            {view === "invigilators" && <SimpleList title="Invigilators" description="Faculty duty assignments are tied to examination schedules. Conflict validation is enforced by the examination API." rows={invigilation} empty="No invigilation duties are assigned to you." />}
            {view === "exam-day" && <ExamDay schedules={schedules} incidents={incidents} onAttendance={openMarks} />}
            {view === "admit-cards" && <AdmitCards sessions={sessions} canManage={canManage} busy={busy} onGenerate={(id)=>void run(async()=>{const r=await generateHallTickets(id); setNotice(`Generated ${r.issued} admit cards; ${r.blocked} blocked; ${r.skipped} already issued.`);})} />}
            {view === "incidents" && <SimpleList title="Examination Incidents" description="Malpractice, medical, late-arrival, paper and room incidents requiring examination-cell attention." rows={incidents} empty="No incidents require attention." />}
            {view === "revaluation" && <SimpleList title="Revaluation / Backlog" description="Requests remain tied to examination schedules and are governed by examination permissions." rows={revaluations} empty="No revaluation requests." />}
            {view === "reports" && <Reports sessions={sessions} schedules={schedules} />}
            {view === "marks" && canMarks && <Marks marks={marks} draft={draft} setDraft={setDraft} busy={busy} canEnter={canEnter} canApprove={canApprove} onSave={(submit)=>void run(async()=>{if(!marks) return; await saveMarks(marks.schedule.id,Object.entries(draft).map(([studentId,v])=>({studentId,isAbsent:v.trim().toUpperCase()==="AB",marksObtained:v.trim()===""||v.trim().toUpperCase()==="AB"?null:Number(v)})),submit); setNotice(submit?"Marks submitted for approval.":"Marks draft saved."); setMarks(await getMarksSheet(marks.schedule.id));})} onApprove={()=>void run(async()=>{if(!marks)return; await approveMarks(marks.schedule.id); setNotice("Marks approved."); setMarks(await getMarksSheet(marks.schedule.id));})} onLock={()=>void run(async()=>{if(!marks)return; await lockSchedule(marks.schedule.id); setNotice("Marks locked."); await load();})} onPublish={()=>void run(async()=>{if(!marks)return; const r=await publishResults(marks.schedule.id); setNotice(`Published ${r.published} results.`); await load();})} />}
          </>
        )}
      </div>
    </DashboardShell>
  );
}

function Loading(){return <div className="grid gap-4 md:grid-cols-4">{Array.from({length:8}).map((_,i)=><div key={i} className="h-28 animate-pulse rounded-2xl bg-slate-100"/>)}</div>}

function Metric({label,value,detail}:{label:string;value:number|string;detail:string}){return <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-[11px] font-bold uppercase tracking-[.16em] text-slate-400">{label}</p><p className="mt-2 text-3xl font-black text-slate-950">{value}</p><p className="mt-1 text-xs text-slate-500">{detail}</p></div>}

function Overview({metrics,sessions,schedules,incidents,onOpen,onView}:{metrics:any;sessions:ExamSession[];schedules:any[];incidents:any[];onOpen:(id:string)=>void;onView:(v:View)=>void}){
 return <div className="space-y-6">
  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5"><Metric label="Examinations" value={metrics.total} detail="Controlled examination records"/><Metric label="Upcoming" value={metrics.upcoming} detail="Not yet completed"/><Metric label="Today" value={metrics.today} detail="Scheduled papers today"/><Metric label="Rooms" value={metrics.rooms} detail="Active examination rooms"/><Metric label="Ready to publish" value={metrics.ready} detail="Locked result schedules"/></div>
  <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
   <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><div className="flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-wider text-slate-400">Upcoming examinations</p><h2 className="mt-1 text-xl font-black text-slate-950">What is happening next?</h2></div><button onClick={()=>onView("calendar")} className="text-xs font-bold text-slate-700">Calendar →</button></div><div className="mt-5 space-y-3">{schedules.slice(0,6).map(s=><button key={s.id} onClick={()=>onOpen(s.examSessionId)} className="w-full rounded-2xl border border-slate-100 p-4 text-left hover:border-slate-300"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="font-bold text-slate-950">{s.examName}</p><p className="text-sm text-slate-600">{s.courseCode} · {s.courseName}</p></div><Pill value={s.status}/></div><p className="mt-2 text-xs text-slate-500">{date(s.examDate)} · {time(s.startTime)}–{time(s.endTime)} · {s.seatCount ?? 0} seats</p></button>)}{!schedules.length&&<Empty text="No scheduled examination papers are available yet."/>}</div></section>
   <section className="space-y-5"><Action title="Needs attention" value={metrics.incidents+metrics.missingMarks} text={`${metrics.incidents} incidents · ${metrics.missingMarks} schedules with pending marks`} onClick={()=>onView(metrics.incidents?"incidents":"marks")}/><Action title="Revaluation / backlog" value={metrics.revaluation} text="Requests awaiting examination-cell action" onClick={()=>onView("revaluation")}/><Action title="Active pipeline" value={metrics.active} text="Scheduled, ongoing or completed examinations" onClick={()=>onView("examinations")}/></section>
  </div>
  <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><p className="text-xs font-bold uppercase tracking-wider text-slate-400">Lifecycle</p><div className="mt-4 grid gap-2 sm:grid-cols-4 lg:grid-cols-8">{["Draft","Configuring","Scheduled","Ready","Ongoing","Marks Pending","Awaiting Approval","Published"].map(x=><div key={x} className="rounded-xl bg-slate-50 p-3 text-center text-xs font-bold text-slate-700">{x}</div>)}</div></section>
 </div>
}

function Action({title,value,text,onClick}:{title:string;value:number;text:string;onClick:()=>void}){return <button onClick={onClick} className="w-full rounded-3xl border border-slate-200 bg-white p-5 text-left shadow-sm hover:border-slate-300"><p className="text-xs font-bold uppercase tracking-wider text-slate-400">{title}</p><p className="mt-2 text-3xl font-black text-slate-950">{value}</p><p className="mt-1 text-xs text-slate-500">{text}</p><p className="mt-4 text-xs font-bold text-slate-700">Review →</p></button>}
function Empty({text}:{text:string}){return <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">{text}</div>}

function Examinations({sessions,selected,onOpen,onView,canManage,canApprove,busy,onStatus,onAdmit}:{sessions:ExamSession[];selected:any;onOpen:(id:string)=>void;onView:(v:View)=>void;canManage:boolean;canApprove:boolean;busy:boolean;onStatus:(id:string,s:string)=>void;onAdmit:(id:string)=>void}){
 return <div className="grid gap-5 lg:grid-cols-[1fr_1.2fr]"><section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><div className="flex items-center justify-between"><h2 className="text-xl font-black">All Examinations</h2>{canManage&&<button onClick={()=>onView("create")} className="rounded-xl bg-slate-950 px-3 py-2 text-xs font-bold text-white">+ Create</button>}</div><div className="mt-5 space-y-2">{sessions.map(s=><button key={s.id} onClick={()=>onOpen(s.id)} className={`w-full rounded-2xl border p-4 text-left ${selected?.id===s.id?"border-slate-950":"border-slate-100"}`}><div className="flex items-center justify-between gap-2"><p className="font-bold text-slate-950">{s.name}</p><Pill value={s.status}/></div><p className="mt-1 text-xs text-slate-500">{s.examType.replaceAll("_"," ")} · {date(s.startDate)}–{date(s.endDate)} · {s.code}</p></button>)}{!sessions.length&&<Empty text="Create the first examination to start the operating lifecycle."/>}</div></section><section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">{selected?<><p className="text-xs font-bold uppercase tracking-wider text-slate-400">Examination</p><h2 className="mt-1 text-2xl font-black">{selected.name}</h2><p className="mt-1 text-sm text-slate-500">{selected.code} · {selected.examType.replaceAll("_"," ")}</p><div className="mt-5 grid gap-3 sm:grid-cols-2"><Info label="Start" value={date(selected.startDate)}/><Info label="End" value={date(selected.endDate)}/><Info label="Subjects scheduled" value={selected.schedules.length}/><Info label="Status" value={selected.status}/></div><div className="mt-6 flex flex-wrap gap-2">{canApprove&&selected.status==="DRAFT"&&<button onClick={()=>onStatus(selected.id,"SCHEDULED")} disabled={busy} className="rounded-xl bg-slate-950 px-3 py-2 text-xs font-bold text-white">Mark Scheduled</button>}{canManage&&<button onClick={()=>onAdmit(selected.id)} disabled={busy} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold">Generate Admit Cards</button>}<button onClick={()=>onView("schedule")} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold">Open Schedule</button></div></>:<Empty text="Select an examination to see its operational lifecycle."/>}</section></div>
}
function Info({label,value}:{label:string;value:any}){return <div className="rounded-2xl bg-slate-50 p-4"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p><p className="mt-1 font-bold text-slate-900">{value}</p></div>}

function CreateExam({academicYears,campuses,departments,programs,semesters,sections,busy,onSubmit}:{academicYears:Array<{id:string;name:string;isCurrent?:boolean}>;campuses:Array<{id:string;name:string;code?:string}>;departments:Array<{id:string;name:string;code?:string}>;programs:Array<{id:string;name:string;code?:string}>;semesters:Array<{id:string;name:string;number?:number}>;sections:Array<{id:string;name:string;code?:string}>;busy:boolean;onSubmit:(x:Record<string,unknown>)=>void}){
 const [f,setF]=useState({name:"",code:"",examType:"END_SEMESTER",startDate:"",endDate:"",academicYearId:"",semesterId:"",campusIds:[] as string[],departmentIds:[] as string[],programIds:[] as string[],semesterIds:[] as string[],sectionIds:[] as string[],studentOptions:[] as DirectoryOption[],registrationRequired:true,registrationStart:"",registrationEnd:"",examFee:"0",attendanceRequirement:"",instructions:""});
 const set=(k:string,v:unknown)=>setF(x=>({...x,[k]:v}));
 const selectClass="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm";
 return <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><p className="text-xs font-bold uppercase tracking-wider text-slate-400">Create Examination</p><h2 className="mt-1 text-2xl font-black">Start with the examination</h2><p className="mt-2 text-sm text-slate-500">Choose real academic entities. Internal identifiers remain hidden.</p>
 <form className="mt-6 grid gap-4 md:grid-cols-2" onSubmit={e=>{e.preventDefault();onSubmit({...f,studentIds:f.studentOptions.map(x=>x.id),academicYearId:f.academicYearId||undefined,semesterId:f.semesterId||undefined,registrationStart:f.registrationStart||undefined,registrationEnd:f.registrationEnd||undefined,examFee:Number(f.examFee||0),attendanceRequirement:f.attendanceRequirement===""?undefined:Number(f.attendanceRequirement||0)});}}>
 <Field label="Examination name" value={f.name} onChange={v=>set("name",v)} placeholder="B.Tech End Semester Examination — Odd Semester 2026" required/><Field label="Examination code" value={f.code} onChange={v=>set("code",v)} placeholder="BTECH-END-2026" required/>
 <label className="space-y-1"><span className="text-xs font-bold text-slate-500">Examination type</span><select value={f.examType} onChange={e=>set("examType",e.target.value)} className={selectClass}>{TYPES.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
 <label className="space-y-1"><span className="text-xs font-bold text-slate-500">Academic year</span><select value={f.academicYearId} onChange={e=>set("academicYearId",e.target.value)} className={selectClass}><option value="">Select academic year</option>{academicYears.map(x=><option key={x.id} value={x.id}>{x.name}{x.isCurrent?" · Current":""}</option>)}</select></label>
 <Field label="Start date" type="date" value={f.startDate} onChange={v=>set("startDate",v)} required/><Field label="End date" type="date" value={f.endDate} onChange={v=>set("endDate",v)} required/><Field label="Registration start" type="datetime-local" value={f.registrationStart} onChange={v=>set("registrationStart",v)}/><Field label="Registration end" type="datetime-local" value={f.registrationEnd} onChange={v=>set("registrationEnd",v)}/><Field label="Examination fee" value={f.examFee} onChange={v=>set("examFee",v)} placeholder="0"/><Field label="Attendance requirement %" value={f.attendanceRequirement} onChange={v=>set("attendanceRequirement",v)} placeholder="Optional"/>
 <label className="space-y-1"><span className="text-xs font-bold text-slate-500">Semester</span><select value={f.semesterId} onChange={e=>set("semesterId",e.target.value)} className={selectClass}><option value="">All semesters</option>{semesters.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
 {([["Campus scope",campuses,"campusIds"],["Department scope",departments,"departmentIds"],["Program scope",programs,"programIds"],["Semester scope",semesters,"semesterIds"],["Section scope",sections,"sectionIds"]] as const).map(([label,items,key])=><label key={key} className="space-y-1"><span className="text-xs font-bold text-slate-500">{label}</span><select multiple value={f[key]} onChange={e=>setF(x=>({...x,[key]:Array.from(e.target.selectedOptions).map(o=>o.value)}))} className="min-h-24 w-full rounded-xl border border-slate-200 bg-white p-2 text-sm">{items.map(x=><option key={x.id} value={x.id}>{x.name}{("code" in x && x.code)?" · "+x.code:""}</option>)}</select></label>)}
 <div className="md:col-span-2"><MultiEntityPicker kind="student" label="Individual students (optional)" values={f.studentOptions} onChange={options=>set("studentOptions",options)} placeholder="Search student name, enrollment number or roll number"/></div>
 <label className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 md:col-span-2"><input type="checkbox" checked={f.registrationRequired} onChange={e=>set("registrationRequired",e.target.checked)}/><span><span className="block text-sm font-bold">Registration required</span><span className="block text-xs text-slate-500">Turn off for internal/class examinations that are automatically applicable.</span></span></label>
 <label className="space-y-1 md:col-span-2"><span className="text-xs font-bold text-slate-500">Instructions</span><textarea value={f.instructions} onChange={e=>set("instructions",e.target.value)} rows={4} className={selectClass}/></label>
 <button disabled={busy} className="rounded-xl bg-slate-950 px-4 py-3 text-sm font-bold text-white disabled:opacity-50 md:col-span-2">Create Examination</button>
 </form></section>
}

function Field({label,value,onChange,placeholder,type="text",required=false}:{label:string;value:string;onChange:(v:string)=>void;placeholder?:string;type?:string;required?:boolean}){return <label className="space-y-1"><span className="text-xs font-bold text-slate-500">{label}</span><input required={required} type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"/></label>}

function Calendar({schedules}:{schedules:any[]}){return <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><p className="text-xs font-bold uppercase tracking-wider text-slate-400">Examination Calendar</p><h2 className="mt-1 text-2xl font-black">Schedule at a glance</h2><div className="mt-6 overflow-x-auto"><table className="w-full min-w-[850px] text-sm"><thead className="border-b text-left text-xs uppercase tracking-wider text-slate-400"><tr><th className="pb-3">Date</th><th>Time</th><th>Examination</th><th>Subject</th><th>Room seats</th><th>Status</th></tr></thead><tbody className="divide-y">{schedules.map(s=><tr key={s.id}><td className="py-3">{date(s.examDate)}</td><td>{s.startTime}–{s.endTime}</td><td className="font-bold">{s.examName}</td><td>{s.courseCode} · {s.courseName}</td><td>{s.seatCount??0}</td><td><Pill value={s.status}/></td></tr>)}</tbody></table>{!schedules.length&&<Empty text="No schedules available."/>}</div></section>}

function Schedule({selected,schedules,rooms,canManage,busy,onOpen,onMarks,onSeat,onSchedule}:{selected:any;schedules:any[];rooms:ExamRoom[];canManage:boolean;busy:boolean;onOpen:(id:string)=>void;onMarks:(id:string)=>void;onSeat:(id:string,r:string[])=>void;onSchedule:(x:any)=>void}){
 const [f,setF]=useState({courseOfferingId:"",examDate:"",startTime:"10:00",endTime:"13:00",maxMarks:"100",passMarks:"40",instructions:""});
 const [subject,setSubject]=useState<DirectoryOption|null>(null); const [roomIds,setRoomIds]=useState<string[]>([]);
 return <div className="space-y-5"><section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><div className="flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-wider text-slate-400">Examination Subjects</p><h2 className="text-2xl font-black">{selected?.name||"Open an examination"}</h2></div>{selected&&<Pill value={selected.status}/>}</div><p className="mt-2 text-sm text-slate-500">Select the subject offering by course, program, semester and section.</p>{canManage&&selected&&<form className="mt-5 grid gap-3 md:grid-cols-3" onSubmit={e=>{e.preventDefault();if(!subject) return;onSchedule({...f,courseOfferingId:subject.id});}}><EntityPicker kind="courseOffering" label="Subject / course offering" value={subject} onChange={setSubject} placeholder="Search course, code, program, semester or section" required/><Field label="Exam date" type="date" value={f.examDate} onChange={v=>setF({...f,examDate:v})} required/><Field label="Maximum marks" value={f.maxMarks} onChange={v=>setF({...f,maxMarks:v})}/><Field label="Start time" type="time" value={f.startTime} onChange={v=>setF({...f,startTime:v})}/><Field label="End time" type="time" value={f.endTime} onChange={v=>setF({...f,endTime:v})}/><Field label="Pass marks" value={f.passMarks} onChange={v=>setF({...f,passMarks:v})}/><button disabled={busy||!subject} className="rounded-xl bg-slate-950 px-4 py-2.5 text-xs font-bold text-white md:col-span-3">Schedule Examination Paper</button></form>}</section><section className="space-y-3">{(selected?.schedules??[]).map((s:ExamSchedule)=><article key={s.id} className="rounded-2xl border border-slate-200 bg-white p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-bold">{s.courseCode} · {s.courseName}</p><p className="text-xs text-slate-500">{date(s.examDate)} · {s.startTime}–{s.endTime} · {s.seatCount??0} seats · {s.markCount??0} marks</p></div><div className="flex flex-wrap gap-2"><Pill value={s.status}/><button onClick={()=>onMarks(s.id)} className="rounded-lg border px-3 py-2 text-xs font-bold">Marks</button></div></div>{canManage&&<div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]"><label className="block"><span className="mb-1 block text-xs font-bold text-slate-500">Rooms</span><select multiple value={roomIds} onChange={e=>setRoomIds(Array.from(e.target.selectedOptions).map(x=>x.value))} className="min-h-24 w-full rounded-xl border p-2 text-xs">{rooms.map(r=><option key={r.id} value={r.id}>{r.name} — {r.capacity} seats</option>)}</select></label><button disabled={busy||!roomIds.length} onClick={()=>onSeat(s.id,roomIds)} className="rounded-xl bg-slate-950 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-40">Generate Seating Plan</button></div>}</article>)}</section></div>
}

function Rooms({rooms,busy,onCreate}:{rooms:ExamRoom[];busy:boolean;onCreate:(x:any)=>void}){const [f,setF]=useState({name:"",code:"",capacity:"60"});return <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><p className="text-xs font-bold uppercase tracking-wider text-slate-400">Operations</p><h2 className="text-2xl font-black">Rooms & Seating</h2><form className="mt-5 grid gap-3 md:grid-cols-4" onSubmit={e=>{e.preventDefault();onCreate({...f,capacity:Number(f.capacity)});setF({name:"",code:"",capacity:"60"});}}><Field label="Room" value={f.name} onChange={v=>setF({...f,name:v})} placeholder="Room 201" required/><Field label="Code" value={f.code} onChange={v=>setF({...f,code:v})} placeholder="R201" required/><Field label="Capacity" value={f.capacity} onChange={v=>setF({...f,capacity:v})}/><button disabled={busy} className="rounded-xl bg-slate-950 px-3 py-2.5 text-xs font-bold text-white">Add Room</button></form><div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{rooms.map(r=><div key={r.id} className="rounded-2xl border p-4"><p className="font-bold">{r.name}</p><p className="text-xs text-slate-500">{r.code} · Capacity {r.capacity}</p><p className="mt-3 text-xs font-bold text-emerald-700">Available for allocation</p></div>)}</div></section>}

function ExamDay({schedules,incidents,onAttendance}:{schedules:any[];incidents:any[];onAttendance:(id:string)=>void}){return <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]"><section className="rounded-3xl border bg-white p-6 shadow-sm"><p className="text-xs font-bold uppercase tracking-wider text-slate-400">EXAMINATION DAY</p><h2 className="text-2xl font-black">Today’s operational board</h2><div className="mt-5 space-y-3">{schedules.slice(0,10).map(s=><div key={s.id} className="rounded-2xl border p-4"><div className="flex justify-between gap-3"><div><p className="font-bold">{s.courseCode} · {s.courseName}</p><p className="text-xs text-slate-500">{s.examName} · {s.startTime}–{s.endTime}</p></div><button onClick={()=>onAttendance(s.id)} className="rounded-lg bg-slate-950 px-3 py-2 text-xs font-bold text-white">Attendance</button></div></div>)}{!schedules.length&&<Empty text="No examinations scheduled."/>}</div></section><section className="rounded-3xl border bg-white p-6 shadow-sm"><p className="text-xs font-bold uppercase tracking-wider text-slate-400">Incidents</p><h2 className="mt-1 text-xl font-black">{incidents.length} requiring attention</h2><p className="mt-2 text-sm text-slate-500">Cheating, malpractice, medical, late-arrival, paper and room issues stay tied to the examination paper.</p></section></div>}

function AdmitCards({sessions,canManage,busy,onGenerate}:{sessions:ExamSession[];canManage:boolean;busy:boolean;onGenerate:(id:string)=>void}){return <section className="rounded-3xl border bg-white p-6 shadow-sm"><p className="text-xs font-bold uppercase tracking-wider text-slate-400">ADMIT CARDS</p><h2 className="text-2xl font-black">Generate from an examination</h2><p className="mt-2 text-sm text-slate-500">Generation uses the same server-side eligibility decision used by registration and hall-ticket issuance. If a candidate is blocked, the backend response contains the actual blocking reasons.</p><div className="mt-5 space-y-3">{sessions.map(s=><div key={s.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-4"><div><p className="font-bold">{s.name}</p><p className="text-xs text-slate-500">{s.code} · {s.status} · Admit-card state: {s.admitCardStatus||"NOT_ISSUED"}</p></div>{canManage&&<button disabled={busy} onClick={()=>onGenerate(s.id)} className="rounded-xl bg-slate-950 px-3 py-2 text-xs font-bold text-white">Generate / Re-evaluate</button>}</div>)}</div></section>}

function SimpleList({title,description,rows,empty}:{title:string;description:string;rows:Record<string,unknown>[];empty:string}){return <section className="rounded-3xl border bg-white p-6 shadow-sm"><p className="text-xs font-bold uppercase tracking-wider text-slate-400">EXAMINATION OPERATIONS</p><h2 className="mt-1 text-2xl font-black">{title}</h2><p className="mt-2 text-sm text-slate-500">{description}</p><div className="mt-6 space-y-3">{rows.map((r,i)=><pre key={i} className="overflow-auto rounded-2xl bg-slate-50 p-4 text-xs text-slate-700">{JSON.stringify(r,null,2)}</pre>)}{!rows.length&&<Empty text={empty}/>}</div></section>}

function Reports({sessions,schedules}:{sessions:ExamSession[];schedules:any[]}){return <section className="rounded-3xl border bg-white p-6 shadow-sm"><p className="text-xs font-bold uppercase tracking-wider text-slate-400">REPORTS</p><h2 className="text-2xl font-black">Examination reporting</h2><div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[["Examination schedule",schedules.length],["Examinations",sessions.length],["Scheduled papers",schedules.filter(s=>s.status==="PUBLISHED").length],["Locked results",schedules.filter(s=>s.status==="LOCKED").length]].map(([a,b])=><div key={String(a)} className="rounded-2xl border p-5"><p className="text-xs font-bold text-slate-500">{a}</p><p className="mt-2 text-3xl font-black">{b}</p></div>)}</div><p className="mt-6 text-sm text-slate-500">Detailed PDF/XLSX exports should use the same institution-scoped reporting services as the rest of ACADLYX; this workspace never fetches institution-wide students just to render the command center.</p></section>}

function Marks({marks,draft,setDraft,busy,canEnter,canApprove,onSave,onApprove,onLock,onPublish}:{marks:any;draft:Record<string,string>;setDraft:any;busy:boolean;canEnter:boolean;canApprove:boolean;onSave:(submit:boolean)=>void;onApprove:()=>void;onLock:()=>void;onPublish:()=>void}){if(!marks)return <Empty text="Open Marks from an examination paper to enter or review marks."/>;const editable=canEnter&&!["LOCKED","RESULTS_PUBLISHED"].includes(marks.schedule.status);return <section className="rounded-3xl border bg-white p-6 shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wider text-slate-400">MARKS & RESULTS</p><h2 className="text-2xl font-black">{marks.schedule.courseCode} · {marks.schedule.courseName}</h2><p className="mt-1 text-xs text-slate-500">Max {marks.schedule.maxMarks} · Pass {marks.schedule.passMarks}</p></div><div className="flex gap-2">{editable&&<><button disabled={busy} onClick={()=>onSave(false)} className="rounded-xl border px-3 py-2 text-xs font-bold">Save Draft</button><button disabled={busy} onClick={()=>onSave(true)} className="rounded-xl bg-slate-950 px-3 py-2 text-xs font-bold text-white">Submit Marks</button></>}{canApprove&&marks.schedule.status==="SUBMITTED"&&<button disabled={busy} onClick={onApprove} className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white">Approve</button>}{canApprove&&marks.schedule.status==="APPROVED"&&<button disabled={busy} onClick={onLock}>Lock</button>}{canApprove&&marks.schedule.status==="LOCKED"&&<button disabled={busy} onClick={onPublish} className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white">Publish</button>}</div></div><div className="mt-5 overflow-x-auto"><table className="w-full min-w-[700px] text-sm"><thead className="border-b text-left text-[10px] font-bold uppercase tracking-wider text-slate-400"><tr><th className="pb-3">Student</th><th>Roll</th><th>Attendance</th><th>Marks</th><th>State</th></tr></thead><tbody className="divide-y">{marks.rows.map((r:any)=><tr key={r.studentId}><td className="py-3 font-bold">{r.firstName} {r.lastName}</td><td>{r.rollNumber||"—"}</td><td>{r.examAttendance||"—"}</td><td>{editable?<input className="w-24 rounded-lg border px-2 py-1" value={draft[r.studentId]??""} onChange={e=>setDraft((x:any)=>({...x,[r.studentId]:e.target.value}))}/>:r.isAbsent?"AB":r.marksObtained??"—"}</td><td><Pill value={r.status||"DRAFT"}/></td></tr>)}</tbody></table></div><div className="mt-5 rounded-2xl bg-amber-50 p-4 text-xs text-amber-800">State machine: Draft → Submitted → Approved → Locked → Results Published. Once locked, normal mark entry is disabled.</div></section>}
