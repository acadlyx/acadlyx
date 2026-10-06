"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { bulkDecideRegistrations, decideRegistration, listRegistrations, Registration } from "@/lib/registrationApi";

export default function HODCourseRegistrationRequestsPage() {
  const [items,setItems]=useState<Registration[]>([]);
  const [status,setStatus]=useState<"REQUESTED"|"APPROVED"|"REJECTED"|"NEEDS_CORRECTION"|"DROPPED">("REQUESTED");
  const [search,setSearch]=useState("");
  const [selected,setSelected]=useState<string[]>([]);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");

  const load=useCallback(async()=>{try{const r=await listRegistrations({status,search:search||undefined});setItems(r.items);setSelected([]);}catch(e){setError(e instanceof Error?e.message:"Unable to load registration requests.");}},[status,search]);
  useEffect(()=>{void load();},[load]);

  const groups=useMemo(()=>{const map=new Map<string,Registration[]>();for(const item of items){const key=item.student.id+"::"+item.courseOffering.semester.id;map.set(key,[...(map.get(key)||[]),item]);}return [...map.values()];},[items]);
  async function decide(ids:string[], decision:"APPROVED"|"REJECTED"|"NEEDS_CORRECTION"){
    const remarks=decision==="APPROVED"?undefined:window.prompt(decision==="REJECTED"?"Reason for rejection":"Correction note")||undefined;
    if(decision!=="APPROVED"&&!remarks)return;
    setBusy(true);setError("");
    try{if(ids.length===1)await decideRegistration(ids[0],decision,remarks);else await bulkDecideRegistrations(ids,decision,remarks);await load();}catch(e){setError(e instanceof Error?e.message:"Unable to process registrations.");}finally{setBusy(false);}
  }
  const all=items.length>0&&selected.length===items.length;
  return <DashboardShell title="Course Registration Requests" subtitle="Department-scoped HOD review and bulk approval" allowedRoles={["HOD"]}>
    <div className="space-y-5">
      {error?<div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>:null}
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm flex flex-wrap gap-3">
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search student…" className="min-w-[240px] flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm"/>
        <select value={status} onChange={e=>setStatus(e.target.value as typeof status)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm"><option value="REQUESTED">Pending</option><option value="NEEDS_CORRECTION">Needs Correction</option><option value="APPROVED">Approved</option><option value="REJECTED">Rejected</option></select>
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
