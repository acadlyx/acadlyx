"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthRequiredError, authedFetch, HttpRequestError } from "@/lib/auth";
import { DashboardShell } from "@/components/dashboard/DashboardShell";

type Skill = { skillId: string; proficiency: number; evidence: string | null; skill: { name: string; category: string | null } };
type Certification = { id: string; name: string; issuer: string | null };
type Project = { id: string; title: string; description: string | null; projectUrl: string | null };
type Resume = { id: string; url: string; fileName: string | null; isCurrent: boolean };
type Data = { profile: { portfolioUrl: string | null; githubUrl: string | null; linkedInUrl: string | null; bio: string | null } | null; skills: Skill[]; certifications: Certification[]; projects: Project[]; resumes: Resume[] };

export default function StudentPlacementProfilePage() {
  const router = useRouter();
  const [data,setData]=useState<Data|null>(null);
  const [error,setError]=useState("");
  const [busy,setBusy]=useState("");
  const [loading,setLoading]=useState(true);

  function reportError(error: unknown, fallback: string) {
    if (error instanceof AuthRequiredError) {
      router.replace("/login");
      return;
    }
    setError(error instanceof HttpRequestError ? error.message : fallback);
  }

  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await authedFetch<{data:Data}>("/placements/profile");
      setData(response.data);
    } catch (error) {
      reportError(error, "Unable to load placement profile.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(()=>{void load();}, []);
  async function saveProfile(form:HTMLFormElement){setBusy("profile");try{const fd=new FormData(form);await authedFetch("/placements/profile",{method:"PATCH",body:JSON.stringify({portfolioUrl:fd.get("portfolioUrl")||null,githubUrl:fd.get("githubUrl")||null,linkedInUrl:fd.get("linkedInUrl")||null,bio:fd.get("bio")||null})});await load();}catch(e){reportError(e, "Unable to save profile.");}finally{setBusy("");}}
  async function saveSkill(skill:Skill){setBusy(skill.skillId);try{await authedFetch("/placements/profile/skills/"+skill.skillId,{method:"PUT",body:JSON.stringify({proficiency:skill.proficiency,evidence:skill.evidence||null})});await load();}catch(e){reportError(e, "Unable to save skill.");}finally{setBusy("");}}
  async function addCertification(form:HTMLFormElement){setBusy("cert");try{const fd=new FormData(form);await authedFetch("/placements/profile/certifications",{method:"POST",body:JSON.stringify({name:fd.get("name"),issuer:fd.get("issuer")||undefined,credentialUrl:fd.get("credentialUrl")||undefined})});form.reset();await load();}catch(e){reportError(e, "Unable to add certification.");}finally{setBusy("");}}
  async function addProject(form:HTMLFormElement){setBusy("project");try{const fd=new FormData(form);await authedFetch("/placements/profile/projects",{method:"POST",body:JSON.stringify({title:fd.get("title"),description:fd.get("description")||undefined,projectUrl:fd.get("projectUrl")||undefined,technologies:String(fd.get("technologies")||"").split(",").map(x=>x.trim()).filter(Boolean)})});form.reset();await load();}catch(e){reportError(e, "Unable to add project.");}finally{setBusy("");}}
  async function addResume(form:HTMLFormElement){setBusy("resume");try{const fd=new FormData(form);await authedFetch("/placements/profile/resumes",{method:"POST",body:JSON.stringify({url:fd.get("url"),fileName:fd.get("fileName")||undefined})});form.reset();await load();}catch(e){reportError(e, "Unable to add resume.");}finally{setBusy("");}}
  return <DashboardShell title="My Placement Profile" subtitle="Student-owned professional placement information; academic eligibility remains institution-controlled." allowedRoles={["STUDENT"]}>
    <div className="mx-auto max-w-6xl space-y-6">
      {error&&<div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}<button type="button" onClick={()=>void load()} disabled={loading} className="ml-3 underline disabled:opacity-50">Retry</button></div>}
      {loading&&!data&&<div role="status" className="rounded-2xl border bg-white p-6 text-sm text-slate-500">Loading your placement profile…</div>}
      {!loading&&data&&data.skills.length===0&&data.certifications.length===0&&data.projects.length===0&&data.resumes.length===0&&!data.profile&&<p className="rounded-2xl border bg-white p-6 text-sm text-slate-500">Your placement profile is empty. Add your professional details below.</p>}
      <form onSubmit={e=>{e.preventDefault();void saveProfile(e.currentTarget)}} className="rounded-3xl border bg-white p-6">
        <h2 className="text-xl font-black">Professional profile</h2><p className="mt-1 text-sm text-slate-500">Portfolio, GitHub, LinkedIn and bio are editable by you.</p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <input name="portfolioUrl" defaultValue={data?.profile?.portfolioUrl||""} placeholder="Portfolio URL" className="rounded-xl border px-4 py-3"/>
          <input name="githubUrl" defaultValue={data?.profile?.githubUrl||""} placeholder="GitHub URL" className="rounded-xl border px-4 py-3"/>
          <input name="linkedInUrl" defaultValue={data?.profile?.linkedInUrl||""} placeholder="LinkedIn URL" className="rounded-xl border px-4 py-3"/>
        </div><textarea name="bio" defaultValue={data?.profile?.bio||""} placeholder="Professional summary" className="mt-3 min-h-28 w-full rounded-xl border px-4 py-3"/>
        <button disabled={busy==="profile"} className="mt-3 rounded-xl bg-slate-950 px-4 py-2 text-sm font-black text-white">{busy==="profile"?"Saving…":"Save profile"}</button>
      </form>
      <section className="rounded-3xl border bg-white p-6"><h2 className="text-xl font-black">Skills</h2><p className="mt-1 text-sm text-slate-500">Only institution-approved skills can be added; academic eligibility fields are not editable here.</p><div className="mt-4 space-y-3">{data?.skills.map(s=><div key={s.skillId} className="rounded-2xl border p-4"><div className="flex flex-wrap justify-between gap-2"><div><p className="font-black">{s.skill.name}</p><p className="text-xs text-slate-500">{s.skill.category||"Skill"}</p></div><span className="text-sm font-black">{s.proficiency}/100</span></div><input type="range" min="0" max="100" value={s.proficiency} onChange={e=>setData(d=>d?{...d,skills:d.skills.map(x=>x.skillId===s.skillId?{...x,proficiency:Number(e.target.value)}:x)}:d)} className="mt-3 w-full"/><button onClick={()=>void saveSkill(s)} disabled={busy===s.skillId} className="mt-2 rounded-lg border px-3 py-2 text-xs font-black">{busy===s.skillId?"Saving…":"Save skill"}</button></div>)}</div></section>
      <section className="grid gap-6 lg:grid-cols-2">
        <form onSubmit={e=>{e.preventDefault();void addCertification(e.currentTarget)}} className="rounded-3xl border bg-white p-6"><h2 className="text-xl font-black">Add certification</h2><div className="mt-4 space-y-3"><input name="name" required placeholder="Certification name" className="w-full rounded-xl border px-4 py-3"/><input name="issuer" placeholder="Issuer" className="w-full rounded-xl border px-4 py-3"/><input name="credentialUrl" type="url" placeholder="Credential URL" className="w-full rounded-xl border px-4 py-3"/></div><button disabled={busy==="cert"} className="mt-3 rounded-xl bg-slate-950 px-4 py-2 text-sm font-black text-white">Add certification</button><div className="mt-4 space-y-2">{data?.certifications.map(x=><div key={x.id} className="rounded-xl border p-3 text-sm"><b>{x.name}</b>{x.issuer&&" · "+x.issuer}</div>)}</div></form>
        <form onSubmit={e=>{e.preventDefault();void addProject(e.currentTarget)}} className="rounded-3xl border bg-white p-6"><h2 className="text-xl font-black">Add project</h2><div className="mt-4 space-y-3"><input name="title" required placeholder="Project title" className="w-full rounded-xl border px-4 py-3"/><input name="technologies" placeholder="Technologies, comma separated" className="w-full rounded-xl border px-4 py-3"/><input name="projectUrl" type="url" placeholder="Project URL" className="w-full rounded-xl border px-4 py-3"/><textarea name="description" placeholder="Project description" className="min-h-24 w-full rounded-xl border px-4 py-3"/></div><button disabled={busy==="project"} className="mt-3 rounded-xl bg-slate-950 px-4 py-2 text-sm font-black text-white">Add project</button><div className="mt-4 space-y-2">{data?.projects.map(x=><div key={x.id} className="rounded-xl border p-3 text-sm"><b>{x.title}</b>{x.description&&<p className="mt-1 text-slate-500">{x.description}</p>}</div>)}</div></form>
      </section>
      <form onSubmit={e=>{e.preventDefault();void addResume(e.currentTarget)}} className="rounded-3xl border bg-white p-6"><h2 className="text-xl font-black">Resume</h2><div className="mt-4 grid gap-3 md:grid-cols-2"><input name="url" type="url" required placeholder="Secure resume URL" className="rounded-xl border px-4 py-3"/><input name="fileName" placeholder="File name" className="rounded-xl border px-4 py-3"/></div><button disabled={busy==="resume"} className="mt-3 rounded-xl bg-slate-950 px-4 py-2 text-sm font-black text-white">Set current resume</button><div className="mt-4 space-y-2">{data?.resumes.map(x=><a key={x.id} href={x.url} target="_blank" rel="noreferrer" className="block rounded-xl border p-3 text-sm font-bold">{x.fileName||"Resume"} {x.isCurrent?"· CURRENT":""}</a>)}</div></form>
    </div>
  </DashboardShell>;
}
