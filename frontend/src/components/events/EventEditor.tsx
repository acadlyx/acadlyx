"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createEvent, getEvent, getEventCategories, createEventCategory, updateEvent, uploadEventMedia, addEventMedia, removeEventMedia, reorderEventMedia, type InstitutionalEvent } from "@/lib/eventsApi";

type Props = { eventId?: string };

export function EventEditor({ eventId }: Props) {
  const router = useRouter();
  const [event,setEvent]=useState<InstitutionalEvent|null>(null);
  const [categories,setCategories]=useState<Array<{id:string;name:string}>>([]);
  const [form,setForm]=useState<any>({title:"",categoryId:"",departmentId:"",shortDescription:"",description:"",eventDate:"",startTime:"",endTime:"",venue:"",status:"DRAFT",publicationStatus:"DRAFT",isFeatured:false,highlights:"",tags:"",videoUrls:"",organizers:"",speakers:""});
  const [busy,setBusy]=useState(false); const [message,setMessage]=useState(""); const [newCategory,setNewCategory]=useState("");

  useEffect(()=>{ Promise.all([getEventCategories(), eventId?getEvent(eventId):Promise.resolve(null)]).then(([c,e])=>{
    setCategories(c.data||[]); if(e){setEvent(e.data); setForm((x:any)=>({...x,...e.data,eventDate:e.data.eventDate?.slice(0,10)||"",categoryId:e.data.category?.id||"",highlights:(e.data.highlights||[]).join("\n"),tags:(e.data.tags||[]).join(", "),videoUrls:(e.data.videoUrls||[]).join("\n"),organizers:JSON.stringify(e.data.organizers||[]),speakers:JSON.stringify(e.data.speakers||[])}));}
  }).catch(e=>setMessage(e instanceof Error?e.message:"Unable to load event."));},[eventId]);

  function set(key:string,value:any){setForm((x:any)=>({...x,[key]:value}));}
  function jsonArray(value:string){try{const parsed=JSON.parse(value||"[]"); return Array.isArray(parsed)?parsed:[];}catch{return [];}}

  async function save(publish?:boolean){
    setBusy(true);setMessage("");
    try{
      const payload={...form,categoryId:form.categoryId||null,departmentId:form.departmentId||null,
        eventDate:new Date(form.eventDate+"T00:00:00").toISOString(),highlights:form.highlights.split("\n").map((x:string)=>x.trim()).filter(Boolean),
        tags:form.tags.split(",").map((x:string)=>x.trim()).filter(Boolean),videoUrls:form.videoUrls.split("\n").map((x:string)=>x.trim()).filter(Boolean),
        organizers:jsonArray(form.organizers),speakers:jsonArray(form.speakers),publicationStatus:publish?"PUBLISHED":form.publicationStatus};
      delete payload.media; delete payload.category; delete payload.department; delete payload.id; delete payload.slug; delete payload.createdAt; delete payload.updatedAt; delete payload.publishedAt;
      const response=eventId?await updateEvent(eventId,payload):await createEvent(payload);
      const saved=response.data; setEvent(saved); if(!eventId) router.replace(`/events-gallery/${saved.id}/edit`); else setMessage(publish?"Event published.":"Event saved.");
    }catch(e){setMessage(e instanceof Error?e.message:"Save failed.");}finally{setBusy(false);}
  }

  async function upload(file:File){
    if(!event) return; setBusy(true);setMessage("");
    try{const uploaded=await uploadEventMedia(file); await addEventMedia(event.id,{fileAssetId:uploaded.data.id,url:uploaded.data.url,publicId:uploaded.data.publicId}); const refreshed=await getEvent(event.id);setEvent(refreshed.data);setMessage("Image added to gallery.");}
    catch(e){setMessage(e instanceof Error?e.message:"Upload failed.");}finally{setBusy(false);}
  }
  async function removeMedia(id:string){if(!event)return;setBusy(true);try{await removeEventMedia(id);const refreshed=await getEvent(event.id);setEvent(refreshed.data);}catch(e){setMessage(e instanceof Error?e.message:"Remove failed.");}finally{setBusy(false);}}
  async function moveMedia(index:number,direction:number){if(!event)return;const ids=event.media.map(x=>x.id);const next=index+direction;if(next<0||next>=ids.length)return;[ids[index],ids[next]]=[ids[next],ids[index]];setBusy(true);try{await reorderEventMedia(event.id,ids);const refreshed=await getEvent(event.id);setEvent(refreshed.data);}finally{setBusy(false);}}

  return <div className="mx-auto max-w-6xl space-y-6">
    <div className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:flex-row sm:items-end sm:justify-between">
      <div><p className="text-xs font-black uppercase tracking-[.18em] text-blue-700">Events & Gallery</p><h1 className="mt-2 text-2xl font-black">{eventId?"Edit event":"Create event"}</h1><p className="mt-1 text-sm text-slate-500">Publish institutional activities without leaving the dashboard workspace.</p></div>
      <div className="flex gap-2"><button onClick={()=>router.back()} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold">Back</button><button disabled={busy} onClick={()=>save(false)} className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-black text-white disabled:opacity-50">Save draft</button><button disabled={busy} onClick={()=>save(true)} className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-black text-white disabled:opacity-50">Publish</button></div>
    </div>
    {message&&<div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm font-bold text-blue-800">{message}</div>}
    <section className="grid gap-5 lg:grid-cols-2">
      <Card title="Event information"><div className="grid gap-4 sm:grid-cols-2">
        <Field label="Title" value={form.title} set={(v)=>set("title",v)} wide/><div><Field label="Category" value={form.categoryId} set={(v)=>set("categoryId",v)} select={categories.map(x=>({value:x.id,label:x.name}))}/><div className="mt-2 flex gap-2"><input value={newCategory} onChange={e=>setNewCategory(e.target.value)} placeholder="New category" className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900"/><button type="button" onClick={async()=>{if(!newCategory.trim())return;try{const r=await createEventCategory(newCategory.trim());setCategories(x=>[...x,r.data]);set("categoryId",r.data.id);setNewCategory("");}catch(e){setMessage(e instanceof Error?e.message:"Unable to create category.");}}} className="rounded-lg border px-3 py-2 text-xs font-bold">Add</button></div></div><Field label="Department ID (optional)" value={form.departmentId} set={(v)=>set("departmentId",v)}/><Field label="Event date" value={form.eventDate} set={(v)=>set("eventDate",v)} type="date"/><Field label="Start time" value={form.startTime} set={(v)=>set("startTime",v)}/><Field label="End time" value={form.endTime} set={(v)=>set("endTime",v)}/><Field label="Venue" value={form.venue} set={(v)=>set("venue",v)} wide/><Field label="Short description" value={form.shortDescription} set={(v)=>set("shortDescription",v)} wide/><TextArea label="Detailed description" value={form.description} set={(v)=>set("description",v)}/><TextArea label="Highlights (one per line)" value={form.highlights} set={(v)=>set("highlights",v)}/></div></Card>
      <Card title="Publishing & media"><div className="grid gap-4 sm:grid-cols-2"><Field label="Publication status" value={form.publicationStatus} set={(v)=>set("publicationStatus",v)} select={[{value:"DRAFT",label:"Draft"},{value:"PUBLISHED",label:"Published"},{value:"ARCHIVED",label:"Archived"}]}/><label className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 text-sm font-bold"><input type="checkbox" checked={!!form.isFeatured} onChange={e=>set("isFeatured",e.target.checked)}/> Featured event</label><Field label="Cover image URL" value={form.coverImageUrl||""} set={(v)=>set("coverImageUrl",v)} wide/><TextArea label="Tags (comma separated)" value={form.tags} set={(v)=>set("tags",v)}/><TextArea label="Video links (one per line)" value={form.videoUrls} set={(v)=>set("videoUrls",v)}/><TextArea label="Speakers/guests JSON" value={form.speakers} set={(v)=>set("speakers",v)}/><TextArea label="Organizers JSON" value={form.organizers} set={(v)=>set("organizers",v)}/></div></Card>
    </section>
    {event&&<Card title={`Gallery · ${event.media.length} photos`}><div className="flex flex-wrap gap-3"><label className="cursor-pointer rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-black text-white">Add photos<input hidden type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" multiple onChange={async e=>{for(const file of Array.from(e.target.files||[])) await upload(file);e.currentTarget.value="";}}/></label><span className="self-center text-xs font-semibold text-slate-500">Upload to the existing Cloudinary-backed tenant storage.</span></div><div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">{event.media.map((m,i)=><div key={m.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white"><img src={m.url} alt={m.altText||m.title||"Event photo"} className="aspect-square w-full object-cover"/><div className="flex items-center justify-between gap-2 p-2"><button onClick={()=>moveMedia(i,-1)} className="rounded-lg border px-2 py-1 text-xs font-bold">←</button><button onClick={()=>moveMedia(i,1)} className="rounded-lg border px-2 py-1 text-xs font-bold">→</button><button onClick={()=>removeMedia(m.id)} className="rounded-lg border border-red-200 px-2 py-1 text-xs font-bold text-red-600">Remove</button></div></div>)}</div></Card>}
  </div>;
}

function Card({title,children}:{title:string;children:React.ReactNode}){return <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="text-lg font-black">{title}</h2><div className="mt-5">{children}</div></section>}
function Field({label,value,set,type="text",wide,select}:{label:string;value:string;set:(v:string)=>void;type?:string;wide?:boolean;select?:Array<{value:string;label:string}>}){return <label className={wide?"block sm:col-span-2":"block"}><span className="text-xs font-black text-slate-600">{label}</span>{select?<select value={value||""} onChange={e=>set(e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900">{select.map(x=><option key={x.value} value={x.value}>{x.label}</option>)}</select>:<input type={type} value={value||""} onChange={e=>set(e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900"/>}</label>}
function TextArea({label,value,set}:{label:string;value:string;set:(v:string)=>void}){return <label className="block sm:col-span-2"><span className="text-xs font-black text-slate-600">{label}</span><textarea value={value||""} onChange={e=>set(e.target.value)} rows={4} className="mt-1.5 w-full resize-y rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900"/></label>}
