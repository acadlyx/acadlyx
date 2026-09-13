"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthRequiredError, authedFetch, isAuthenticated, logout, AuthUser } from "@/lib/auth";

type Workspace = { timetable: unknown[]; notices: { id: string; title: string; body: string }[]; notifications: unknown[]; documents: unknown[]; fees: unknown[]; exams: unknown[] };

export function RoleWorkspace({ title, roles }: { title: string; roles: string[] }) {
  const router = useRouter(); const [user, setUser] = useState<AuthUser | null>(null); const [data, setData] = useState<Workspace | null>(null); const [error, setError] = useState("");
  useEffect(() => { if (!isAuthenticated()) { router.replace("/login"); return; } Promise.all([authedFetch<{ data: AuthUser }>("/auth/me"), authedFetch<{ data: Workspace }>("/erp/me/workspace")]).then(([me, workspace]) => { if (!me.data.roles.some(r => roles.includes(r))) { router.replace("/login"); return; } setUser(me.data); setData(workspace.data); }).catch((e: Error) => { if (e instanceof AuthRequiredError) router.replace("/login"); else setError(e.message); }); }, [router, roles]);
  if (error) return <main className="p-8 text-sm text-red-600">{error}</main>;
  if (!data || !user) return <main className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-500">Loading workspace…</main>;
  return <main className="min-h-screen bg-slate-50 p-5 sm:p-8"><div className="mx-auto max-w-6xl"><header className="flex items-center justify-between border-b border-slate-200 pb-5"><div><p className="text-xs font-semibold tracking-widest text-slate-500">ACADLYX ERP</p><h1 className="mt-1 text-2xl font-semibold text-slate-950">{title}</h1><p className="mt-1 text-sm text-slate-500">{user.firstName} {user.lastName}</p></div><button onClick={() => logout().then(() => router.push("/login"))} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">Sign out</button></header><div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[["Today’s timetable", data.timetable.length], ["Notices", data.notices.length], ["Notifications", data.notifications.length], ["Documents", data.documents.length], ["Fees", data.fees.length], ["Exam results", data.exams.length]].map(([label, value]) => <section key={String(label)} className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-sm text-slate-500">{label}</p><p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p></section>)}</div><section className="mt-6 rounded-xl border border-slate-200 bg-white p-5"><h2 className="font-semibold text-slate-900">Current notices</h2>{data.notices.length ? <ul className="mt-3 space-y-3">{data.notices.map(n => <li key={n.id}><p className="text-sm font-medium">{n.title}</p><p className="text-sm text-slate-500">{n.body}</p></li>)}</ul> : <p className="mt-2 text-sm text-slate-500">No notices available.</p>}</section></div></main>;
}
