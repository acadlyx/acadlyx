"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authedFetch } from "@/lib/auth";

type Result={type:string;id:string;title:string;subtitle:string;href:string};
export function GlobalSearchBar(){
 const router=useRouter(); const [q,setQ]=useState(""); const [results,setResults]=useState<Result[]>([]); const [open,setOpen]=useState(false);
 useEffect(()=>{const timer=setTimeout(async()=>{if(q.trim().length<2){setResults([]);return;}try{const r=await authedFetch<{success:true;data:Result[]}>(`/search?q=${encodeURIComponent(q)}`);setResults(r.data);setOpen(true);}catch{setResults([]);}},250);return()=>clearTimeout(timer);},[q]);
 return <div className="relative z-30 mx-auto mb-4 max-w-6xl px-4 sm:px-0">
  <div className="flex items-center rounded-2xl border border-slate-200 bg-white px-4 py-2.5 shadow-sm"><span className="mr-2 text-slate-400">⌕</span><input value={q} onFocus={()=>setOpen(true)} onChange={e=>setQ(e.target.value)} placeholder="Search people, courses, notices…" className="w-full bg-transparent text-sm outline-none"/></div>
  {open&&q.trim().length>=2?<div onMouseLeave={()=>setOpen(false)} className="absolute left-4 right-4 mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl sm:left-0 sm:right-0">{results.length?results.map(r=><button key={r.type+r.id} onClick={()=>{setOpen(false);router.push(r.href)}} className="block w-full border-b border-slate-100 px-4 py-3 text-left hover:bg-slate-50"><div className="text-sm font-black text-slate-900">{r.title}</div><div className="text-xs text-slate-500">{r.subtitle}</div></button>):<div className="px-4 py-5 text-xs text-slate-500">No accessible results.</div>}</div>:null}
 </div>;
}
