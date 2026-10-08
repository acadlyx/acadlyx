"use client";
import { useCallback, useEffect, useState } from "react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { getCurrentUser, AuthRequiredError } from "@/lib/auth";
import { listLoans, LibraryLoan, returnLoan, imposeLateReturnFine, renewLoan } from "@/lib/libraryApi";
import { useRouter } from "next/navigation";

export default function LibraryCirculationPage() {
  const router = useRouter();
  const [loans,setLoans]=useState<LibraryLoan[]>([]);
  const [status,setStatus]=useState("");
  const [error,setError]=useState("");
  const [busy,setBusy]=useState("");
  const load=useCallback(async()=>{try{const me=await getCurrentUser();if(!me.permissions.includes("library.manage"))throw new Error("You do not have access to library circulation.");const r=await listLoans({status:status as never||undefined});setLoans(r.items);}catch(e){if(e instanceof AuthRequiredError){router.replace("/login");return;}setError(e instanceof Error?e.message:"Unable to load circulation");}},[router,status]);
  useEffect(()=>{void load()},[load]);
  async function action(id:string,fn:()=>Promise<unknown>){setBusy(id);setError("");try{await fn();await load()}catch(e){setError(e instanceof Error?e.message:"Action failed")}finally{setBusy("")}}
  return <DashboardShell title="Library Circulation" subtitle="Issue, return, renew and overdue operations">
    <main className="mx-auto w-full max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
      <section className="flex flex-wrap gap-3 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><select value={status} onChange={e=>setStatus(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm"><option value="">All active circulation</option>{["ISSUED","RESERVED","OVERDUE","RETURNED","LOST","DAMAGED"].map(s=><option key={s}>{s}</option>)}</select></section>
      {error&&<div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"><div className="overflow-x-auto"><table className="w-full min-w-[1050px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="p-4">Book / copy</th><th>Borrower</th><th>Issued</th><th>Due</th><th>Policy</th><th>Fine</th><th>Actions</th></tr></thead><tbody className="divide-y divide-slate-100">
      {loans.map(loan=><tr key={loan.id}><td className="p-4 font-semibold text-slate-900">{loan.book.title}<span className="block text-xs font-normal text-slate-400">{loan.copy?.accessionNumber||"Legacy/unassigned copy"}</span></td><td>{loan.borrower.firstName} {loan.borrower.lastName}</td><td>{new Date(loan.issuedAt).toLocaleDateString()}</td><td className={loan.isOverdue?"font-semibold text-red-600":""}>{new Date(loan.dueDate).toLocaleDateString()}</td><td>{loan.finePerDay==null?"—":`₹${loan.finePerDay.toFixed(2)}/day · cap ₹${(loan.fineCap??0).toFixed(2)} · ${loan.renewalsUsed}/${loan.renewalsAllowed}`}</td><td>₹{(loan.financialBalance||loan.accruedFine).toFixed(2)}</td><td><div className="flex flex-wrap gap-2">{["ISSUED","RESERVED"].includes(loan.status)&&<><button disabled={busy===loan.id} onClick={()=>void action(loan.id,()=>returnLoan(loan.id,{condition:"RETURNED"}))} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white">Return</button><button disabled={busy===loan.id} onClick={()=>void action(loan.id,()=>renewLoan(loan.id))} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700">Renew</button><button disabled={busy===loan.id} onClick={()=>void action(loan.id,()=>returnLoan(loan.id,{condition:"LOST"}))} className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white">Lost</button><button disabled={busy===loan.id} onClick={()=>void action(loan.id,()=>returnLoan(loan.id,{condition:"DAMAGED",damageSeverity:"MODERATE"}))} className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700">Damaged</button>{loan.isOverdue&&loan.accruedFine>0&&<button disabled={busy===loan.id} onClick={()=>void action(loan.id,()=>imposeLateReturnFine(loan.id))} className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700">Impose fine</button>}</>}</div></td></tr>)}
      {loans.length===0&&<tr><td colSpan={7} className="p-8 text-center text-slate-500">No circulation records match this filter.</td></tr>}</tbody></table></div></section>
    </main>
  </DashboardShell>;
}
