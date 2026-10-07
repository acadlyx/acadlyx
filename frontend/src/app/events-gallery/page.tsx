"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getCurrentUser, type AuthUser } from "@/lib/auth";
import { listEvents, type InstitutionalEvent } from "@/lib/eventsApi";

export default function EventsGalleryPage() {
  const [user,setUser]=useState<AuthUser|null>(null);
  const [events,setEvents]=useState<InstitutionalEvent[]>([]);
  const [busy,setBusy]=useState(true);
  const [error,setError]=useState("");
  const [search,setSearch]=useState("");
  const [status,setStatus]=useState("");

  const load=async()=>{setBusy(true);setError("");try{const response=await listEvents({search,status:status||undefined,page:1,pageSize:24});setEvents(response.data||[]);}catch(e){setError(e instanceof Error?e.message:"Unable to load events.");}finally{setBusy(false);}};
  useEffect(()=>{getCurrentUser({background:true}).then(setUser).catch(()=>{});load();},[]);
  useEffect(()=>{const t=setTimeout(load,250);return()=>clearTimeout(t);},[status]);

  const canManage=!!user?.permissions.includes("events.manage");
  return <div className="mx-auto max-w-7xl space-y-6">
    <header className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm lg:flex-row lg:items-end lg:justify-between">
      <div><p className="text-xs font-black uppercase tracking-[.18em] text-blue-700">Institutional showcase</p><h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">Events & Gallery</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Discover college events, workshops, seminars, achievements, competitions and the visual story of your institution.</p></div>
      {canManage&&<Link href="/events-gallery/new" className="rounded-xl bg-blue-600 px-5 py-3 text-center text-sm font-black text-white">+ Create Event</Link>}
    </header>
    <section className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row"><input value={search} onChange={e=>setSearch(e.target.value)} onKeyDown={e=>e.key==="Enter"&&load()} placeholder="Search events…" className="min-w-0 flex-1 rounded-xl border border-slate-300 px-4 py-2.5 text-sm text-slate-900"/>{canManage&&<select value={status} onChange={e=>setStatus(e.target.value)} className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-slate-900"><option value="">All status</option><option value="DRAFT">Draft</option><option value="PUBLISHED">Published</option><option value="ARCHIVED">Archived</option></select>}<button onClick={load} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold">Search</button></section>
    {error&&<div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">{error}</div>}
    {busy?<div className="rounded-3xl border border-slate-200 bg-white p-12 text-center text-sm font-semibold text-slate-500">Loading events…</div>:events.length===0?<div className="rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center"><p className="text-lg font-black text-slate-900">No events found</p><p className="mt-2 text-sm text-slate-500">{canManage?"Create the institution's first event or adjust your filters.":"Published institutional events will appear here."}</p></div>:
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{events.map(event=><Link key={event.id} href={`/events-gallery/${event.id}`} className="group overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg">
        <div className="relative aspect-[16/10] overflow-hidden bg-slate-100">{event.coverImageUrl?<img src={event.coverImageUrl} alt={event.title} className="h-full w-full object-cover transition duration-300 group-hover:scale-105"/>:event.media[0]?<img src={event.media[0].url} alt={event.title} className="h-full w-full object-cover transition duration-300 group-hover:scale-105"/>:<div className="grid h-full place-items-center text-sm font-black text-slate-400">ACADLYX EVENT</div>}<div className="absolute left-3 top-3 flex gap-2">{event.isFeatured&&<span className="rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-black text-amber-800">Featured</span>}{canManage&&<span className="rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-black text-slate-700">{event.publicationStatus}</span>}</div></div>
        <div className="p-5"><div className="flex items-center justify-between gap-3 text-[11px] font-bold text-slate-500"><span>{new Date(event.eventDate).toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"})}</span><span>{event.media.length} photos</span></div><h2 className="mt-2 text-lg font-black text-slate-950">{event.title}</h2><p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-500">{event.shortDescription||event.description||"Institutional event"}</p><div className="mt-4 flex flex-wrap gap-2">{event.category&&<span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-black text-blue-700">{event.category.name}</span>}{event.department&&<span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black text-slate-600">{event.department.code}</span>}</div></div>
      </Link>)}</div>}
  </div>;
}
