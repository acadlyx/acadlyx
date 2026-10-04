"use client";
import Link from "next/link";
import { useEffect,useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { AuthRequiredError } from "@/lib/auth";
import { getMyWork,type MyWorkSummary } from "@/lib/myWorkApi";

export default function TodayPage(){
 const router=useRouter(); const [data,setData]=useState<MyWorkSummary|null>(null); const [error,setError]=useState("");
 useEffect(()=>{void getMyWork().then(setData).catch(e=>{if(e instanceof AuthRequiredError)router.replace("/login");else setError(e instanceof Error?e.message:"Unable to load Today.");});},[router]);
 return <DashboardShell title="Today" subtitle="A live, role-aware view of what matters now"><main className="mx-auto max-w-6xl space-y-5 pb-10">{error&&<div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}<section className="rounded-3xl border bg-white p-6 shadow-sm"><p className="text-xs font-black uppercase tracking-[.18em] text-slate-400">Live priorities</p><h1 className="mt-1 text-3xl font-black">Your institution, today</h1><p className="mt-2 text-sm text-slate-500">Only actions generated from current institutional records appear here.</p><div className="mt-5 grid gap-3 sm:grid-cols-3"><div className="rounded-2xl bg-slate-50 p-4"><b>{data?.pending??0}</b><p className="text-xs text-slate-500">Pending</p></div><div className="rounded-2xl bg-emerald-50 p-4"><b>{data?.completed??0}</b><p className="text-xs text-emerald-700">Completed</p></div><div className="rounded-2xl bg-slate-50 p-4"><b>{data?.critical??0}</b><p className="text-xs text-slate-500">Critical pending</p></div></div></section><section className="grid gap-3">{data?.items.map(item=><Link key={item.id} href={item.href} className="rounded-2xl border bg-white p-5 shadow-sm hover:border-slate-400"><div className="flex items-center justify-between gap-4"><div><h2 className="font-black">{item.title}</h2><p className="mt-1 text-sm text-slate-500">{item.detail}</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black">{item.count}</span></div></Link>)}{data&&data.items.length===0?<div className="rounded-3xl border border-dashed p-10 text-center text-sm text-slate-500">Nothing urgent right now. You are caught up.</div>:null}</section></main></DashboardShell>;
}
