"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { AuthRequiredError } from "@/lib/auth";
import { getNotifications, markAllNotificationsRead, markNotificationRead, type ErpNotification } from "@/lib/erpApi";

export default function NotificationsPage() {
  const router = useRouter();
  const [items, setItems] = useState<ErpNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  async function load(targetPage = page) {
    setLoading(true);
    setError("");
    try {
      const result = await getNotifications(targetPage, 25);
      setItems(result.items);
      setUnread(result.unread);
      setTotalPages(result.pagination?.totalPages ?? 1);
      setPage(result.pagination?.page ?? targetPage);
    } catch (e) {
      if (e instanceof AuthRequiredError) router.replace("/login");
      else setError(e instanceof Error ? e.message : "Unable to load notifications.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(1); }, []);

  async function read(id: string) {
    setBusy(id);
    setError("");
    try {
      await markNotificationRead(id, true);
      await load(page);
    } catch (e) {
      if (e instanceof AuthRequiredError) router.replace("/login");
      else setError(e instanceof Error ? e.message : "Unable to update notification.");
    } finally {
      setBusy("");
    }
  }

  async function readAll() {
    setBusy("all");
    setError("");
    try {
      await markAllNotificationsRead();
      await load(page);
    } catch (e) {
      if (e instanceof AuthRequiredError) router.replace("/login");
      else setError(e instanceof Error ? e.message : "Unable to mark notifications as read.");
    } finally {
      setBusy("");
    }
  }

  return (
    <DashboardShell title="Notification Center" subtitle="Messages, workflow changes and actions that matter to you">
      <main className="mx-auto max-w-5xl space-y-5 pb-10">
        <section className="rounded-3xl border bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[.18em] text-slate-400">Inbox</p>
              <h1 className="mt-1 text-3xl font-black">Notifications</h1>
              <p className="mt-2 text-sm text-slate-500">{unread} unread notification{unread === 1 ? "" : "s"}</p>
            </div>
            <button type="button" onClick={() => void readAll()} disabled={!unread || !!busy} className="rounded-xl bg-slate-950 px-4 py-2 text-xs font-black text-white disabled:opacity-40">
              {busy === "all" ? "Updating…" : "Mark all read"}
            </button>
          </div>
        </section>

        {error && <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}

        <section aria-busy={loading} className="space-y-2">
          {loading ? (
            [1, 2, 3].map((item) => <div key={item} className="h-24 animate-pulse rounded-2xl bg-slate-100" />)
          ) : items.length ? (
            items.map((notification) => (
              <button
                key={notification.id}
                type="button"
                disabled={!!busy}
                onClick={() => void read(notification.id)}
                className={"w-full rounded-2xl border p-5 text-left shadow-sm disabled:opacity-60 " + (notification.readAt ? "bg-white" : "border-slate-300 bg-slate-50")}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="font-black">{notification.title}</h2>
                    <p className="mt-1 text-sm leading-6 text-slate-600">{notification.body}</p>
                  </div>
                  {!notification.readAt && <span aria-label="Unread" className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-slate-950" />}
                </div>
                <p className="mt-3 text-[10px] font-bold uppercase text-slate-400">{new Date(notification.createdAt).toLocaleString()}</p>
              </button>
            ))
          ) : (
            <div className="rounded-3xl border border-dashed p-10 text-center text-sm text-slate-500">You are all caught up.</div>
          )}
        </section>

        <div className="flex items-center justify-between rounded-2xl border bg-white p-4">
          <button type="button" disabled={loading || page <= 1 || !!busy} onClick={() => void load(page - 1)} className="rounded-lg border px-3 py-2 text-sm font-bold disabled:opacity-40">Previous</button>
          <span className="text-sm text-slate-600">Page {page} / {totalPages}</span>
          <button type="button" disabled={loading || page >= totalPages || !!busy} onClick={() => void load(page + 1)} className="rounded-lg border px-3 py-2 text-sm font-bold disabled:opacity-40">Next</button>
        </div>
      </main>
    </DashboardShell>
  );
}
