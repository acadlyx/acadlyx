"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardShell } from "./DashboardShell";
import { authedFetch, AuthRequiredError } from "@/lib/auth";

type Data={stats:Record<string,number>};
export function ChairmanDashboard(){
 const router=useRouter(); const [data,setData]=useState<Data|null>(null); const [error,setError]=useState("");
 useEffect(()=>{authedFetch<{success:true;data:Data}>("/erp/me/workspace").then(r=>setData(r.data)).catch(e=>{if(e instanceof AuthRequiredError) router.replace("/login"); else setError(e instanceof Error?e.message:"Unable to load executive intelligence.")});},[router]);
 const s=data?.stats??{};
 return <DashboardShell title="Chairman Command Center" subtitle="Executive oversight, institutional intelligence and strategic decisions" allowedRoles={["CHAIRMAN"]}>
  <main className="mx-auto w-full max-w-7xl space-y-6">
   <section className="rounded-3xl bg-slate-950 p-7 text-white"><p className="text-xs font-bold uppercase tracking-[.2em] text-emerald-300">Executive oversight</p><h1 className="mt-2 text-3xl font-black">Institutional Command Center</h1><p className="mt-2 max-w-3xl text-sm text-slate-300">Strategic visibility without entering operational specialist workflows.</p></section>
   {error&&<div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
   <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{[["Students","students"],["Faculty","faculty"],["Departments","departments"],["Invoiced","totalInvoiced"],["Paid invoices","paidInvoices"],["Exam results","examResults"]].map(([l,k])=><article key={k} className="rounded-2xl border bg-white p-5"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">{l}</p><p className="mt-2 text-3xl font-black">{k==="totalInvoiced"?`₹${(s[k]??0).toLocaleString("en-IN")}`:(s[k]??0).toLocaleString("en-IN")}</p></article>)}</section>
   <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">{[["Institution intelligence","/intelligence"],["Strategic reports","/reports"],["Financial overview","/fees"],["Academic performance","/examination"]].map(([l,h])=><button key={h} onClick={()=>router.push(h)} className="rounded-2xl border bg-white p-5 text-left font-bold hover:shadow-md">{l}<span className="mt-2 block text-xs font-normal text-slate-500">Open executive view →</span></button>)}</section>
  </main>
 </DashboardShell>;
}
