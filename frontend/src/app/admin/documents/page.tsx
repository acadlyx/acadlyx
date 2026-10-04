"use client";

import { useCallback, useEffect, useState } from "react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { AuthRequiredError, authedFetch } from "@/lib/auth";
import { useRouter } from "next/navigation";

type Student= {id:string;firstName:string;lastName:string;email:string};
type Doc=Record<string,unknown>;

export default function AdminDocumentsPage(){
 const router=useRouter(); const [students,setStudents]=useState<Student[]>([]); const [studentId,setStudentId]=useState(""); const [docs,setDocs]=useState<Doc[]>([]); const [loading,setLoading]=useState(true); const [error,setError]=useState("");
 const loadStudents=useCallback(async()=>{try{const r=await authedFetch<{data:Student[]|{items:Student[]}}>( "/users?role=STUDENT&page=1&pageSize=500");const d=r.data;setStudents(Array.isArray(d)?d:d.items??[]);}catch(e){if(e instanceof AuthRequiredError){router.replace("/login");return;}setError(e instanceof Error?e.message:"Unable to load students.");}finally{setLoading(false);}},[router]);
 const loadDocs=useCallback(async(id:string)=>{if(!id){setDocs([]);return;}setLoading(true);try{const r=await authedFetch<{data:Doc[]}>(`/portal/documents/students/${id}`);setDocs(Array.isArray(r.data)?r.data:[]);}catch(e){if(e instanceof AuthRequiredError){router.replace("/login");return;}setError(e instanceof Error?e.message:"Unable to load documents.");}finally{setLoading(false);}},[router]);
 useEffect(()=>{void loadStudents();},[loadStudents]); useEffect(()=>{void loadDocs(studentId);},[loadDocs,studentId]);
 return <DashboardShell title="Documents" subtitle="Student document records from the live portal data source" allowedRoles={["INSTITUTION_ADMIN"]}><main className="mx-auto max-w-6xl space-y-5 p-4 sm:p-6 lg:p-8"><section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600">Live data pipeline</p><h1 className="mt-1 text-2xl font-black">Student documents</h1><select value={studentId} onChange={e=>setStudentId(e.target.value)} className="mt-4 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"><option value="">Select a student</option>{students.map(s=><option key={s.id} value={s.id}>{s.firstName} {s.lastName} — {s.email}</option>)}</select></section>{error?<div className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</div>:null}<section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">{loading?<p className="text-sm text-slate-500">Loading…</p>:!studentId?<p className="text-sm text-slate-500">Select a student to view their documents.</p>:docs.length===0?<p className="text-sm text-slate-500">No documents for this student.</p>:<div className="space-y-2">{docs.map((d,i)=><div key={String(d.id??i)} className="rounded-xl border border-slate-200 p-4"><p className="font-bold">{String(d.title??d.name??"Document")}</p><p className="mt-1 text-xs text-slate-500">{String(d.type??"")}</p></div>)}</div>}</section></main></DashboardShell>;
}
