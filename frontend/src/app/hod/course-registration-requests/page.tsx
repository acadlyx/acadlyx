"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { authedFetch } from "@/lib/auth";
import { bulkDecideRegistrations, decideRegistration, listRegistrations, listWithdrawalRequests, decideWithdrawalRequest, Registration, CourseWithdrawalRequest } from "@/lib/registrationApi";

export default function HODCourseRegistrationRequestsPage() {
  const [items,setItems]=useState<Registration[]>([]);
  const [withdrawals,setWithdrawals]=useState<CourseWithdrawalRequest[]>([]);
  const [status,setStatus]=useState<"REQUESTED"|"APPROVED"|"REJECTED"|"NEEDS_CORRECTION"|"DROPPED">("REQUESTED");
  const [search,setSearch]=useState("");
  const [programId,setProgramId]=useState(""); const [academicYearId,setAcademicYearId]=useState(""); const [semesterId,setSemesterId]=useState(""); const [sectionId,setSectionId]=useState(""); const [courseId,setCourseId]=useState(""); const [facultyId,setFacultyId]=useState(""); const [courseType,setCourseType]=useState("");
  const [programs,setPrograms]=useState<any[]>([]); const [years,setYears]=useState<any[]>([]); const [semesters,setSemesters]=useState<any[]>([]); const [sections,setSections]=useState<any[]>([]); const [courses,setCourses]=useState<any[]>([]); const [faculty,setFaculty]=useState<any[]>([]);
  const [selected,setSelected]=useState<string[]>([]);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [result,setResult]=useState<{processed:number;skipped:number}|null>(null);

  const load=useCallback(async()=>{try{const [r,w]=await Promise.all([listRegistrations({status,search:search||undefined,programId:programId||undefined,academicYearId:academicYearId||undefined,semesterId:semesterId||undefined,sectionId:sectionId||undefined,courseId:courseId||undefined,facultyId:facultyId||undefined,courseType:courseType as any}),listWithdrawalRequests()]);setItems(r.items);setWithdrawals(w);setSelected([]);}catch(e){setError(e instanceof Error?e.message:"Unable to load registration requests.");}},[status,search,programId,academicYearId,semesterId,sectionId,courseId,facultyId,courseType]);
  useEffect(()=>{void load();},[load]);
  useEffect(()=>{ Promise.all([authedFetch<any>("/programs?pageSize=100"),authedFetch<any>("/academic-years?pageSize=100"),authedFetch<any>("/semesters?pageSize=100"),authedFetch<any>("/sections?pageSize=100"),authedFetch<any>("/courses?pageSize=100"),authedFetch<any>("/faculty?pageSize=100")]).then(([p,y,m,se,c,f])=>{setPrograms(p.data??[]);setYears(y.data??[]);setSemesters(m.data??[]);setSections(se.data??[]);setCourses(c.data??[]);setFaculty(f.data??[]);}).catch(()=>{}); },[]);

  const groups=useMemo(()=>{const map=new Map<string,Registration[]>();for(const item of items){const key=item.student.id+"::"+item.courseOffering.semester.id;map.set(key,[...(map.get(key)||[]),item]);}return [...map.values()];},[items]);
  async function decide(ids:string[], decision:"APPROVED"|"REJECTED"|"NEEDS_CORRECTION"){
    const remarks=decision==="APPROVED"?undefined:window.prompt(decision==="REJECTED"?"Reason for rejection":"Correction note")||undefined;
    if(decision!=="APPROVED"&&!remarks)return;
    setBusy(true);setError("");setResult(null);
    try{if(ids.length===1)await decideRegistration(ids[0],decision,remarks);else {const r=await bulkDecideRegistrations(ids,decision,remarks);setResult({processed:r.processed,skipped:r.skipped});}await load();}catch(e){setError(e instanceof Error?e.message:"Unable to process registrations.");}finally{setBusy(false);}
  }
  async function decideWithdrawal(id:string, decision:"APPROVED"|"REJECTED"){
    const decisionNote=decision==="REJECTED"?(window.prompt("Reason for rejecting this withdrawal request (required)")||"").trim():undefined;
    if(decision==="REJECTED"&&!decisionNote)return;
    if(!window.confirm(decision==="APPROVED"?"Approve this course withdrawal? The course will be removed from the active registration roster.":"Reject this course withdrawal request?"))return;
    setBusy(true);setError("");
    try{await decideWithdrawalRequest(id,decision,decisionNote);await load();}
    catch(e){setError(e instanceof Error?e.message:"Unable to process withdrawal request.");}
    finally{setBusy(false);}
  }
  const all=items.length>0&&selected.length===items.length;
  return <DashboardShell title="Course Registration Requests" subtitle="Department-scoped HOD review and bulk approval" allowedRoles={["HOD"]}>
    <div className="space-y-5">
      {error?<div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>:null}{result?<div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">Processed: {result.processed} · Skipped: {result.skipped}</div>:null}
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm flex flex-wrap gap-3">
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search student…" className="min-w-[240px] flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm"/><select value={programId} onChange={e=>setProgramId(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm"><option value="">Program</option>{programs.map(x=><option key={x.id} value={x.id}>{x.code} — {x.name}</option>)}</select><select value={academicYearId} onChange={e=>setAcademicYearId(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm"><option value="">Academic Year</option>{years.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select><select value={semesterId} onChange={e=>setSemesterId(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm"><option value="">Semester</option>{semesters.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select><select value={sectionId} onChange={e=>setSectionId(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm"><option value="">Section</option>{sections.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select><select value={courseId} onChange={e=>setCourseId(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm"><option value="">Course</option>{courses.map(x=><option key={x.id} value={x.id}>{x.code} — {x.name}</option>)}</select><select value={facultyId} onChange={e=>setFacultyId(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm"><option value="">Faculty</option>{faculty.map(x=><option key={x.id||x.userId} value={x.id||x.userId}>{x.firstName} {x.lastName}</option>)}</select><select value={courseType} onChange={e=>setCourseType(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm"><option value="">Course Type</option><option value="core">Core</option><option value="elective">Elective</option></select>
        <select value={status} onChange={e=>setStatus(e.target.value as typeof status)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm"><option value="REQUESTED">Pending</option><option value="NEEDS_CORRECTION">Needs Correction</option><option value="APPROVED">Approved</option><option value="REJECTED">Rejected</option></select>
      </section>
      <section className="overflow-hidden rounded-3xl border border-amber-200 bg-white shadow-sm">
        <div className="border-b border-amber-100 p-4">
          <h2 className="font-bold">Course withdrawal requests</h2>
          <p className="mt-1 text-xs text-slate-500">Approved-course withdrawals awaiting academic review in your department scope.</p>
        </div>
        {withdrawals.length===0?<p className="p-6 text-sm text-slate-500">No pending withdrawal requests.</p>:<div className="divide-y divide-slate-100">
          {withdrawals.map((request)=><div key={request.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="min-w-0"><p className="font-semibold">{request.student.firstName} {request.student.lastName} · {request.registration.courseOffering.course.code}</p><p className="text-sm text-slate-600">{request.registration.courseOffering.course.name}</p><p className="mt-1 text-xs text-slate-500">Requested {new Date(request.requestedAt).toLocaleString("en-IN")}</p><p className="mt-2 text-sm">{request.reason}</p></div>
            <div className="flex gap-2"><button type="button" disabled={busy} onClick={()=>void decideWithdrawal(request.id,"APPROVED")} className="rounded-xl bg-slate-950 px-3 py-2 text-xs font-bold text-white disabled:opacity-40">Approve withdrawal</button><button type="button" disabled={busy} onClick={()=>void decideWithdrawal(request.id,"REJECTED")} className="rounded-xl border border-red-200 px-3 py-2 text-xs font-bold text-red-700 disabled:opacity-40">Reject</button></div>
          </div>)}
        </div>}
      </section>
      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4">
          <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={all} onChange={()=>setSelected(all?[]:items.map(x=>x.id))}/> Select All</label>
          <div className="flex gap-2">
            <button disabled={!selected.length||busy} onClick={()=>void decide(selected,"APPROVED")} className="rounded-xl bg-slate-950 px-3 py-2 text-xs font-bold text-white disabled:opacity-40">Approve Selected</button>
            <button disabled={!selected.length||busy} onClick={()=>void decide(selected,"REJECTED")} className="rounded-xl border border-red-200 px-3 py-2 text-xs font-bold text-red-700 disabled:opacity-40">Reject Selected</button>
            <button disabled={!selected.length||busy} onClick={()=>void decide(selected,"NEEDS_CORRECTION")} className="rounded-xl border border-amber-200 px-3 py-2 text-xs font-bold text-amber-700 disabled:opacity-40">Needs Correction</button>
          </div>
        </div>
        <div className="divide-y divide-slate-100">
          {groups.length===0?<p className="p-8 text-center text-sm text-slate-500">No course registration requests in your authorized department scope.</p>:groups.map(group=>{
            const first=group[0];
            return <div key={first.student.id+"-"+first.courseOffering.semester.id} className="p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div><p className="font-bold">{first.student.firstName} {first.student.lastName}</p><p className="text-xs text-slate-500">{first.courseOffering.semester.name} · Section {first.courseOffering.section.name}</p></div>
                <span className="text-xs font-bold text-slate-500">{group.reduce((n,x)=>n+x.courseOffering.course.credits,0)} credits · {group.length} course(s)</span>
              </div>
              <div className="mt-3 space-y-2">{group.map(r=><label key={r.id} className="flex items-center gap-3 rounded-xl bg-slate-50 p-3"><input type="checkbox" checked={selected.includes(r.id)} onChange={()=>setSelected(v=>v.includes(r.id)?v.filter(x=>x!==r.id):[...v,r.id])}/><span className="flex-1 text-sm font-semibold">{r.courseOffering.course.code} — {r.courseOffering.course.name}</span><span className="text-xs text-slate-500">{r.status.replaceAll("_"," ")}</span></label>)}</div>
            </div>;
          })}
        </div>
      </section>
    </div>
  </DashboardShell>;
}
