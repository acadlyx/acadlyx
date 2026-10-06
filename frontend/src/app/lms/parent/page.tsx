"use client";
import { useEffect,useState } from "react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { AuthRequiredError,authedFetch } from "@/lib/auth";
import { useRouter } from "next/navigation";

export default function ParentLmsPage(){
 const router=useRouter(); const [students,setStudents]=useState<any[]>([]); const [selected,setSelected]=useState<any>(null); const [data,setData]=useState<any>(null); const [error,setError]=useState("");
 useEffect(()=>{void (async()=>{try{const r=await authedFetch<{data:any[]}>("/lms/parent/students");setStudents(r.data)}catch(e){if(e instanceof AuthRequiredError)router.replace("/login");else setError(e instanceof Error?e.message:"Unable to load linked students")}})()},[router]);
 async function select(s:any){setSelected(s);setError("");try{const r=await authedFetch<{data:any}>(`/lms/parent/students/${s.id}`);setData(r.data)}catch(e){setError(e instanceof Error?e.message:"Unable to load student LMS overview")}}
 return <DashboardShell title="Parent Learning Overview" subtitle="Read-only LMS progress for students explicitly linked to your parent account."><div className="mx-auto max-w-6xl space-y-5">{error&&<div role="alert" className="rounded-xl bg-red-50 p-4 text-red-700">{error}</div>}<section className="grid gap-3 md:grid-cols-3">{students.map(s=><button key={s.id} onClick={()=>void select(s)} className={`rounded-2xl border bg-white p-5 text-left ${selected?.id===s.id?"ring-2 ring-slate-950":""}`}><p className="font-black">{s.firstName} {s.lastName}</p><p className="text-xs text-slate-500">{s.relationship||"Linked student"}</p></button>)}</section>{selected&&<section className="rounded-2xl border bg-white p-6"><h2 className="font-black">{selected.firstName} {selected.lastName}</h2><div className="mt-4 grid gap-3 md:grid-cols-2">{(data?.offerings||[]).map((o:any)=><article key={o.courseOfferingId} className="rounded-xl bg-slate-50 p-4"><p className="font-bold">Course offering</p><p className="mt-2 text-sm text-slate-600">Roster: {o.analytics?.rosterSize??0} · Lessons: {o.analytics?.content?.lessons??0} · Completed: {o.analytics?.progress?.completed??0}</p></article>)}</div></section>}</div></DashboardShell>
}
