"use client";

import { useCallback, useEffect, useState } from "react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { AuthRequiredError, authedFetch } from "@/lib/auth";
import { useRouter } from "next/navigation";

type LinkRow = Record<string, unknown>;

export default function AdminParentLinksPage() {
  const router = useRouter();
  const [items,setItems]=useState<LinkRow[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");

  const load=useCallback(async()=>{
    setLoading(true); setError("");
    try{
      const res=await authedFetch<{data:LinkRow[]}>("/erp/parent-links?page=1&pageSize=500");
      setItems(Array.isArray(res.data)?res.data:[]);
    }catch(e){
      if(e instanceof AuthRequiredError){router.replace("/login");return;}
      setError(e instanceof Error?e.message:"Unable to load parent links.");
    }finally{setLoading(false);}
  },[router]);

  useEffect(()=>{void load();},[load]);

  return <DashboardShell title="Parent Links" subtitle="Live institution parent-to-student relationships" allowedRoles={["INSTITUTION_ADMIN"]}>
    <main className="mx-auto max-w-7xl space-y-5 p-4 sm:p-6 lg:p-8">
      <section className="flex items-center justify-between rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div><p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600">Live data pipeline</p><h1 className="mt-1 text-2xl font-black">Parent links</h1><p className="mt-1 text-sm text-slate-500">{loading?"Loading…":items.length+" linked relationships"}</p></div>
        <button type="button" onClick={()=>void load()} disabled={loading} className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">Refresh</button>
      </section>
      {error?<div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>:null}
      <section className="overflow-x-auto rounded-3xl border border-slate-200 bg-white shadow-sm">
        {loading?<div className="p-10 text-center text-sm text-slate-500">Loading live relationships…</div>:items.length===0?<div className="p-10 text-center text-sm text-slate-500">No parent links configured.</div>:
        <table className="min-w-full text-left text-sm"><thead className="bg-slate-50"><tr><th className="px-4 py-3 font-black">Parent</th><th className="px-4 py-3 font-black">Student</th><th className="px-4 py-3 font-black">Relationship</th></tr></thead>
        <tbody className="divide-y divide-slate-100">{items.map((item,i)=>{const parent=item.parent as Record<string,unknown>|undefined;const student=item.student as Record<string,unknown>|undefined;return <tr key={String(item.id??i)}><td className="px-4 py-3 font-semibold">{String(parent?.firstName??"")} {String(parent?.lastName??"")} <span className="text-slate-400">{String(parent?.email??"")}</span></td><td className="px-4 py-3 font-semibold">{String(student?.firstName??"")} {String(student?.lastName??"")} <span className="text-slate-400">{String(student?.email??"")}</span></td><td className="px-4 py-3 text-slate-600">{String(item.relationship??"—")}</td></tr>})}</tbody></table>}
      </section>
    </main>
  </DashboardShell>;
}
