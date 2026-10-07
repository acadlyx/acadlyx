"use client";

import { useEffect, useState } from "react";
import { apiFetch, ApiRequestError } from "@/lib/api";
import { DashboardShell } from "@/components/dashboard/DashboardShell";

type Drive={id:string;title:string;status:string;applicationDeadline:string|null;company:{id:string;name:string;logoUrl:string|null}};
type Application={id:string;status:string;appliedAt:string;opportunity:{title:string;organization:string;deadline:string|null}};
type Profile={profile:{placementStatus:string;bio:string|null;portfolioUrl:string|null;githubUrl:string|null;linkedInUrl:string|null}|null;skills:unknown[];certifications:unknown[];projects:unknown[];resumes:unknown[]};

export default function StudentPlacementsPage(){
  const [profile,setProfile]=useState<Profile|null>(null);
  const [drives,setDrives]=useState<Drive[]>([]);
  const [applications,setApplications]=useState<Application[]>([]);
  const [error,setError]=useState("");
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState<string|null>(null);

  async function load(){
    setLoading(true);setError("");
    try{
      const [p,d,a]=await Promise.all([
        apiFetch<{data:Profile}>("/placements/profile"),
        apiFetch<{data:Drive[]}>("/placements/drives"),
        apiFetch<{data:Application[]}>("/placements/applications"),
      ]);
      setProfile(p.data);setDrives(d.data||[]);setApplications(a.data||[]);
    }catch(e){setError(e instanceof ApiRequestError?e.message:"Unable to load your placement workspace.");}
    finally{setLoading(false);}
  }
  useEffect(()=>{void load();},[]);

  async function apply(id:string){
    setBusy(id);setError("");
    try{await apiFetch("/placements/drives/"+id+"/apply",{method:"POST"});await load();}
    catch(e){setError(e instanceof ApiRequestError?e.message:"Unable to apply to this drive.");}
    finally{setBusy(null);}
  }

  return <DashboardShell title="My Placement" subtitle="Your placement profile, eligible drives, applications, interviews and offers." allowedRoles={["STUDENT"]}>
    <div className="mx-auto max-w-7xl space-y-6">
      {error&&<div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div>}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[["Placement status",profile?.profile?.placementStatus||"SEEKING"],["Skills",profile?.skills.length??0],["Projects",profile?.projects.length??0],["Current resumes",profile?.resumes.length??0]].map(([a,b])=><article key={String(a)} className="rounded-2xl border bg-white p-5"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">{a}</p><p className="mt-2 text-2xl font-black text-slate-950">{loading?"—":String(b)}</p></article>)}
      </section>
      <section className="rounded-3xl border bg-white p-6">
        <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[.18em] text-emerald-700">Career profile</p><h2 className="mt-1 text-2xl font-black text-slate-950">Be application-ready</h2></div><button onClick={()=>void load()} disabled={loading} className="rounded-xl border px-4 py-2 text-sm font-bold">Refresh</button></div>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">Maintain your skills, certifications, projects, resume and approved professional links. Academic enrollment and eligibility are authoritative institutional records and cannot be self-edited here.</p>
        <div className="mt-5 flex flex-wrap gap-2">{[["Skills",profile?.skills.length],["Certifications",profile?.certifications.length],["Projects",profile?.projects.length],["Resumes",profile?.resumes.length]].map(([a,b])=><span key={String(a)} className="rounded-full bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700">{a}: {String(b??0)}</span>)}</div>
      </section>
      <section className="rounded-3xl border bg-white p-6">
        <div className="flex items-center justify-between"><h2 className="text-xl font-black text-slate-950">Eligible placement drives</h2><span className="text-xs font-bold text-slate-500">{drives.length} visible</span></div>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {drives.map(d=><article key={d.id} className="rounded-2xl border p-5"><div className="flex justify-between gap-4"><div><p className="text-lg font-black text-slate-950">{d.title}</p><p className="text-sm font-semibold text-slate-600">{d.company.name}</p></div><span className="h-fit rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-black text-emerald-700">{d.status}</span></div>{d.applicationDeadline&&<p className="mt-3 text-xs text-slate-500">Apply by {new Date(d.applicationDeadline).toLocaleString("en-IN")}</p>}<button onClick={()=>void apply(d.id)} disabled={busy===d.id||d.status!=="APPLICATION_OPEN"} className="mt-4 min-h-11 w-full rounded-xl bg-slate-950 px-4 py-2 text-sm font-black text-white disabled:opacity-40">{busy===d.id?"Applying…":d.status==="APPLICATION_OPEN"?"Apply to drive":"Applications unavailable"}</button></article>)}
          {!loading&&!drives.length&&<p className="py-8 text-center text-sm text-slate-500 lg:col-span-2">No published placement drives are currently available.</p>}
        </div>
      </section>
      <section className="rounded-3xl border bg-white p-6"><h2 className="text-xl font-black text-slate-950">My applications</h2><div className="mt-4 space-y-3">{applications.map(a=><div key={a.id} className="flex flex-col gap-2 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-black text-slate-950">{a.opportunity.title}</p><p className="text-sm text-slate-600">{a.opportunity.organization}</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black">{a.status}</span></div>)}{!loading&&!applications.length&&<p className="py-8 text-center text-sm text-slate-500">You have not submitted a placement application yet.</p>}</div></section>
    </div>
  </DashboardShell>;
}
