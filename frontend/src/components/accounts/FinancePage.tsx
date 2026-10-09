"use client";

import Link from "next/link";
import { useDeferredValue, useEffect, useState } from "react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { financeAudit, financeAssignStructure, financeCollections, financeConcessions, financeCommandCenter, financeHeads, financeInvoices, financePayments, financeReceipts, financeRefunds, financeStructures, financeTransactions, downloadFinanceExport } from "@/lib/financeApi";
import { getCachedCurrentUser } from "@/lib/auth";
import { createFeeHead, createFeeStructure, listAcademicYears, listPrograms, listSemesters, listFeeHeads } from "@/lib/erpApi";

type View = "overview"|"fee-structures"|"fee-heads"|"invoices"|"payments"|"receipts"|"dues"|"collections"|"concessions"|"refunds"|"transactions"|"reports"|"audit";
type Period = "today"|"week"|"month"|"quarter"|"academic";

const money=(n:number)=>new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:0}).format(Number(n||0));
const nav:{key:View;label:string;group:string;permission?:string}[]=[
 {key:"overview",label:"Overview",group:"Workspace"},
 {key:"fee-structures",label:"Fee Structures",group:"Fee Management",permission:"fees.structure.read"},
 {key:"fee-heads",label:"Fee Heads",group:"Fee Management",permission:"fees.structure.read"},
 {key:"invoices",label:"Invoices",group:"Billing",permission:"fees.read"},
 {key:"receipts",label:"Receipts",group:"Billing",permission:"fees.read"},
 {key:"payments",label:"Payments",group:"Collections",permission:"fees.read"},
 {key:"collections",label:"Collections",group:"Collections",permission:"fees.read"},
 {key:"transactions",label:"Transactions",group:"Collections",permission:"fees.read"},
 {key:"dues",label:"Outstanding & Overdue",group:"Dues",permission:"fees.read"},
 {key:"concessions",label:"Concessions",group:"Adjustments",permission:"fees.read"},
 {key:"refunds",label:"Refunds",group:"Adjustments",permission:"fees.read"},
 {key:"reports",label:"Reports",group:"Reporting",permission:"fees.read"},
 {key:"audit",label:"Audit",group:"Reporting",permission:"fees.read"},
];

function Card({children,className=""}:{children:React.ReactNode;className?:string}){return <section className={`rounded-2xl border border-slate-200 bg-white shadow-sm ${className}`}>{children}</section>}
function SectionTitle({title,subtitle,href}:{title:string;subtitle?:string;href?:string}){return <div className="flex items-start justify-between gap-4"><div><h2 className="text-sm font-black uppercase tracking-[.12em] text-slate-900">{title}</h2>{subtitle&&<p className="mt-1 text-xs text-slate-500">{subtitle}</p>}</div>{href&&<Link href={href} className="shrink-0 text-xs font-black text-emerald-700 hover:underline">View all</Link>}</div>}

export default function FinancePage({view, allowedRoles = ["ACCOUNTS"]}:{view:View; allowedRoles?: string[]}){
 const user=getCachedCurrentUser();
 const permissions=new Set(user?.permissions||[]);
 const [data,setData]=useState<any>(null),[loading,setLoading]=useState(true),[error,setError]=useState("");
 const [period,setPeriod]=useState<Period>("academic");
 const [search,setSearch]=useState("");
 const deferredSearch=useDeferredValue(search);
 const can=(p:string)=>permissions.has(p);
 useEffect(()=>{let live=true;setLoading(true);setError("");const load=async()=>{try{
   let x:any;
   if(view==="overview"||view==="dues") x=await financeCommandCenter(period);
   else if(view==="fee-structures") x=await financeStructures();
   else if(view==="fee-heads") x=await financeHeads();
   else if(view==="audit") x=await financeAudit();
   else if(view==="invoices") x=await financeInvoices({pageSize:25,search:deferredSearch||undefined});
   else if(view==="payments") x=await financePayments();
   else if(view==="receipts") x=await financeReceipts();
   else if(view==="collections") x=await financeCollections();
   else if(view==="concessions") x=await financeConcessions();
   else if(view==="refunds") x=await financeRefunds();
   else x=await financeTransactions();
   if(live)setData(x);
 }catch(e){if(live)setError(e instanceof Error?e.message:"Unable to load financial data")}finally{if(live)setLoading(false)}};void load();return()=>{live=false}},[view,deferredSearch,period]);
 const title=nav.find(x=>x.key===view)?.label||"Accounts";
 return <DashboardShell title="ACADLYX Finance" subtitle="Accounts & Financial Management" allowedRoles={allowedRoles}>
   <div className="mx-auto max-w-[1500px]">
    {view==="overview" ? <CommandCenter d={data} period={period} setPeriod={setPeriod} can={can}/> :
     view==="dues" ? <Dues d={data} can={can}/> :
     <OperationalView view={view} title={title} data={data} loading={loading} error={error} search={search} setSearch={setSearch} can={can}/>}
   </div>
 </DashboardShell>;
}

