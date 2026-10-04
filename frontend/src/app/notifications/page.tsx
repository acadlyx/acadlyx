"use client";
import { useEffect,useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { AuthRequiredError } from "@/lib/auth";
import { getNotifications,markAllNotificationsRead,markNotificationRead,type ErpNotification } from "@/lib/erpApi";

export default function NotificationsPage(){
 const router=useRouter();const [items,setItems]=useState<ErpNotification[]>([]);const [unread,setUnread]=useState(0);const [error,setError]=useState("");
 async function load(){try{const r=await getNotifications(1,100);setItems(r.items);setUnread(r.unread);}catch(e){if(e instanceof AuthRequiredError)router.replace("/login");else setError(e instanceof Error?e.message:"Unable to load notifications.");}}
 useEffect(()=>{void load();},[]);
 async function read(id:string){await markNotificationRead(id,true);await load();}
 async function readAll(){await markAllNotificationsRead();await load();}
 return <DashboardShell title="Notification Center" subtitle="Messages, workflow changes and actions that matter to you"><main className="mx-auto max-w-5xl space-y-5 pb-10"><section className="rounded-3xl border bg-white p-6 shadow-sm"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[.18em] text-slate-400">Inbox</p><h1 className="mt-1 text-3xl font-black">Notifications</h1><p className="mt-2 text-sm text-slate-500">{unread} unread notification{unread===1?"":"s"}</p></div><button onClick={()=>void readAll()} disabled={!unread} className="rounded-xl bg-slate-950 px-4 py-2 text-xs font-black text-white disabled:opacity-40">Mark all read</button></div></section>{error&&<div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}<section className="space-y-2">{items.map(n=><button key={n.id} onClick={()=>void read(n.id)} className={"w-full rounded-2xl border p-5 text-left shadow-sm "+(n.readAt?"bg-white":"border-slate-300 bg-slate-50")}><div className="flex items-start justify-between gap-4"><div><h2 className="font-black">{n.title}</h2><p className="mt-1 text-sm leading-6 text-slate-600">{n.body}</p></div>{!n.readAt&&<span className="mt-1 h-2.5 w-2.5 rounded-full bg-slate-950"/>}</div><p className="mt-3 text-[10px] font-bold uppercase text-slate-400">{new Date(n.createdAt).toLocaleString()}</p></button>)}{items.length===0&&<div className="rounded-3xl border border-dashed p-10 text-center text-sm text-slate-500">You are all caught up.</div>}</section></main></DashboardShell>;
}
