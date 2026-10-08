"use client";

import { useEffect,useState } from "react";
import { apiFetch,ApiRequestError } from "@/lib/api";
import { DashboardShell } from "@/components/dashboard/DashboardShell";

type Metrics=Record<string,unknown>;
type Student={id:string;firstName:string;lastName:string;email:string;placementProfile:{placementStatus:string}|null;studentEnrollments:Array<{program:{name:string;department:{name:string}};batch:{name:string}|null;semester:{name:string}|null}>; _count:{placementApplicationsOwned:number;placementOffers:number}};
type Drive={id:string;title:string;status:string;driveDate:string|null;company:{name:string}};
type Offer={id:string;status:string;role:string;totalCtc:number|null;company:{name:string}};

export default function HodPlacementsPage(){
 const[m,setM]=useState<Metrics|null>(null),[students,setStudents]=useState<Student[]>([]),[drives,setDrives]=useState<Drive[]>([]),[offers,setOffers]=useState<Offer[]>([]),[error,setError]=useState(""),[loading,setLoading]=useState(true);
 useEffect(()=>{void Promise.all([apiFetch<{data:Metrics}>("/placements/metrics"),apiFetch<{data:Student[]}>("/placements/students?pageSize=50"),apiFetch<{data:Drive[]}>("/placements/drives?pageSize=50"),apiFetch<{data:Offer[]}>("/placements/offers")]).then(([a,b,c,d])=>{setM(a.data);setStudents(b.data||[]);setDrives(c.data||[]);setOffers(d.data||[])}).catch(e=>setError(e instanceof ApiRequestError?e.message:"Unable to load department placement workspace.")).finally(()=>setLoading(false));},[]);
 return <DashboardShell title="Department Placement Workspace" subtitle="Department students, eligible drives, applications, offers and joining outcomes" allowedRoles={["HOD"]}>
 <div className="mx-auto max-w-7xl space-y-6">{error&&<div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
 <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">{[["Eligible students",m?.eligibleStudents],["Placed",m?.placedStudents],["Unplaced",m?.unplacedStudents],["Placement rate",m?.placementRate!=null?String(m.placementRate)+"%":"—"],["Active drives",m?.openDrives]].map(([a,b])=><article key={String(a)} className="rounded-2xl border bg-white p-5"><p className="text-xs font-black uppercase tracking-wide text-slate-500">{a}</p><p className="mt-2 text-2xl font-black text-slate-950">{loading?"—":String(b??0)}</p></article>)}</section>
 <section className="grid gap-6 lg:grid-cols-2"><article className="rounded-3xl border bg-white p-6"><h2 className="text-xl font-black">Department students</h2><p className="mt-1 text-sm text-slate-500">Server-scoped to departments assigned to this HOD.</p><div className="mt-4 space-y-2">{students.slice(0,12).map(s=><div key={s.id} className="flex items-center justify-between rounded-xl border p-3"><div><p className="font-black">{s.firstName} {s.lastName}</p><p className="text-xs text-slate-500">{s.studentEnrollments[0]?.program.name||"Program"} · {s.studentEnrollments[0]?.batch?.name||"Batch"}</p></div><span className="text-xs font-black">{s.placementProfile?.placementStatus||"SEEKING"}</span></div>)}{!loading&&!students.length&&<p className="py-6 text-center text-sm text-slate-500">No students in your placement scope.</p>}</div></article>
 <article className="rounded-3xl border bg-white p-6"><h2 className="text-xl font-black">Relevant drives</h2><div className="mt-4 space-y-2">{drives.slice(0,10).map(d=><div key={d.id} className="rounded-xl border p-3"><div className="flex justify-between gap-3"><div><p className="font-black">{d.title}</p><p className="text-sm text-slate-600">{d.company.name}</p></div><span className="text-xs font-black">{d.status}</span></div></div>)}{!loading&&!drives.length&&<p className="py-6 text-center text-sm text-slate-500">No drives match your department scope.</p>}</div></article></section>
 <section className="rounded-3xl border bg-white p-6"><h2 className="text-xl font-black">Offers and joining</h2><div className="mt-4 grid gap-3 md:grid-cols-3">{offers.slice(0,12).map(o=><div key={o.id} className="rounded-xl border p-3"><p className="font-black">{o.company.name}</p><p className="text-sm text-slate-600">{o.role}</p><p className="mt-1 text-xs font-black">{o.status}{o.totalCtc!=null?" · "+Number(o.totalCtc).toLocaleString("en-IN")+" "+ "INR":""}</p></div>)}</div></section>
 </div></DashboardShell>;
}
