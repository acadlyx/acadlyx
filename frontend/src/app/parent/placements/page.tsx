"use client";

import { useEffect,useState } from "react";
import { apiFetch, ApiRequestError } from "@/lib/api";
import { DashboardShell } from "@/components/dashboard/DashboardShell";

type Data={profile:{placementStatus?:string}|null;enrollment:{program?:{name?:string};department?:{name?:string}}|null;skills:unknown[];certifications:unknown[];projects:unknown[];resumes:unknown[]};

export default function ParentPlacementsPage(){
 const [data,setData]=useState<Data|null>(null);const [error,setError]=useState("");const [loading,setLoading]=useState(true);
 useEffect(()=>{void apiFetch<{data:Data}>("/placements/profile").then(r=>setData(r.data)).catch(e=>setError(e instanceof ApiRequestError?e.message:"Unable to load placement progress.")).finally(()=>setLoading(false));},[]);
 return <DashboardShell title="Student Placement Progress" subtitle="Read-only placement progress for your linked student, subject to institutional policy." allowedRoles={["PARENT"]}><div className="mx-auto max-w-5xl space-y-6">{error&&<div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}<section className="rounded-3xl border bg-white p-6"><p className="text-xs font-black uppercase tracking-[.18em] text-emerald-700">Linked student</p><h1 className="mt-2 text-2xl font-black text-slate-950">Placement journey</h1><p className="mt-2 text-sm text-slate-600">Academic identity and placement decisions remain controlled by the institution. This view does not expose recruiter-private information.</p></section><section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[["Status",data?.profile?.placementStatus||"—"],["Skills",data?.skills.length??"—"],["Projects",data?.projects.length??"—"],["Resume records",data?.resumes.length??"—"]].map(([a,b])=><article key={String(a)} className="rounded-2xl border bg-white p-5"><p className="text-xs font-bold uppercase text-slate-500">{a}</p><p className="mt-2 text-2xl font-black text-slate-950">{loading?"—":String(b)}</p></article>)}</section><section className="rounded-3xl border bg-white p-6"><h2 className="text-lg font-black text-slate-950">Professional readiness</h2><p className="mt-2 text-sm leading-6 text-slate-600">The institution may expose additional placement information according to its parent-portal policy. Recruiter contacts, private applications and internal interview feedback are not exposed here by default.</p></section></div></DashboardShell>;
}
