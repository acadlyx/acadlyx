"use client";

import { useEffect,useState } from "react";
import { apiFetch,ApiRequestError } from "@/lib/api";
import { PlacementTeamShell } from "@/components/placement/PlacementTeamShell";

type Test={id:string;title:string;mode:string;scheduledAt:string;status:string;drive:{title:string;company:{name:string}}};

export default function PlacementTestsPage(){
 const[data,setData]=useState<Test[]>([]);const[error,setError]=useState("");const[loading,setLoading]=useState(true);
 useEffect(()=>{void apiFetch<{data:Test[]}>("/placements/tests").then(r=>setData(r.data||[])).catch(e=>setError(e instanceof ApiRequestError?e.message:"Unable to load placement tests.")).finally(()=>setLoading(false));},[]);
 return <PlacementTeamShell><div className="mx-auto max-w-7xl space-y-6">{error&&<div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}<section className="rounded-3xl border bg-white p-6"><p className="text-xs font-black uppercase tracking-[.18em] text-emerald-700">Placement operations</p><h1 className="mt-2 text-3xl font-black">Tests & Assessments</h1><p className="mt-2 text-sm text-slate-600">Schedule company tests, track attendance/results and keep assessments linked to the placement drive lifecycle.</p></section><section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{data.map(t=><article key={t.id} className="rounded-2xl border bg-white p-5"><div className="flex justify-between gap-3"><h2 className="font-black">{t.title}</h2><span className="text-xs font-black">{t.status}</span></div><p className="mt-2 text-sm text-slate-600">{t.drive.company.name} · {t.drive.title}</p><p className="mt-2 text-xs text-slate-500">{new Date(t.scheduledAt).toLocaleString("en-IN")} · {t.mode}</p></article>)}{!loading&&!data.length&&<p className="py-12 text-center text-sm text-slate-500 md:col-span-2 lg:col-span-3">No placement tests have been scheduled.</p>}</section></div></PlacementTeamShell>;
}
