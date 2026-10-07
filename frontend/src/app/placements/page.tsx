"use client";

import Link from "next/link";
import { useEffect,useState } from "react";
import { apiFetch,ApiRequestError } from "@/lib/api";
import { DashboardShell } from "@/components/dashboard/DashboardShell";

type Metrics=Record<string,unknown>;
type Company={id:string;name:string;industry:string|null;relationshipStatus:string};
type Drive={id:string;title:string;status:string;driveDate:string|null;company:{id:string;name:string}};
type Application={id:string;status:string;student:{id:string;firstName:string;lastName:string};opportunity:{title:string;organization:string}};

export default function PlacementTeamWorkspace(){
 const [m,setM]=useState<Metrics|null>(null);const [companies,setCompanies]=useState<Company[]>([]);const [drives,setDrives]=useState<Drive[]>([]);const [apps,setApps]=useState<Application[]>([]);const [error,setError]=useState("");const [loading,setLoading]=useState(true);
 async function load(){setLoading(true);setError("");try{const [metrics,cs,ds,as]=await Promise.all([apiFetch<{data:Metrics}>("/placements/metrics"),apiFetch<{data:Company[]}>("/placements/companies"),apiFetch<{data:Drive[]}>("/placements/drives"),apiFetch<{data:Application[]}>("/placements/applications")]);setM(metrics.data);setCompanies(cs.data||[]);setDrives(ds.data||[]);setApps(as.data||[]);}catch(e){setError(e instanceof ApiRequestError?e.message:"Unable to load placement operations.");}finally{setLoading(false);}}
 useEffect(()=>{void load();},[]);
 const cards=[["Companies",m?.companies],["Active drives",m?.openDrives],["Applications",m?.applications],["Offers",m?.offers],["Joined",m?.joinedOffers],["Average package",m?("INR "+Number(m.averagePackage||0).toLocaleString("en-IN")):"—"],["Highest package",m?("INR "+Number(m.highestPackage||0).toLocaleString("en-IN")):"—"],["Joining rate",m?String(m.joiningRate)+"%":"—"]];
 return <DashboardShell title="Placement Command Center" subtitle="Operational placement control across employers, drives, applications, interviews, offers and joining verification." allowedRoles={["PLACEMENT"]}>
  <div className="mx-auto max-w-7xl space-y-6">
   {error&&<div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div>}
   <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{cards.map(([a,b])=><article key={String(a)} className="rounded-2xl border bg-white p-5 shadow-sm"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">{a}</p><p className="mt-2 text-2xl font-black text-slate-950">{loading?"—":String(b??0)}</p></article>)}</section>
   <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">{[
    ["/placements/companies","Company Master","Employers, recruiters, relationship history and contacts"],
    ["/placements/drives","Placement Drives","Lifecycle, eligibility, deadlines and vacancies"],
    ["/placements/openings","Job Openings","Roles, packages, eligibility and application deadlines"],
    ["/placements/visits","Company Visits","Campus visits, recruiter meetings and pre-placement talks"],
    ["/placements/students","Placement Students","Readiness, eligibility and placement status for authorized students"],
    ["/placements/interviews","Interviews","Rounds, schedules, attendance and outcomes"],
    ["/placements/offers","Offers & Joining","Offer acceptance, joining dates and verification"],
    ["/placements/reports","Placement Intelligence","Packages, joining, hiring and institutional trends"],
   ].map(([href,title,desc])=><Link key={href} href={href} className="rounded-2xl border bg-white p-5 transition hover:-translate-y-0.5"><h2 className="font-black text-slate-950">{title}</h2><p className="mt-2 text-sm leading-6 text-slate-600">{desc}</p></Link>)}</section>
   <section className="grid gap-6 lg:grid-cols-2">
    <article className="rounded-3xl border bg-white p-6"><div className="flex items-center justify-between"><h2 className="text-lg font-black">Upcoming / active drives</h2><span className="text-xs font-bold text-slate-500">{drives.length}</span></div><div className="mt-4 space-y-3">{drives.slice(0,8).map(d=><div key={d.id} className="rounded-xl border p-4"><div className="flex justify-between gap-3"><div><p className="font-black">{d.title}</p><p className="text-sm text-slate-600">{d.company.name}</p></div><span className="text-xs font-black">{d.status}</span></div></div>)}</div></article>
    <article className="rounded-3xl border bg-white p-6"><div className="flex items-center justify-between"><h2 className="text-lg font-black">Application pipeline</h2><span className="text-xs font-bold text-slate-500">{apps.length}</span></div><div className="mt-4 space-y-3">{apps.slice(0,8).map(a=><div key={a.id} className="rounded-xl border p-4"><div className="flex justify-between gap-3"><div><p className="font-black">{a.student.firstName} {a.student.lastName}</p><p className="text-sm text-slate-600">{a.opportunity.title} · {a.opportunity.organization}</p></div><span className="text-xs font-black">{a.status}</span></div></div>)}</div></article>
   </section>
   <button onClick={()=>void load()} disabled={loading} className="rounded-xl border bg-white px-4 py-2 text-sm font-bold">Refresh operational data</button>
  </div>
 </DashboardShell>;
}
