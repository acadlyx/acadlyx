"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { AuthRequiredError } from "@/lib/auth";
import { getMyNotifications, markAllNotificationsRead, markNotificationRead, PortalNotification } from "@/lib/portalApi";

type NotificationData = Awaited<ReturnType<typeof getMyNotifications>>;

function when(value: string) {
  return new Date(value).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function StudentNotificationsPage() {
  const router = useRouter();
  const [data, setData] = useState<NotificationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updating, setUpdating] = useState<string | null>(null);

  const load = useCallback((page = 1) => {
    setLoading(true); setError("");
    getMyNotifications(page, 20).then(setData).catch((reason: Error) => {
      if (reason instanceof AuthRequiredError) router.replace("/login"); else setError(reason.message || "Unable to load notifications.");
    }).finally(() => setLoading(false));
  }, [router]);

  useEffect(() => { load(); }, [load]);

  const updateOne = async (item: PortalNotification) => {
    if (item.readAt) return;
    setUpdating(item.id);
    try {
      await markNotificationRead(item.id);
      setData((current) => current ? { ...current, unread: Math.max(0, current.unread - 1), items: current.items.map((entry) => entry.id === item.id ? { ...entry, readAt: new Date().toISOString() } : entry) } : current);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to update notification."); }
    finally { setUpdating(null); }
  };

  const markAll = async () => {
    setUpdating("all");
    try {
      await markAllNotificationsRead();
      setData((current) => current ? { ...current, unread: 0, items: current.items.map((entry) => ({ ...entry, readAt: entry.readAt || new Date().toISOString() })) } : current);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to update notifications."); }
    finally { setUpdating(null); }
  };

  return <DashboardShell title="Notifications" subtitle="Institutional updates addressed to you" allowedRoles={["STUDENT"]}>
    <main className="mx-auto max-w-4xl space-y-4">
      {loading && <div className="space-y-3"><div className="h-16 animate-pulse rounded-lg bg-slate-200" /><div className="h-32 animate-pulse rounded-lg bg-slate-200" /></div>}
      {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}<button onClick={() => load(data?.pagination.page)} className="ml-3 font-semibold underline">Retry</button></div>}
      {!loading && data && <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <header className="flex items-center justify-between gap-4 border-b border-slate-100 p-4"><div><h1 className="font-semibold text-slate-900">Inbox</h1><p className="text-sm text-slate-500">{data.unread} unread notification{data.unread === 1 ? "" : "s"}</p></div><button disabled={!data.unread || updating === "all"} onClick={markAll} className="rounded-md border border-indigo-200 px-3 py-2 text-sm font-medium text-indigo-700 disabled:cursor-not-allowed disabled:opacity-50">{updating === "all" ? "Updating…" : "Mark all read"}</button></header>
        {data.items.length ? <div className="divide-y divide-slate-100">{data.items.map((item) => <article key={item.id} className={`p-5 ${item.readAt ? "bg-white" : "bg-indigo-50/40"}`}><div className="flex items-start justify-between gap-4"><div><h2 className="font-medium text-slate-900">{item.title}</h2><p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{item.body}</p><time className="mt-2 block text-xs text-slate-400">{when(item.createdAt)}</time></div>{!item.readAt && <button disabled={updating === item.id} onClick={() => updateOne(item)} className="shrink-0 text-sm font-medium text-indigo-700 disabled:opacity-50">{updating === item.id ? "Saving…" : "Mark read"}</button>}</div></article>)}</div> : <p className="p-8 text-center text-sm text-slate-500">You have no notifications.</p>}
        {data.pagination.totalPages > 1 && <footer className="flex items-center justify-between border-t border-slate-100 p-4 text-sm"><button disabled={data.pagination.page <= 1} onClick={() => load(data.pagination.page - 1)} className="font-medium text-indigo-700 disabled:text-slate-400">Previous</button><span className="text-slate-500">Page {data.pagination.page} of {data.pagination.totalPages}</span><button disabled={data.pagination.page >= data.pagination.totalPages} onClick={() => load(data.pagination.page + 1)} className="font-medium text-indigo-700 disabled:text-slate-400">Next</button></footer>}
      </section>}
    </main>
  </DashboardShell>;
}
