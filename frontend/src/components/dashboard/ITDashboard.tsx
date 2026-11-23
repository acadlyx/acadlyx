"use client";
import Link from "next/link";
import { useCallback,useEffect,useMemo,useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardShell } from "./DashboardShell";
import { AuthRequiredError,AuthUser,getCachedCurrentUser,getCurrentUser } from "@/lib/auth";
import { getNavigationForRoles, type NavigationItem } from "@/lib/navigation";

export function ITDashboard(){
  const router=useRouter();
  const cachedUser=getCachedCurrentUser();
  const [user,setUser]=useState<AuthUser|null>(cachedUser);
  const [loading,setLoading]=useState(!cachedUser);
  const [error,setError]=useState("");

  const loadUser=useCallback(async()=>{
    setLoading(true);setError("");
    try{
      const current=await getCurrentUser({background:Boolean(getCachedCurrentUser())});
      setUser(current);
    }catch(err){
      if(err instanceof AuthRequiredError){router.replace("/login");return;}
      setError(err instanceof Error?err.message:"Unable to load the IT workspace.");
    }finally{setLoading(false);}
  },[router]);

  useEffect(()=>{void loadUser();},[loadUser]);

  const groups=useMemo(()=>{
    if(!user)return [];
    const items=getNavigationForRoles(["IT"],user.permissions??[],user.tenantFeatures??[]);
    return items.reduce<Array<{label:string;items:NavigationItem[]}>>((result,item)=>{
      const label=item.group||"Workspace";
      const existing=result.find(group=>group.label===label);
      if(existing) existing.items.push(item);
      else result.push({label,items:[item]});
      return result;
    },[]);
  },[user]);

  return <DashboardShell title="IT Workspace" subtitle="Technology operations, platform support and service administration" allowedRoles={["IT"]}>
    <main className="acadlyx-content-dashboard space-y-6">
      <header className="border-b border-slate-200 pb-5">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">Authorized service tools</h1>
      </header>
      <div role="note" className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600">Open the IT workflows assigned to this account. Available tools are derived from the current role and permissions; operational records are loaded by their respective modules.</div>
      {error?<section role="alert" className="flex flex-wrap items-center justify-between gap-3 border-y border-red-200 bg-red-50 px-4 py-4 text-sm text-red-800">
        <p className="min-w-0 flex-1">{error}</p><button type="button" onClick={()=>void loadUser()} disabled={loading} className="min-h-11 rounded-lg border border-red-300 bg-white px-4 py-2 font-semibold text-red-800 disabled:opacity-50">Retry</button>
      </section>:null}
      {loading?<div role="status" aria-label="Loading authorized IT tools" className="space-y-3">
        {[1,2,3].map(item=><div key={item} className="h-14 animate-pulse border-b border-slate-200 bg-white/50"/>)}
      </div>:groups.length>0?<div className="space-y-6">
        {groups.map(group=>{
          const groupId=group.label.replaceAll(/[^a-z0-9]+/gi,"-").toLowerCase();
          return <section key={group.label} aria-labelledby={`it-group-${groupId}`}>
            <h3 id={`it-group-${groupId}`} className="mb-2 text-sm font-semibold text-slate-800">{group.label}</h3>
            <nav aria-label={`${group.label} tools`} className="divide-y divide-slate-200 border-y border-slate-200">
              {group.items.map(item=><Link key={`${item.href}:${item.label}`} href={item.href} className="flex min-h-14 items-center justify-between gap-4 px-3 py-3 text-sm font-semibold text-slate-800 transition-colors hover:bg-[#f4eee4] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#315c4a]">
                <span className="min-w-0">{item.label}</span><span aria-hidden="true" className="shrink-0 text-xs font-semibold text-[#315c4a]">Open →</span>
              </Link>)}
            </nav>
          </section>;
        })}
      </div>:<section className="border-y border-slate-200 px-4 py-8 text-sm text-slate-600">No IT workflows are currently available to this account. Ask your administrator to review the role and permissions assigned to this user.</section>}
    </main>
  </DashboardShell>;
}
