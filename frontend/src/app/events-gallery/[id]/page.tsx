"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getCurrentUser, type AuthUser } from "@/lib/auth";
import { deleteEvent, getEvent, type InstitutionalEvent } from "@/lib/eventsApi";

export default function EventDetailsPage(){
  const params=useParams<{id:string}>(); const router=useRouter();
  const [event,setEvent]=useState<InstitutionalEvent|null>(null);
  const [user,setUser]=useState<AuthUser|null>(null);
  const [error,setError]=useState(""); const [lightbox,setLightbox]=useState<string|null>(null);
  useEffect(()=>{getCurrentUser({background:true}).then(setUser).catch(()=>{});getEvent(params.id).then(r=>setEvent(r.data)).catch(e=>setError(e instanceof Error?e.message:"Unable to load event."));},[params.id]);
  if(error)return <div className="mx-auto max-w-5xl rounded-3xl border border-red-200 bg-red-50 p-8 text-red-700">{error}</div>;
  if(!event)return <div className="mx-auto max-w-5xl rounded-3xl border border-slate-200 bg-white p-12 text-center text-sm font-semibold text-slate-500">Loading event…</div>;
  const canManage=!!user?.permissions.includes("events.manage");
  async function remove(){if(!confirm("Delete this event and its gallery?"))return;try{await deleteEvent(event!.id);router.replace("/events-gallery");}catch(e){setError(e instanceof Error?e.message:"Delete failed.");}}
  const time=event.startTime ? event.startTime + (event.endTime ? "–"+event.endTime : "") : "";
  return <div className="mx-auto max-w-6xl space-y-6">
    <div className="flex items-center justify-between gap-3"><Link href="/events-gallery" className="text-sm font-bold text-slate-600">← Events & Gallery</Link>{canManage&&<div className="flex gap-2"><Link href={"/events-gallery/"+event.id+"/edit"} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-black">Edit</Link><button onClick={remove} className="rounded-xl border border-red-200 px-4 py-2.5 text-sm font-black text-red-600">Delete</button></div>}</div>
    <article className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="relative aspect-[16/7] bg-slate-100">{event.coverImageUrl?<img src={event.coverImageUrl} alt={event.title} className="h-full w-full object-cover"/>:event.media[0]?<img src={event.media[0].url} alt={event.title} className="h-full w-full object-cover"/>:<div className="grid h-full place-items-center font-black text-slate-400">ACADLYX</div>}<div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-6 pt-20 text-white"><div className="flex flex-wrap gap-2 text-xs font-bold"><span>{new Date(event.eventDate).toLocaleDateString("en-IN",{day:"2-digit",month:"long",year:"numeric"})}</span>{time&&<span>• {time}</span>}{event.venue&&<span>• {event.venue}</span>}</div><h1 className="mt-2 text-3xl font-black">{event.title}</h1></div></div>
      <div className="grid gap-6 p-6 lg:grid-cols-[1fr_280px]"><div><p className="whitespace-pre-line text-sm leading-7 text-slate-700">{event.description||event.shortDescription}</p>{event.highlights?.length?<div className="mt-6"><h2 className="text-lg font-black">Highlights</h2><ul className="mt-3 grid gap-2 sm:grid-cols-2">{event.highlights.map(x=><li key={x} className="rounded-xl bg-slate-50 p-3 text-sm font-semibold text-slate-700">✓ {x}</li>)}</ul></div>:null}<div className="mt-8"><div className="flex items-center justify-between"><h2 className="text-lg font-black">Gallery</h2><span className="text-xs font-bold text-slate-500">{event.media.length} photos</span></div><div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{event.media.map(m=><button key={m.id} onClick={()=>setLightbox(m.url)} className="overflow-hidden rounded-2xl bg-slate-100"><img src={m.url} alt={m.altText||event.title} className="aspect-square w-full object-cover transition hover:scale-105"/></button>)}</div></div>{event.videoUrls?.length?<div className="mt-8"><h2 className="text-lg font-black">Video & media</h2><div className="mt-3 space-y-2">{event.videoUrls.map(url=><a key={url} href={url} target="_blank" rel="noreferrer" className="block rounded-xl border p-3 text-sm font-bold text-blue-700">{url}</a>)}</div></div>:null}</div><aside className="rounded-2xl bg-slate-50 p-5"><h2 className="text-sm font-black uppercase tracking-wider text-slate-500">Event information</h2><dl className="mt-4 space-y-4 text-sm"><Info label="Category" value={event.category?.name}/><Info label="Department" value={event.department?.name||"Institution-wide"}/><Info label="Venue" value={event.venue}/><Info label="Status" value={event.publicationStatus}/></dl></aside></div>
    </article>
    {lightbox&&<button aria-label="Close image viewer" onClick={()=>setLightbox(null)} className="fixed inset-0 z-[1000] grid place-items-center bg-black/90 p-5"><img src={lightbox} alt="Event gallery" className="max-h-[92vh] max-w-[92vw] object-contain"/></button>}
  </div>;
}
function Info({label,value}:{label:string;value?:string|null}){return <div><dt className="text-[10px] font-black uppercase tracking-wider text-slate-400">{label}</dt><dd className="mt-1 font-bold text-slate-800">{value||"—"}</dd></div>}
