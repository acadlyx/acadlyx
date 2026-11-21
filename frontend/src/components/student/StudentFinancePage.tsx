"use client";
import {useCallback,useEffect,useState} from "react";
import {financeInvoices,financeOverview,financePayments,financeReceipts} from "@/lib/financeApi";
import {startCheckout,confirmPayment} from "@/lib/billingApi";
import {DashboardShell} from "@/components/dashboard/DashboardShell";

const money=(n:number)=>new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR"}).format(Number(n||0));
type CheckoutResponse={razorpay_order_id:string;razorpay_payment_id:string;razorpay_signature:string};
type RazorpayOptions={key:string;amount:number;currency:string;name:string;description:string;order_id:string;handler:(response:CheckoutResponse)=>void|Promise<void>;modal?:{ondismiss?:()=>void};theme?:{color:string}};
type RazorpayInstance={open:()=>void;on:(event:string,handler:(response:{error?:{description?:string}})=>void)=>void};
type RazorpayConstructor=new(options:RazorpayOptions)=>RazorpayInstance;
declare global { interface Window { Razorpay?:RazorpayConstructor; } }

function ensureRazorpayCheckout():Promise<void>{
 if(window.Razorpay)return Promise.resolve();
 return new Promise((resolve,reject)=>{
  const existing=document.querySelector<HTMLScriptElement>('script[data-acadlyx-razorpay="true"]');
  if(existing){
   existing.addEventListener("load",()=>window.Razorpay?resolve():reject(new Error("Razorpay checkout could not be initialized.")),{once:true});
   existing.addEventListener("error",()=>reject(new Error("Unable to load Razorpay checkout.")),{once:true});
   return;
  }
  const script=document.createElement("script");
  script.src="https://checkout.razorpay.com/v1/checkout.js";
  script.async=true;
  script.dataset.acadlyxRazorpay="true";
  script.onload=()=>window.Razorpay?resolve():reject(new Error("Razorpay checkout could not be initialized."));
  script.onerror=()=>reject(new Error("Unable to load Razorpay checkout. Check your network and try again."));
  document.body.appendChild(script);
 });
}

