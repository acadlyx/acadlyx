"use client";
import Link from "next/link";
import { useCallback,useEffect,useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardShell } from "./DashboardShell";
import { AuthRequiredError,authedFetch } from "@/lib/auth";

type WorkspaceResponse={success:true;data:{stats?:Record<string,number>}};
const metrics=[["Students","students"],["Faculty","faculty"],["Departments","departments"],["Courses","courses"]] as const;
const workflows=[
  {label:"Institutional operations",href:"/management/operations"},
  {label:"Institution intelligence",href:"/management/intelligence"},
  {label:"Management reports",href:"/management/reports"},
];

export function ManagementDashboard(){
  const router=useRouter();
  const [stats,setStats]=useState<Record<string,number>|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");

  const loadWorkspace=useCallback(async()=>{
    setLoading(true);setError("");
    try{
      const response=await authedFetch<WorkspaceResponse>("/erp/me/workspace");
      setStats(response.data.stats??{});
    }catch(err){
      if(err instanceof AuthRequiredError){router.replace("/login");return;}
      setError(err instanceof Error?err.message:"Unable to load the management workspace.");
    }finally{setLoading(false);}
  },[router]);

  useEffect(()=>{void loadWorkspace();},[loadWorkspace]);

  return <DashboardShell title="Management Workspace" subtitle="Institution-wide performance, governance and decision support" allowedRoles={["MANAGEMENT"]}>
    <main className="acadlyx-content-dashboard space-y-6">
      <header className="border-b border-slate-200 pb-5">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">Institutional performance</h1>
      </header>
      <div role="note" className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600">Review the institution-level indicators available to your account and move directly to the operational or reporting workflow.</div>
      {error?<section role="alert" className="flex flex-wrap items-center justify-between gap-3 border-y border-red-200 bg-red-50 px-4 py-4 text-sm text-red-800">
        <p className="min-w-0 flex-1">{error}</p><button type="button" onClick={()=>void loadWorkspace()} disabled={loading} className="min-h-11 rounded-lg border border-red-300 bg-white px-4 py-2 font-semibold text-red-800 disabled:opacity-50">Retry</button>
      </section>:null}
      <section aria-busy={loading} className="grid gap-0 border-y border-slate-200 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map(([label,key])=>{
          const value=stats?.[key];const available=typeof value==="number"&&Number.isFinite(value);
          return <article key={key} className="min-w-0 border-b border-slate-200 px-4 py-5 sm:border-r sm:px-5">
            <p className="text-xs font-semibold text-slate-500">{label}</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight text-slate-950">{loading||!available?"—":value.toLocaleString("en-IN")}</p>
            <p className="mt-1 text-xs text-slate-500">{loading?"Loading":available?"Reported for the institution":"Not reported"}</p>
          </article>;
        })}
      </section>
      <section aria-labelledby="management-workflows-heading">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Decision support</p>
        <h2 id="management-workflows-heading" className="mt-1 text-lg font-semibold text-slate-950">Management workflows</h2>
        <nav aria-label="Management workflows" className="mt-3 divide-y divide-slate-200 border-y border-slate-200">
          {workflows.map((workflow)=><Link key={workflow.href} href={workflow.href} className="flex min-h-14 items-center justify-between gap-4 px-3 py-3 text-sm font-semibold text-slate-800 transition-colors hover:bg-[#f4eee4] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#315c4a]">
            <span className="min-w-0">{workflow.label}</span><span aria-hidden="true" className="shrink-0 text-xs font-semibold text-[#315c4a]">Open →</span>
          </Link>)}
        </nav>
      </section>
    </main>
  </DashboardShell>;
}
