"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { AuthRequiredError, authedFetch, getCurrentUser } from "@/lib/auth";

type Workspace = any;
type Paged<T> = { success: boolean; data: T[]; meta: { page: number; pageSize: number; total: number; totalPages: number } };

export default function CourseWorkspacePage() {
  const params = useParams<{ offeringId: string }>();
  const router = useRouter();
  const id = params.offeringId;
  const [data,setData]=useState<Workspace|null>(null);
  const [analytics,setAnalytics]=useState<any>(null);
  const [gradebook,setGradebook]=useState<Paged<any>|null>(null);
  const [discussions,setDiscussions]=useState<Paged<any>|null>(null);
  const [tab,setTab]=useState("overview");
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const [canManage,setCanManage]=useState(false);
  const [moduleTitle,setModuleTitle]=useState("");
  const [lessonTitle,setLessonTitle]=useState("");
  const [lessonContent,setLessonContent]=useState("");
  const [resourceLessonId,setResourceLessonId]=useState("");
  const [resourceFile,setResourceFile]=useState<File|null>(null);
  const [quizTitle,setQuizTitle]=useState("");
  const [questionPrompt,setQuestionPrompt]=useState("");
  const [questionType,setQuestionType]=useState("SINGLE_CHOICE");

  const load=useCallback(async()=>{
    setBusy(true);setError("");
    try {
      const user=await getCurrentUser();
      setCanManage(user.permissions.includes("lms.manage")); setError("");
      const [workspace,a,d]=await Promise.all([
        authedFetch<{success:boolean;data:Workspace}>(`/lms/offerings/${id}/workspace`),
        authedFetch<{success:boolean;data:any}>(`/lms/offerings/${id}/analytics`),
        authedFetch<Paged<any>>(`/lms/offerings/${id}/discussions?page=1&pageSize=50`)
      ]);
      setData(workspace.data);setAnalytics(a.data);setDiscussions(d);
    } catch(e) {
      if(e instanceof AuthRequiredError){router.replace("/login");return;}
      setError(e instanceof Error?e.message:"Unable to load course workspace");
    } finally {setBusy(false);}
  },[id,router]);

  useEffect(()=>{void load();},[load]);

  async function action(actionName:string,body:any={}) {
    setBusy(true);setError("");setNotice("");
    try { await authedFetch(`/lms/offerings/${id}/workflow`,{method:"POST",body:JSON.stringify({action:actionName,...body})}); await load(); setNotice(`Course ${actionName.toLowerCase()}d successfully.`); }
    catch(e){setError(e instanceof Error?e.message:"Action failed");} finally{setBusy(false);}
  }

  async function addDiscussion(body:string,parentId?:string) {
    if(!body.trim())return;
    try {await authedFetch(`/lms/offerings/${id}/discussions`,{method:"POST",body:JSON.stringify({body,parentId})}); await load();setNotice("Discussion posted.");}
    catch(e){setError(e instanceof Error?e.message:"Unable to post discussion");}
  }

  async function loadGradebook(page:number) {
    try {const r=await authedFetch<Paged<any>>(`/lms/offerings/${id}/gradebook?page=${page}&pageSize=25`);setGradebook(r);}
    catch(e){setError(e instanceof Error?e.message:"Gradebook unavailable");}
  }

  if(!data) return <DashboardShell title="Course Workspace" subtitle="Loading course workspace"><div className="rounded-2xl bg-white p-8">{busy?"Loading…":error||"Course not available."}</div></DashboardShell>;

  const wf=data.workflow?.status||"DRAFT";
  const tabs=["overview","content","assignments","assessments","gradebook","discussions","live classes","announcements"];
  return <DashboardShell title={data.offering.course?.name || data.offering.course?.code || "Course Workspace"} subtitle="Canonical Course Offering workspace — content, assessment, collaboration and academic evidence in one place.">
    <div className="mx-auto max-w-7xl space-y-5">
      {error&&<div role="alert" className="rounded-xl bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div>}
      {notice&&<div role="status" className="rounded-xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">{notice}</div>}
      <section className="rounded-3xl border bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div><p className="text-xs font-black uppercase tracking-widest text-slate-500">Course state</p><div className="mt-2 flex flex-wrap items-center gap-2"><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black">{wf}</span><span className="text-sm text-slate-500">{data.offering.section?.name || ""}</span></div></div>
          <div className="flex flex-wrap gap-2">
            {wf==="DRAFT"||wf==="REJECTED"?<button disabled={busy} onClick={()=>void action("SUBMIT")} className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white">Submit for approval</button>:null}
            {wf==="PENDING_APPROVAL"?<><button disabled={busy} onClick={()=>void action("APPROVE")} className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-bold text-white">Approve</button><button disabled={busy} onClick={()=>void action("REJECT",{reason:"Returned for academic revision"})} className="rounded-xl border px-4 py-2 text-sm font-bold">Reject</button></>:null}
            {wf==="APPROVED"?<button disabled={busy} onClick={()=>void action("PUBLISH")} className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white">Publish</button>:null}
            {wf==="PUBLISHED"?<button disabled={busy} onClick={()=>void action("ARCHIVE")} className="rounded-xl border px-4 py-2 text-sm font-bold">Archive</button>:null}
            {wf==="ARCHIVED"?<button disabled={busy} onClick={()=>void action("REOPEN")} className="rounded-xl border px-4 py-2 text-sm font-bold">Reopen</button>:null}
          </div>
        </div>
      </section>

      <nav className="flex gap-2 overflow-x-auto rounded-2xl border bg-white p-2">{tabs.map(t=><button key={t} onClick={()=>{setTab(t);if(t==="gradebook")void loadGradebook(1)}} className={`whitespace-nowrap rounded-xl px-4 py-2 text-sm font-bold ${tab===t?"bg-slate-950 text-white":"text-slate-600"}`}>{t}</button>)}</nav>

      {tab==="overview"&&<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Learners",analytics?.rosterSize??0],
          ["Modules",analytics?.content?.modules??0],
          ["Lessons",analytics?.content?.lessons??0],
          ["Published modules",analytics?.content?.publishedModules??0],
          ["Assignments",analytics?.assignments??0],
          ["Quizzes",analytics?.quizzes?.quizzes??0],
          ["Quiz avg",Math.round(analytics?.quizzes?.avgScore??0)+"%"],
          ["Exam avg",Math.round(analytics?.examinations?.avg??0)+"%"]
        ].map(([k,v])=><div key={String(k)} className="rounded-2xl border bg-white p-5"><p className="text-xs font-black uppercase text-slate-500">{k}</p><p className="mt-2 text-2xl font-black text-slate-950">{v}</p></div>)}
      </div>}

      {tab==="content"&&<section className="space-y-4">
        {canManage&&<section className="rounded-2xl border border-dashed bg-white p-5">
          <h2 className="font-black">Course Builder</h2>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <input value={moduleTitle} onChange={e=>setModuleTitle(e.target.value)} placeholder="Module title" className="rounded-xl border p-3"/>
            <button disabled={busy||!moduleTitle.trim()} onClick={async()=>{try{setBusy(true);await authedFetch("/lms/modules",{method:"POST",body:JSON.stringify({courseOfferingId:id,title:moduleTitle.trim()})});setModuleTitle("");await load();}catch(e){setError(e instanceof Error?e.message:"Unable to create module");}finally{setBusy(false)}}} className="rounded-xl bg-slate-950 px-4 py-3 text-sm font-bold text-white disabled:opacity-40">Add module</button>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <input value={lessonTitle} onChange={e=>setLessonTitle(e.target.value)} placeholder="Lesson title" className="rounded-xl border p-3"/>
            <input value={lessonContent} onChange={e=>setLessonContent(e.target.value)} placeholder="Lesson content" className="rounded-xl border p-3"/>
            <select value={resourceLessonId} onChange={e=>setResourceLessonId(e.target.value)} className="rounded-xl border p-3"><option value="">Select lesson for file</option>{data.modules?.flatMap((m:any)=>m.lessons||[]).map((l:any)=><option key={l.id} value={l.id}>{l.title}</option>)}</select>
            <input type="file" onChange={e=>setResourceFile(e.target.files?.[0]||null)} className="rounded-xl border p-3"/>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button disabled={busy||!lessonTitle.trim()||!data.modules?.[0]?.id} onClick={async()=>{try{setBusy(true);await authedFetch("/lms/lessons",{method:"POST",body:JSON.stringify({courseModuleId:data.modules[0].id,title:lessonTitle.trim(),content:lessonContent||undefined})});setLessonTitle("");setLessonContent("");await load();}catch(e){setError(e instanceof Error?e.message:"Unable to create lesson");}finally{setBusy(false)}}} className="rounded-xl border px-4 py-2 text-sm font-bold">Add lesson to first module</button>
            <button disabled={busy||!resourceLessonId||!resourceFile} onClick={async()=>{try{setBusy(true);const f=new FormData();f.append("file",resourceFile as File);f.append("module","lms");const uploaded=await authedFetch<{success:boolean;data:any}>("/files",{method:"POST",body:f});const resource=await authedFetch<{success:boolean;data:any}>(`/lms/lessons/${resourceLessonId}/resources`,{method:"POST",body:JSON.stringify({title:(resourceFile as File).name,url:uploaded.data.url,resourceType:"FILE"})});await authedFetch(`/lms/resources/${resource.data.id}/file`,{method:"POST",body:JSON.stringify({fileAssetId:uploaded.data.id})});setResourceFile(null);await load();}catch(e){setError(e instanceof Error?e.message:"Unable to upload resource");}finally{setBusy(false)}}} className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-40">Upload resource</button>
          </div>
        </section>}
        {data.modules?.map((m:any)=><article key={m.id} className="rounded-2xl border bg-white p-5"><div className="flex justify-between gap-3"><div><h2 className="font-black">{m.sequence}. {m.title}</h2><p className="text-sm text-slate-500">{m.description}</p></div><span className="text-xs font-bold">{m.isPublished?"Published":"Draft"}</span></div><div className="mt-4 space-y-2">{m.lessons?.map((l:any)=><div key={l.id} className="rounded-xl bg-slate-50 p-4"><div className="flex justify-between"><span className="font-bold">{l.title}</span><span className="text-xs text-slate-500">{l.contentType}</span></div>{l.content&&<p className="mt-2 text-sm text-slate-600 whitespace-pre-wrap">{l.content}</p>}{l.resources?.map((r:any)=><div key={r.id} className="mt-2 flex justify-between rounded-lg border bg-white p-2 text-xs"><span>{r.title}</span>{r.fileUrl?<a className="font-bold underline" href={r.fileUrl} target="_blank" rel="noreferrer">Open file</a>:<a className="font-bold underline" href={r.url} target="_blank" rel="noreferrer">Open link</a>}</div>)}</div>)}</div></article>)}</section>}

      {tab==="assignments"&&<section className="grid gap-4 md:grid-cols-2">{data.assignments?.map((a:any)=><article key={a.id} className="rounded-2xl border bg-white p-5"><div className="flex justify-between"><h3 className="font-black">{a.title}</h3><span className="text-xs font-bold">{a.status}</span></div><p className="mt-2 text-sm text-slate-600">{a.description}</p><p className="mt-3 text-xs text-slate-500">Due {new Date(a.dueDate).toLocaleString()} · {a.maxMarks} marks</p><button onClick={()=>router.push("/"+(location.pathname.includes("/student/")?"student":"faculty")+"/assignments")} className="mt-4 rounded-xl border px-3 py-2 text-sm font-bold">Open assignment lifecycle</button></article>)}</section>}

      {tab==="assessments"&&<section className="space-y-3">
        {canManage&&<section className="rounded-2xl border border-dashed bg-white p-5">
          <h2 className="font-black">Quiz Builder & Question Bank</h2>
          <div className="mt-3 grid gap-3 md:grid-cols-2"><input value={quizTitle} onChange={e=>setQuizTitle(e.target.value)} placeholder="Quiz title" className="rounded-xl border p-3"/><button disabled={busy||!quizTitle.trim()} onClick={async()=>{try{setBusy(true);await authedFetch("/lms/quizzes",{method:"POST",body:JSON.stringify({courseOfferingId:id,title:quizTitle.trim(),gradingMode:"AUTO"})});setQuizTitle("");await load();}catch(e){setError(e instanceof Error?e.message:"Unable to create quiz");}finally{setBusy(false)}}} className="rounded-xl bg-slate-950 px-4 py-3 text-sm font-bold text-white">Create quiz</button></div>
          <div className="mt-4 grid gap-3 md:grid-cols-3"><select value={questionType} onChange={e=>setQuestionType(e.target.value)} className="rounded-xl border p-3"><option>SINGLE_CHOICE</option><option>MULTIPLE_CHOICE</option><option>TRUE_FALSE</option><option>SHORT_ANSWER</option><option>LONG_ANSWER</option></select><input value={questionPrompt} onChange={e=>setQuestionPrompt(e.target.value)} placeholder="Question prompt" className="rounded-xl border p-3 md:col-span-2"/></div>
          <button disabled={busy||!questionPrompt.trim()} onClick={async()=>{try{setBusy(true);await authedFetch("/lms/questions",{method:"POST",body:JSON.stringify({questionType,prompt:questionPrompt.trim(),courseOfferingId:id,defaultMarks:1,difficulty:"MEDIUM"})});setQuestionPrompt("");setNotice("Question added to the course question bank.");}catch(e){setError(e instanceof Error?e.message:"Unable to create question");}finally{setBusy(false)}}} className="mt-3 rounded-xl border px-4 py-2 text-sm font-bold">Add question</button>
        </section>}
        {data.quizzes?.map((q:any)=><article key={q.id} className="rounded-2xl border bg-white p-5"><div className="flex flex-wrap justify-between gap-2"><div><h3 className="font-black">{q.title}</h3><p className="text-sm text-slate-500">{q.description||"Quiz"} · {q.totalMarks} marks · {q.attemptsAllowed} attempt(s)</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold">{q.status}</span></div></article>)}</section>}

      {tab==="gradebook"&&<section className="rounded-2xl border bg-white p-5">{!gradebook?<p className="text-sm text-slate-500">Loading gradebook…</p>:<><div className="overflow-x-auto"><table className="min-w-full text-sm"><thead><tr className="border-b text-left"><th className="p-3">Student</th><th className="p-3">Assignments</th><th className="p-3">Internal marks</th><th className="p-3">Quizzes</th><th className="p-3">Exams</th></tr></thead><tbody>{gradebook.data.map((s:any)=><tr key={s.studentId} className="border-b"><td className="p-3 font-bold">{s.firstName} {s.lastName}</td><td className="p-3">{s.assignments?.reduce((n:number,a:any)=>n+(a.marksAwarded||0),0)}</td><td className="p-3">{s.internalMarks?.reduce((n:number,m:any)=>n+m.marksObtained,0)}</td><td className="p-3">{Math.round(s.quizzes?.score||0)} / {Math.round(s.quizzes?.max||0)}</td><td className="p-3">{s.examinations?.reduce((n:number,e:any)=>n+e.marks,0)}</td></tr>)}</tbody></table></div><div className="mt-4 flex gap-2"><button disabled={gradebook.meta.page<=1} onClick={()=>void loadGradebook(gradebook.meta.page-1)} className="rounded-lg border px-3 py-2">Previous</button><span className="px-3 py-2 text-sm">Page {gradebook.meta.page} / {gradebook.meta.totalPages}</span><button disabled={gradebook.meta.page>=gradebook.meta.totalPages} onClick={()=>void loadGradebook(gradebook.meta.page+1)} className="rounded-lg border px-3 py-2">Next</button></div></>}</section>}

      {tab==="discussions"&&<section className="space-y-4"><DiscussionComposer onPost={addDiscussion}/>{discussions?.data.map((d:any)=><article key={d.id} className="rounded-2xl border bg-white p-5"><p className="text-sm font-bold">{d.firstName} {d.lastName}</p><p className="mt-2 whitespace-pre-wrap text-slate-700">{d.body}</p><p className="mt-2 text-xs text-slate-500">{new Date(d.createdAt).toLocaleString()}</p></article>)}</section>}

      {tab==="live classes"&&<section className="space-y-3">{data.liveClasses?.map((c:any)=><article key={c.id} className="rounded-2xl border bg-white p-5"><div className="flex justify-between"><h3 className="font-black">{c.title}</h3><span className="text-xs font-bold">{c.status}</span></div><p className="text-sm text-slate-500">{new Date(c.startsAt).toLocaleString()} → {new Date(c.endsAt).toLocaleString()}</p>{c.meetingUrl&&<a className="mt-3 inline-block font-bold underline" href={c.meetingUrl} target="_blank" rel="noreferrer">Join meeting</a>}</article>)}</section>}

      {tab==="announcements"&&<section className="space-y-3">{data.announcements?.map((n:any)=><article key={n.id} className="rounded-2xl border bg-white p-5"><p className="text-xs font-black uppercase text-slate-500">{n.audience}</p><h3 className="mt-1 font-black">{n.title}</h3><p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{n.body}</p></article>)}</section>}
    </div>
  </DashboardShell>;
}

function DiscussionComposer({onPost}:{onPost:(body:string)=>Promise<void>}) {
  const [body,setBody]=useState("");
  return <div className="rounded-2xl border bg-white p-5"><textarea value={body} onChange={e=>setBody(e.target.value)} placeholder="Start a course discussion…" className="min-h-24 w-full rounded-xl border p-3 text-sm"/><button onClick={()=>{void onPost(body);setBody("")}} className="mt-3 rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white">Post discussion</button></div>;
}