export default function StudentFinancePage(){
 const[d,setD]=useState<any>({});
 const[loading,setLoading]=useState(true);
 const[error,setError]=useState("");
 const[message,setMessage]=useState("");
 const[payingInvoice,setPayingInvoice]=useState<string|null>(null);

 const load=useCallback(async()=>{
  setLoading(true);setError("");
  try{
   const [o,i,p,r]=await Promise.all([financeOverview(),financeInvoices({pageSize:100}),financePayments(),financeReceipts()]);
   setD({o,i,p,r});
  }catch(e){setError(e instanceof Error?e.message:"Unable to load fees");}
  finally{setLoading(false);}
 },[]);
 useEffect(()=>{void load()},[load]);

 const payInvoice=async(invoice:any)=>{
  setPayingInvoice(invoice.id);setError("");setMessage("");
  try{
   const order=await startCheckout(invoice.id);
   if(order.provider!=="razorpay"||!order.publicKey){
    throw new Error("Online payments are not configured for this institution. Please use the Accounts counter or contact your institution.");
   }
   await ensureRazorpayCheckout();
   const Razorpay=window.Razorpay;
   if(!Razorpay)throw new Error("Razorpay checkout is unavailable in this browser.");
   const checkout=new Razorpay({
    key:order.publicKey,
    amount:Math.round(Number(order.amount)*100),
    currency:order.currency||"INR",
    name:"ACADLYX",
    description:invoice.title||invoice.invoiceNumber||"Institution fee payment",
    order_id:order.orderId,
    handler:async(response)=>{
     try{
      await confirmPayment({
       invoiceId:invoice.id,
       orderId:response.razorpay_order_id,
       paymentId:response.razorpay_payment_id,
       signature:response.razorpay_signature,
       amount:Number(order.amount),
      });
      setMessage("The payment has been verified and the receipt has been recorded.");
      await load();
     }catch(e){
      setError((e instanceof Error?e.message:"Payment verification could not be completed")+" If your bank shows a debit, do not pay again; refresh your invoice or contact Accounts while provider reconciliation completes.");
     }finally{setPayingInvoice(null);}
    },
    modal:{ondismiss:()=>setPayingInvoice(null)},
    theme:{color:"#047857"},
   });
   checkout.on("payment.failed",(response)=>{
    setError(response.error?.description||"Payment was not completed. ACADLYX has not marked this invoice as paid.");
    setPayingInvoice(null);
   });
   checkout.open();
  }catch(e){
   setError(e instanceof Error?e.message:"Unable to start the online payment.");
   setPayingInvoice(null);
  }
 };

 return <DashboardShell title="Fees & Payments" subtitle="Your invoices, payments and receipts" allowedRoles={["STUDENT"]}>
  {loading ? <main className="min-h-[60vh] p-6 text-center text-sm text-slate-500">Loading your financial records…</main> :
   error && !d.o ? <main className="min-h-[60vh] p-6 text-center text-red-700">{error}</main> :
   <main className="min-w-0 bg-[#f6f0e5] p-4 sm:p-6">
    <div className="mx-auto max-w-6xl">
     <header className="mb-5"><p className="text-xs font-black uppercase tracking-[.18em] text-slate-500">My Finance</p><h1 className="text-2xl font-black text-slate-950">Fees & Payments</h1><p className="text-sm text-slate-500">Only your own financial records are available here.</p></header>
     {error&&<div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}
     {message&&<div role="status" className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{message}</div>}
     <div className="grid gap-4 sm:grid-cols-3">
      <div className="rounded-3xl border border-slate-200 bg-white p-5"><p className="text-sm text-slate-500">Outstanding</p><p className="mt-2 text-2xl font-black">{money(d.o?.outstanding||0)}</p></div>
      <div className="rounded-3xl border border-slate-200 bg-white p-5"><p className="text-sm text-slate-500">Overdue</p><p className="mt-2 text-2xl font-black">{money(d.o?.overdue||0)}</p></div>
      <div className="rounded-3xl border border-slate-200 bg-white p-5"><p className="text-sm text-slate-500">Paid</p><p className="mt-2 text-2xl font-black">{money(d.o?.collected||0)}</p></div>
     </div>
     <section className="mt-5 overflow-x-auto rounded-3xl border border-slate-200 bg-white"><h2 className="p-5 font-black">Invoices</h2><table className="w-full min-w-[900px] text-left text-sm"><thead className="bg-slate-50"><tr><th className="p-4">Invoice</th><th className="p-4">Source</th><th className="p-4">Amount</th><th className="p-4">Paid</th><th className="p-4">Outstanding</th><th className="p-4">Status</th><th className="p-4">Due</th><th className="p-4">Action</th></tr></thead><tbody className="divide-y divide-slate-100">{(d.i?.items||[]).map((x:any)=>{const due=Math.max(0,Number(x.outstanding??(Number(x.amount||0)+Number(x.lateFeeAmount||0)-Number(x.paidAmount||0))));return <tr key={x.id}><td className="p-4 font-bold">{x.invoiceNumber||x.title}</td><td className="p-4"><span className="font-semibold">{x.sourceModule||"FEES"}</span><span className="block text-xs text-slate-500">{x.sourceType||"FEE"}</span></td><td className="p-4">{money(Number(x.amount||0)+Number(x.lateFeeAmount||0))}</td><td className="p-4">{money(x.paidAmount)}</td><td className="p-4 font-bold">{money(due)}</td><td className="p-4">{x.status}</td><td className="p-4">{x.dueDate?new Date(x.dueDate).toLocaleDateString():"—"}</td><td className="p-4">{due>0&&x.status!=="CANCELLED"?<button type="button" disabled={Boolean(payingInvoice)} onClick={()=>void payInvoice(x)} className="whitespace-nowrap rounded-xl bg-emerald-700 px-3 py-2 text-xs font-black text-white disabled:opacity-50">{payingInvoice===x.id?"Opening checkout…":"Pay securely online"}</button>:<span className="text-xs text-slate-400">No payment due</span>}</td></tr>})}</tbody></table>{!(d.i?.items||[]).length&&<p className="p-6 text-sm text-slate-500">No invoices are currently linked to your account.</p>}</section>
     <section className="mt-5 grid gap-5 lg:grid-cols-2">
      <div className="rounded-3xl border border-slate-200 bg-white p-5"><h2 className="font-black">Payment history</h2><div className="mt-3 space-y-3">{(d.p||[]).map((x:any)=><div key={x.id} className="flex justify-between border-b border-slate-100 pb-3"><div><p className="font-semibold">{x.method} · {x.reference||"No reference"}</p><p className="text-xs text-slate-500">{new Date(x.paidAt).toLocaleString()}</p></div><b>{money(x.amount)}</b></div>)}{!(d.p||[]).length&&<p className="py-3 text-sm text-slate-500">No payments recorded.</p>}</div></div>
      <div className="rounded-3xl border border-slate-200 bg-white p-5"><h2 className="font-black">Receipts</h2><div className="mt-3 space-y-3">{(d.r||[]).map((x:any)=><div key={x.id} className="flex justify-between border-b border-slate-100 pb-3"><div><p className="font-semibold">{x.receiptNumber}</p><p className="text-xs text-slate-500">{new Date(x.issuedAt).toLocaleString()}</p></div><b>{money(x.payment?.amount)}</b></div>)}{!(d.r||[]).length&&<p className="py-3 text-sm text-slate-500">No receipts issued.</p>}</div></div>
     </section>
    </div>
   </main>}
 </DashboardShell>;
}
