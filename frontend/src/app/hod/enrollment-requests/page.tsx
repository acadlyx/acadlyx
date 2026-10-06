"use client";

import { useCallback, useEffect, useState } from "react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { authedFetch } from "@/lib/auth";
import { bulkDecideEnrollmentRequests, decideEnrollmentRequest, listEnrollmentRequests, EnrollmentRequest } from "@/lib/enrollmentRequestApi";

export default function HODEnrollmentRequestsPage() {
  const [items,setItems]=useState<EnrollmentRequest[]>([]);
  const [status,setStatus]=useState("PENDING");
  const [search,setSearch]=useState("");
  const [programId,setProgramId]=useState("");
  const [academicYearId,setAcademicYearId]=useState("");
  const [semesterId,setSemesterId]=useState("");
  const [sectionId,setSectionId]=useState("");
  const [programs,setPrograms]=useState<Array<{id:string;name:string;code:string}>>([]);
  const [years,setYears]=useState<Array<{id:string;name:string}>>([]);
  const [semesters,setSemesters]=useState<Array<{id:string;name:string}>>([]);
  const [sections,setSections]=useState<Array<{id:string;name:string}>>([]);
  const [selected,setSelected]=useState<string[]>([]);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [result,setResult]=useState<{processed:number;skipped:number}|null>(null);

  const load=useCallback(async()=>{try{const r=await listEnrollmentRequests({status:status as any,search:search||undefined,programId:programId||undefined,academicYearId:academicYearId||undefined,semesterId:semesterId||undefined,sectionId:sectionId||undefined});setItems(r.items);setSelected([]);}catch(e){setError(e instanceof Error?e.message:"Unable to load enrollment requests.");}},[status,search,programId,academicYearId,semesterId,sectionId]);
  useEffect(()=>{void load();},[load]);\n  useEffect(()=>{ Promise.all([authedFetch<any>("/programs?pageSize=100"),authedFetch<any>("/academic-years?pageSize=100"),authedFetch<any>("/semesters?pageSize=100"),authedFetch<any>("/sections?pageSize=100")]).then(([p,y,m,se])=>{setPrograms(p.data??[]);setYears(y.data??[]);setSemesters(m.data??[]);setSections(se.data??[]);}).catch(()=>{}); },[]);

  async function decide(ids:string[], decision:"APPROVED"|"REJECTED"|"NEEDS_CORRECTION"){
    const reason=decision==="APPROVED"?undefined:window.prompt(decision==="REJECTED"?"Reason for rejection":"Correction note")||undefined;
    if(decision!=="APPROVED"&&!reason)return;
    setBusy(true);setError("");setResult(null);
    try{if(ids.length===1)await decideEnrollmentRequest(ids[0],decision,reason);else {const r=await bulkDecideEnrollmentRequests(ids,decision,reason);setResult({processed:r.processed,skipped:r.skipped});}await load();}catch(e){setError(e instanceof Error?e.message:"Unable to process requests.");}finally{setBusy(false);}
  }
  const all=items.length>0&&selected.length===items.length;
  return <DashboardShell title="Enrollment Requests" subtitle="Department-scoped HOD approval queue" allowedRoles={["HOD"]}>
    <div className="space-y-5">
      {error?<div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>:null}{result?<div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">Processed: {result.processed} · Skipped: {result.skipped}</div>:null}
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap gap-3">
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search student…" className="min-w-[240px] flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm"/><select value={programId} onChange={e=>setProgramId(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm"><option value="">Program</option>{programs.map(x=><option key={x.id} value={x.id}>{x.code} — {x.name}</option>)}</select><select value={academicYearId} onChange={e=>setAcademicYearId(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm"><option value="">Academic Year</option>{years.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select><select value={semesterId} onChange={e=>setSemesterId(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm"><option value="">Semester</option>{semesters.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select><select value={sectionId} onChange={e=>setSectionId(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm"><option value="">Section</option>{sections.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select>
          <select value={status} onChange={e=>setStatus(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
            <option value="PENDING">Pending</option><option value="NEEDS_CORRECTION">Needs Correction</option><option value="APPROVED">Approved</option><option value="REJECTED">Rejected</option>
          </select>
        </div>
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
          {items.length===0?<p className="p-8 text-center text-sm text-slate-500">No requests in your authorized department scope.</p>:items.map(r=><label key={r.id} className="flex cursor-pointer items-center gap-4 p-4 hover:bg-slate-50">
            <input type="checkbox" checked={selected.includes(r.id)} onChange={()=>setSelected(v=>v.includes(r.id)?v.filter(x=>x!==r.id):[...v,r.id])}/>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-slate-950">{r.student?.firstName} {r.student?.lastName}</p>
              <p className="text-xs text-slate-500">{r.program.name} · {r.academicYear.name} · {r.semester.name} · {r.section?.name??"No section"}</p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold">{r.status.replaceAll("_"," ")}</span>
          </label>)}
        </div>
      </section>
    </div>
  </DashboardShell>;
}