function CommandCenter({d,period,setPeriod,can}:{d:any;period:Period;setPeriod:(p:Period)=>void;can:(p:string)=>boolean}){
 if(!d)return <LoadingState/>;
 const trend=d.trend||[], max=Math.max(...trend.map((x:any)=>Number(x.amount)||0),1);
 const actions=d.actionRequired||[];
 const methods=d.paymentMethods||[];
 const departments=d.departments||[];
 return <div className="space-y-5">
  <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
   <div><p className="text-xs font-black uppercase tracking-[.2em] text-emerald-700">ACADLYX Finance</p><h1 className="mt-1 text-3xl font-black tracking-tight text-slate-950">Financial Command Center</h1><p className="mt-1 text-sm text-slate-500">Understand the institution&apos;s position, then act on what needs attention.</p><p className="mt-2 text-xs font-semibold text-slate-500">Authorized financial scope · Last refreshed {new Date().toLocaleTimeString()}</p></div>
   <div className="flex flex-wrap gap-2">{(["today","week","month","quarter","academic"] as Period[]).map(x=><button key={x} onClick={()=>setPeriod(x)} className={`rounded-xl border px-3 py-2 text-xs font-black capitalize ${period===x?"border-slate-950 bg-slate-950 text-white":"border-slate-200 bg-white text-slate-600"}`}>{x}</button>)}</div>
  </header>

  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
   {[
    ["Total billed",d.billed,"Financial position"],
    ["Total collected",d.collected,"Successful payments"],
    ["Outstanding",d.outstanding,"Still payable"],
    ["Overdue",d.overdue,`${d.overdueCount||0} accounts`],
    ["Collection rate",`${Number(d.collectionPercentage||0).toFixed(1)}%`,"Collected ÷ billed"]
   ].map(([label,value,sub])=><Card key={String(label)} className="p-5"><p className="text-xs font-bold uppercase tracking-wider text-slate-500">{label}</p><p className="mt-2 text-2xl font-black text-slate-950">{typeof value==="number"?money(value):value}</p><p className="mt-1 text-xs font-semibold text-slate-500">{sub}</p></Card>)}
  </div>

  <div className="grid gap-5 xl:grid-cols-[1.45fr_.85fr]">
   <Card className="p-5"><SectionTitle title="Today's collection" subtitle={`${money(d.todayCollection)} collected · ${d.paymentCount||0} payments in authorized scope`}/><div className="mt-5 grid gap-4 sm:grid-cols-2"><div><p className="text-3xl font-black">{money(d.todayCollection)}</p><p className="mt-1 text-xs text-slate-500">Collected today</p></div><div className="space-y-2">{(d.todayPaymentMethods||[]).slice(0,5).map((m:any)=><div key={m.method} className="flex items-center justify-between text-sm"><span className="font-semibold text-slate-600">{m.method||"Other"}</span><span className="font-black">{money(m.amount)}</span></div>)}</div></div><div className="mt-5 border-t border-slate-100 pt-4"><div className="flex flex-wrap gap-2">{can("fees.payment.record")&&<Link href="/accounts/payments" className="rounded-xl bg-slate-950 px-3 py-2 text-xs font-black text-white">Record payment</Link>}{can("fees.read")&&<Link href="/accounts/receipts" className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-black text-slate-700">Receipts</Link>}</div></div></Card>
   <Card className="p-5"><SectionTitle title="Action required" subtitle="Only items visible in your authorized financial scope."/><div className="mt-4 space-y-2">{actions.length?actions.map((a:any)=><Link key={a.kind} href={a.href} className="flex items-center justify-between rounded-xl border border-slate-200 p-3 hover:border-slate-400"><span className="text-sm font-bold text-slate-800">{a.label}</span><span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-black text-amber-800">{a.count}</span></Link>):<div className="rounded-xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">No pending financial actions in this scope.</div>}</div></Card>
  </div>

  <div className="grid gap-5 xl:grid-cols-[1.45fr_.85fr]">
   <Card className="p-5"><SectionTitle title="Collection trend" subtitle="Successful payments over the last 30 days"/><div className="mt-5 flex h-48 items-end gap-1 overflow-hidden">{trend.map((x:any)=><div key={x.date} title={`${x.date}: ${money(x.amount)}`} className="min-w-[5px] flex-1 rounded-t bg-emerald-500/70" style={{height:`${Math.max(4,Number(x.amount)/max*100)}%`}}/> )}</div><div className="mt-3 flex justify-between text-[10px] font-semibold text-slate-400"><span>{trend[0]?.date||""}</span><span>{trend[trend.length-1]?.date||""}</span></div></Card>
   <Card className="p-5"><SectionTitle title="Payment methods"/><div className="mt-4 space-y-3">{methods.length?methods.map((m:any)=><div key={m.method} className="flex items-center justify-between"><div><p className="text-sm font-bold">{m.method||"Other"}</p><p className="text-[11px] text-slate-500">{m.count} transactions</p></div><p className="text-sm font-black">{money(m.amount)}</p></div>):<Empty text="No payment activity yet."/>}</div></Card>
  </div>

  <Card className="p-5"><SectionTitle title="Collection by department" subtitle="Sorted by collected amount · drill down is limited to your scope" href="/accounts/collections"/><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead><tr className="border-b border-slate-100 text-xs uppercase tracking-wider text-slate-500"><th className="pb-3">Department</th><th className="pb-3">Billed</th><th className="pb-3">Collected</th><th className="pb-3">Outstanding</th><th className="pb-3">Rate</th><th className="pb-3"/></tr></thead><tbody>{departments.map((x:any)=><tr key={x.departmentId} className="border-b border-slate-50"><td className="py-3 font-black">{x.name}</td><td>{money(x.billed)}</td><td>{money(x.collected)}</td><td>{money(x.outstanding)}</td><td className="font-bold">{Number(x.collectionPercentage||0).toFixed(1)}%</td><td><Link href={`/accounts/collections?departmentId=${x.departmentId}`} className="font-bold text-emerald-700">View</Link></td></tr>)}</tbody></table>{!departments.length&&<Empty text="No departmental financial activity yet."/>}</div></Card>

  <div className="grid gap-5 xl:grid-cols-2">
   <Card className="p-5"><SectionTitle title="Programme collection" subtitle="Drill-down-ready programme performance"/><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm"><thead><tr className="border-b border-slate-100 text-xs uppercase text-slate-500"><th className="pb-3">Programme</th><th>Billed</th><th>Collected</th><th>Outstanding</th><th>Rate</th></tr></thead><tbody>{(d.programs||[]).slice(0,8).map((x:any)=><tr key={x.programId} className="border-b border-slate-50"><td className="py-3 font-black">{x.name}</td><td>{money(x.billed)}</td><td>{money(x.collected)}</td><td>{money(x.outstanding)}</td><td className="font-bold">{Number(x.collectionPercentage||0).toFixed(1)}%</td></tr>)}</tbody></table>{!(d.programs||[]).length&&<Empty text="No programme-level activity yet."/>}</div></Card>
   <Card className="p-5"><SectionTitle title="Semester collection" subtitle="Current authorized scope"/><div className="mt-4 space-y-3">{(d.semesters||[]).slice(0,8).map((x:any)=><div key={x.semesterId} className="flex items-center justify-between border-b border-slate-100 pb-3"><div><p className="text-sm font-black">{x.name}</p><p className="text-xs text-slate-500">{money(x.collected)} collected · {Number(x.collectionPercentage||0).toFixed(1)}%</p></div><p className="text-sm font-black">{money(x.outstanding)}</p></div>)}{!(d.semesters||[]).length&&<Empty text="No semester-level activity yet."/>}</div></Card>
  </div>

  <div className="grid gap-5 lg:grid-cols-2">
   <Card className="p-5"><SectionTitle title="Payment attention" href="/accounts/dues"/><div className="mt-4 grid gap-3 sm:grid-cols-2"><Link href="/accounts/dues" className="rounded-xl border border-red-100 bg-red-50 p-4"><p className="text-xs font-black uppercase text-red-700">Overdue</p><p className="mt-1 text-xl font-black text-red-900">{money(d.overdue)}</p><p className="mt-1 text-xs text-red-700">{d.overdueCount||0} accounts</p></Link><Link href="/accounts/invoices" className="rounded-xl border border-amber-100 bg-amber-50 p-4"><p className="text-xs font-black uppercase text-amber-700">Unpaid invoices</p><p className="mt-1 text-xl font-black text-amber-900">{d.pendingInvoices||0}</p><p className="mt-1 text-xs text-amber-700">Awaiting payment</p></Link></div></Card>
   <Card className="p-5"><SectionTitle title="Quick actions"/><div className="mt-4 flex flex-wrap gap-2">{[
    ["Create Invoice","/accounts/invoices","fees.invoice.manage"],["Record Payment","/accounts/payments","fees.payment.record"],["Assign Fees","/accounts/fee-structures","fees.assign"],["Review Concessions","/accounts/concessions","fees.concession.approve"],["Process Refund","/accounts/refunds","fees.refund.process"],["Generate Report","/accounts/reports","fees.read"]
   ].filter(([, ,p])=>can(String(p))).map(([label,href])=><Link key={label} href={String(href)} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-100">{label}</Link>)}</div></Card>
  </div>

  <div className="grid gap-5 xl:grid-cols-2">
   <Card className="p-5"><SectionTitle title="Recent payments" href="/accounts/payments"/><div className="mt-3 divide-y divide-slate-100">{(d.recentPayments||[]).map((x:any)=><div key={x.id} className="flex items-center justify-between gap-3 py-3"><div className="min-w-0"><p className="truncate text-sm font-bold">{x.invoice?.student?.firstName} {x.invoice?.student?.lastName}</p><p className="text-[11px] text-slate-500">{x.invoice?.invoiceNumber||"Invoice"} · {x.method}</p></div><div className="text-right"><p className="text-sm font-black">{money(x.amount)}</p><p className="text-[11px] text-slate-500">{new Date(x.paidAt).toLocaleDateString()}</p></div></div>)}</div>{!(d.recentPayments||[]).length&&<Empty text="No financial activity yet."/>}</Card>
   <Card className="p-5"><SectionTitle title="Recent invoices" href="/accounts/invoices"/><div className="mt-3 divide-y divide-slate-100">{(d.recentInvoices||[]).map((x:any)=><Link key={x.id} href={`/accounts/invoices/${x.id}`} className="flex items-center justify-between gap-3 py-3"><div className="min-w-0"><p className="truncate text-sm font-bold">{x.invoiceNumber||x.title}</p><p className="text-[11px] text-slate-500">{x.student?.firstName} {x.student?.lastName}</p></div><div className="text-right"><p className="text-sm font-black">{money(x.outstanding)}</p><p className="text-[11px] text-slate-500">{x.status}</p></div></Link>)}</div>{!(d.recentInvoices||[]).length&&<Empty text="No invoices have been generated yet."/>}</Card>
  </div>
 </div>;
}

function OperationalView({view,title,data,loading,error,search,setSearch,can}:{view:View;title:string;data:any;loading:boolean;error:string;search:string;setSearch:(s:string)=>void;can:(p:string)=>boolean}){
 if(loading)return <LoadingState/>;
 if(error)return <Card className="p-8"><p className="font-black text-red-700">Unable to load {title.toLowerCase()}</p><p className="mt-2 text-sm text-slate-500">{error}</p><button className="mt-4 rounded-xl bg-slate-950 px-3 py-2 text-xs font-black text-white" onClick={()=>location.reload()}>Retry</button></Card>;
 const rows=Array.isArray(data)?data:data?.items||[];
 const actions=view==="invoices"&&can("fees.invoice.manage")?<Link href="/accounts/invoices" className="rounded-xl bg-slate-950 px-3 py-2 text-xs font-black text-white">Create Invoice</Link>:null;
 const headers=view==="fee-structures"?["Name","Status","Currency","Total","Actions"]:view==="fee-heads"?["Code","Name","Status"]:view==="audit"?["Action","Entity","Time"]:view==="invoices"?["Invoice","Student","Amount","Paid","Status","Due",""]:view==="payments"?["Reference","Student","Amount","Method","Date"]:view==="receipts"?["Receipt","Invoice","Student","Amount","Date"]:view==="concessions"?["Type","Amount","Reason","Status"]:view==="refunds"?["Amount","Reason","Status","Created"]:["Type","Amount","Reference","Created"];
 return <div className="space-y-5">
  <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-black uppercase tracking-[.18em] text-emerald-700">Finance workspace</p><h1 className="mt-1 text-2xl font-black">{title}</h1><p className="mt-1 text-sm text-slate-500">Scoped financial records with permission-aware operations.</p></div><div className="flex gap-2">{["invoices","payments","receipts","transactions"].includes(view)&&(can("fees.reports.export")||can("fees.read"))&&<button onClick={()=>void downloadFinanceExport(view as "invoices"|"payments"|"receipts"|"transactions")} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700">Export XLSX</button>}{actions}</div></header>
  {["invoices","payments","receipts","transactions","collections","dues"].includes(view)&&<div className="flex flex-col gap-2 sm:flex-row"><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search financial records…" className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-400 sm:max-w-sm"/><div className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold text-slate-600">Server-enforced scope</div></div>}
  {view==="fee-structures"&&<FeeStructureCreatePanel canCreate={can("fees.structure.manage")} /> }
  {view==="fee-heads"&&<FeeHeadCreatePanel canCreate={can("fees.structure.manage")} /> }
  {view==="dues"?<Dues d={data} can={can}/>:view==="collections"?<Collections d={data}/>:<Card className="overflow-hidden"><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-slate-50"><tr>{headers.map(h=><th key={h} className="p-4 text-xs uppercase tracking-wider text-slate-500">{h}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{rows.map((x:any,i:number)=><FinanceRow key={x.id||i} view={view} x={x} can={can}/>)}</tbody></table>{!rows.length&&<Empty text={emptyText(view)}/>}</div></Card>}
 </div>;
}

function FeeHeadCreatePanel({canCreate}:{canCreate:boolean}) {
 const [open,setOpen]=useState(false);const [busy,setBusy]=useState(false);const [error,setError]=useState("");const [form,setForm]=useState({name:"",code:"",description:""});
 if(!canCreate)return <Card className="p-5"><p className="font-bold text-slate-900">Fee head creation is not enabled for this account.</p><p className="mt-1 text-sm text-slate-600">This screen requires <code>fees.structure.manage</code>.</p></Card>;
 return <Card className="p-5"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div><h2 className="text-sm font-black uppercase tracking-[.12em] text-slate-900">Fee head setup</h2><p className="mt-1 text-xs text-slate-500">Create reusable heads such as Tuition, Examination, Library or Transport.</p></div><button type="button" onClick={()=>setOpen(v=>!v)} className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white">{open?"Cancel":"Create fee head"}</button></div>{error&&<p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}{open&&<form className="mt-5 grid gap-4 sm:grid-cols-2" onSubmit={async e=>{e.preventDefault();setBusy(true);setError("");try{await createFeeHead({name:form.name.trim(),code:form.code.trim().toUpperCase(),description:form.description.trim()||undefined});window.location.reload()}catch(e){setError(e instanceof Error?e.message:"Unable to create fee head")}finally{setBusy(false)}}}><label className="text-xs font-bold text-slate-600">Name<input required value={form.name} onChange={e=>setForm(v=>({...v,name:e.target.value}))} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm" placeholder="Tuition Fee"/></label><label className="text-xs font-bold text-slate-600">Code<input required pattern="[A-Za-z0-9][A-Za-z0-9_-]{1,49}" title="Use 2–50 letters, numbers, underscores or hyphens" value={form.code} onChange={e=>setForm(v=>({...v,code:e.target.value.toUpperCase()}))} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm" placeholder="TUITION"/></label><label className="text-xs font-bold text-slate-600 sm:col-span-2">Description<textarea rows={2} value={form.description} onChange={e=>setForm(v=>({...v,description:e.target.value}))} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"/></label><div className="sm:col-span-2"><button disabled={busy} className="rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{busy?"Saving…":"Save fee head"}</button></div></form>}</Card>;
}

function FeeStructureCreatePanel({canCreate}:{canCreate:boolean}) {
 const [open,setOpen]=useState(false);
 const [loading,setLoading]=useState(false);
 const [error,setError]=useState("");
 const [success,setSuccess]=useState("");
 const [years,setYears]=useState<Array<{id:string;name:string;isCurrent?:boolean}>>([]);
 const [programs,setPrograms]=useState<Array<{id:string;name:string}>>([]);
 const [semesters,setSemesters]=useState<Array<{id:string;name:string}>>([]);
 const [heads,setHeads]=useState<Array<{id:string;name:string;code:string;isActive?:boolean}>>([]);
 const [form,setForm]=useState({name:"",academicYearId:"",programId:"",semesterId:"",feeHeadId:"",amount:"",dueDays:"",installmentNumber:"1",notes:""});
 useEffect(()=>{let active=true;void Promise.all([listAcademicYears(),listPrograms(),listSemesters(),listFeeHeads()]).then(([y,p,s,h])=>{if(!active)return;setYears(y);setPrograms(p);setSemesters(s);setHeads(h);const current=y.find(x=>x.isCurrent);if(current)setForm(v=>({...v,academicYearId:current.id}));}).catch(e=>{if(active)setError(e instanceof Error?e.message:"Unable to load fee setup options")});return()=>{active=false}},[]);
 if(!canCreate)return <Card className="p-5"><p className="font-bold text-slate-900">Fee structure creation is not enabled for this account.</p><p className="mt-1 text-sm text-slate-600">This screen requires the <code>fees.structure.manage</code> permission. An administrator must grant the permission through the approved role-permission workflow.</p></Card>;
 return <Card className="p-5"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div><h2 className="text-sm font-black uppercase tracking-[.12em] text-slate-900">Fee structure setup</h2><p className="mt-1 text-xs text-slate-500">Create a fee structure scoped to an academic year, programme and semester.</p></div><button type="button" onClick={()=>setOpen(v=>!v)} className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white">{open?"Cancel":"Create fee structure"}</button></div>
 {error&&<p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}{success&&<p role="status" className="mt-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">{success}</p>}
 {open&&<form className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3" onSubmit={async e=>{e.preventDefault();setError("");setSuccess("");setLoading(true);try{await createFeeStructure({name:form.name.trim(),academicYearId:form.academicYearId||undefined,programId:form.programId||undefined,semesterId:form.semesterId||undefined,status:"DRAFT",currency:"INR",notes:form.notes.trim()||undefined,items:[{feeHeadId:form.feeHeadId,amount:Number(form.amount),dueDays:form.dueDays===""?undefined:Number(form.dueDays),installmentNumber:Number(form.installmentNumber)}]});setSuccess("Fee structure created as DRAFT. Refreshing records…");window.location.reload()}catch(e){setError(e instanceof Error?e.message:"Unable to create fee structure")}finally{setLoading(false)}}}>
 <label className="text-xs font-bold text-slate-600">Structure name<input required value={form.name} onChange={e=>setForm(v=>({...v,name:e.target.value}))} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm" placeholder="e.g. B.Tech CSE 2026–27"/></label>
 <label className="text-xs font-bold text-slate-600">Academic year<select value={form.academicYearId} onChange={e=>setForm(v=>({...v,academicYearId:e.target.value}))} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"><option value="">All years</option>{years.map(x=><option key={x.id} value={x.id}>{x.name}{x.isCurrent?" · Current":""}</option>)}</select></label>
 <label className="text-xs font-bold text-slate-600">Programme<select value={form.programId} onChange={e=>setForm(v=>({...v,programId:e.target.value}))} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"><option value="">All programmes</option>{programs.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
 <label className="text-xs font-bold text-slate-600">Semester<select value={form.semesterId} onChange={e=>setForm(v=>({...v,semesterId:e.target.value}))} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"><option value="">All semesters</option>{semesters.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
 <label className="text-xs font-bold text-slate-600">Fee head<select required value={form.feeHeadId} onChange={e=>setForm(v=>({...v,feeHeadId:e.target.value}))} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"><option value="">Select fee head</option>{heads.filter(x=>x.isActive!==false).map(x=><option key={x.id} value={x.id}>{x.name} ({x.code})</option>)}</select>{heads.length===0&&<span className="mt-1 block font-normal text-amber-700">Create/activate fee heads before creating a structure.</span>}</label>
 <label className="text-xs font-bold text-slate-600">Amount (INR)<input required type="number" min="0.01" step="0.01" value={form.amount} onChange={e=>setForm(v=>({...v,amount:e.target.value}))} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"/></label>
 <label className="text-xs font-bold text-slate-600">Due after (days)<input type="number" min="0" value={form.dueDays} onChange={e=>setForm(v=>({...v,dueDays:e.target.value}))} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"/></label>
 <label className="text-xs font-bold text-slate-600">Installment number<input required type="number" min="1" value={form.installmentNumber} onChange={e=>setForm(v=>({...v,installmentNumber:e.target.value}))} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"/></label>
 <label className="text-xs font-bold text-slate-600 sm:col-span-2 xl:col-span-3">Notes<textarea rows={2} value={form.notes} onChange={e=>setForm(v=>({...v,notes:e.target.value}))} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"/></label>
 <div className="sm:col-span-2 xl:col-span-3"><button disabled={loading||heads.filter(x=>x.isActive!==false).length===0} className="rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{loading?"Creating…":"Save fee structure as draft"}</button><p className="mt-2 text-xs text-slate-500">New structures start as DRAFT and must be approved before use where the institution’s workflow requires approval.</p></div>
 </form>}</Card>;
}

function FinanceRow({view,x,can}:{view:View;x:any;can:(p:string)=>boolean}){
 if(view==="fee-structures")return <tr><td className="p-4 font-bold">{x.name}</td><td>{x.status}</td><td>{x.currency}</td><td>{money(x.totalAmount)}</td><td className="p-4"><div className="flex flex-wrap gap-2">{can("fees.assign")&&<button type="button" disabled={x.status!=="ACTIVE"} title={x.status!=="ACTIVE"?"Only approved active structures can be assigned":"Generate invoices for matching active enrollments"} onClick={async()=>{if(!window.confirm(`Assign “${x.name}” to all active enrollments matching its academic context? Existing invoices will be skipped.`))return;try{const result=await financeAssignStructure(x.id);window.alert(`Fee assignment complete. Generated: ${result.generated}; skipped existing invoices: ${result.skipped}.`);window.location.reload()}catch(e){window.alert(e instanceof Error?e.message:"Unable to assign fee structure")}}} className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">Assign fees</button>}</div></td></tr>;
 if(view==="fee-heads")return <tr><td className="p-4 font-bold">{x.code}</td><td>{x.name}</td><td>{x.isActive?"Active":"Inactive"}</td></tr>;
 if(view==="audit")return <tr><td className="p-4 font-bold">{x.action}</td><td>{x.entityType||"—"}</td><td>{x.createdAt?new Date(x.createdAt).toLocaleString():"—"}</td></tr>;
 if(view==="invoices")return <tr><td className="p-4 font-bold">{x.invoiceNumber||x.title}</td><td>{x.student?.firstName} {x.student?.lastName}</td><td>{money(x.amount)}</td><td>{money(x.paidAmount)}</td><td><span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold">{x.status}</span></td><td>{x.dueDate?new Date(x.dueDate).toLocaleDateString():"—"}</td><td><Link className="font-bold text-emerald-700" href={`/accounts/invoices/${x.id}`}>View</Link></td></tr>;
 if(view==="payments")return <tr><td className="p-4 font-bold">{x.reference||x.receiptNumber||"—"}</td><td>{x.invoice?.student?.firstName} {x.invoice?.student?.lastName}</td><td>{money(x.amount)}</td><td>{x.method}</td><td>{x.paidAt?new Date(x.paidAt).toLocaleString():"—"}</td></tr>;
 if(view==="receipts")return <tr><td className="p-4 font-bold">{x.receiptNumber}</td><td>{x.invoice?.invoiceNumber||"—"}</td><td>{x.student?.firstName} {x.student?.lastName}</td><td>{money(x.payment?.amount)}</td><td>{x.issuedAt?new Date(x.issuedAt).toLocaleString():"—"}</td></tr>;
 if(view==="concessions")return <tr><td className="p-4">{x.type}</td><td>{money(x.amount)}</td><td className="max-w-sm truncate">{x.reason}</td><td><span className="font-bold">{x.status}</span></td></tr>;
 if(view==="refunds")return <tr><td className="p-4">{money(x.amount)}</td><td className="max-w-sm truncate">{x.reason}</td><td className="font-bold">{x.status}</td><td>{x.createdAt?new Date(x.createdAt).toLocaleString():"—"}</td></tr>;
 return <tr><td className="p-4">{x.type}</td><td>{money(x.amount)}</td><td>{x.reference||"—"}</td><td>{x.createdAt?new Date(x.createdAt).toLocaleString():"—"}</td></tr>;
}

function Collections({d}:{d:any}){const rows=d?.departments||[];return <Card className="p-5"><SectionTitle title="Collection performance" subtitle="Department-level intelligence within the authorized scope"/><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="border-b border-slate-100 text-xs uppercase text-slate-500"><tr><th className="pb-3">Department</th><th>Billed</th><th>Collected</th><th>Outstanding</th><th>Rate</th></tr></thead><tbody>{rows.map((x:any)=><tr key={x.departmentId} className="border-b border-slate-50"><td className="py-3 font-black">{x.name}</td><td>{money(x.billed)}</td><td>{money(x.collected)}</td><td>{money(x.outstanding)}</td><td className="font-bold">{Number(x.collectionPercentage||0).toFixed(1)}%</td></tr>)}</tbody></table>{!rows.length&&<Empty text="No collection data in this scope yet."/>}</div></Card>}

function Dues({d,can}:{d:any;can:(p:string)=>boolean}){return <div className="space-y-5"><div className="grid gap-3 md:grid-cols-3">{[["Outstanding",d?.outstanding],["Overdue",d?.overdue],["Overdue accounts",d?.overdueCount||0]].map(([k,v])=><Card key={String(k)} className="p-5"><p className="text-xs font-black uppercase tracking-wider text-slate-500">{k}</p><p className="mt-2 text-2xl font-black">{typeof v==="number"&&k!=="Overdue accounts"?money(v):v}</p></Card>)}</div><Card className="p-5"><SectionTitle title="Payment attention required" subtitle="Use the dedicated dues workflow for account-level follow-up"/><div className="mt-4 flex flex-wrap gap-2">{can("fees.read")&&<Link href="/accounts/invoices" className="rounded-xl bg-slate-950 px-4 py-2 text-xs font-black text-white">View invoices</Link>}<Link href="/accounts/collections" className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-black text-slate-700">View collections</Link></div></Card></div>}

function Empty({text}:{text:string}){return <div className="p-10 text-center text-sm font-semibold text-slate-500">{text}</div>}
function LoadingState(){return <Card className="p-12 text-center text-sm font-semibold text-slate-500">Loading financial command center…</Card>}
function emptyText(view:View){return view==="invoices"?"No invoices have been generated for this scope.":view==="payments"?"No payments have been recorded yet.":view==="receipts"?"No receipts have been issued yet.":view==="refunds"?"No refund requests are present.":view==="concessions"?"No concession requests are present.":"No financial records are available in this scope."}
