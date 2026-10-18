"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getNotifications, listNotices, type ErpNotification, type ErpNotice } from "@/lib/erpApi";
import { listEvents, type InstitutionalEvent } from "@/lib/eventsApi";

type UpdateItem = {
  id: string;
  kind: "Notification" | "Notice" | "Event";
  title: string;
  description: string;
  date: string | null;
  href: string;
  unread?: boolean;
};

function safeInternalHref(value: string | null | undefined): string {
  if (value && value.startsWith("/") && !value.startsWith("//")) return value;
  return "/notifications";
}

function formatDate(value: string | null): string {
  if (!value) return "Date not provided";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date not provided";
  return date.toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function summarize(value: string, max = 160): string {
  const text = value.trim().replace(/\s+/g, " ");
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function notificationItem(item: ErpNotification): UpdateItem {
  return {
    id: `notification:${item.id}`,
    kind: "Notification",
    title: item.title,
    description: summarize(item.body),
    date: item.createdAt || null,
    href: safeInternalHref(item.actionUrl),
    unread: !item.readAt,
  };
}

function noticeItem(item: ErpNotice): UpdateItem {
  return {
    id: `notice:${item.id}`,
    kind: "Notice",
    title: item.title,
    description: summarize(item.body),
    date: item.publishedAt || null,
    href: "/notices",
  };
}

function eventItem(item: InstitutionalEvent): UpdateItem {
  return {
    id: `event:${item.id}`,
    kind: "Event",
    title: item.title,
    description: summarize(item.shortDescription || item.description || "Institutional event"),
    date: item.publishedAt || null,
    href: `/events-gallery/${encodeURIComponent(item.id)}`,
  };
}

export function RecentUpdatesPanel() {
  const [items, setItems] = useState<UpdateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [failedSources, setFailedSources] = useState<string[]>([]);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.allSettled([
      getNotifications(1, 8),
      listNotices(false),
      listEvents({ status: "PUBLISHED", page: 1, pageSize: 8 }),
    ]).then((results) => {
      if (!active) return;
      const [notificationsResult, noticesResult, eventsResult] = results;
      const next: UpdateItem[] = [];
      const failed: string[] = [];

      if (notificationsResult.status === "fulfilled") {
        next.push(...notificationsResult.value.items.map(notificationItem));
      } else {
        failed.push("notifications");
      }

      if (noticesResult.status === "fulfilled") {
        next.push(...noticesResult.value.map(noticeItem));
      } else {
        failed.push("notices");
      }

      if (eventsResult.status === "fulfilled") {
        next.push(...eventsResult.value.data.filter((event) => event.publicationStatus === "PUBLISHED").map(eventItem));
      } else {
        failed.push("events");
      }

      next.sort((left, right) => {
        const leftTime = left.date ? new Date(left.date).getTime() : 0;
        const rightTime = right.date ? new Date(right.date).getTime() : 0;
        return (Number.isNaN(rightTime) ? 0 : rightTime) - (Number.isNaN(leftTime) ? 0 : leftTime);
      });
      setItems(next.slice(0, 8));
      setFailedSources(failed);
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [reloadKey]);

  return (
    <section aria-labelledby="recent-updates-title" className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-700">Institutional feed</p>
          <h2 id="recent-updates-title" className="mt-1 text-lg font-extrabold text-slate-900">Recent updates</h2>
          <p className="mt-1 text-sm text-slate-500">Published notices, events and your notifications from ACADLYX.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/notices" className="inline-flex min-h-9 items-center justify-center rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700 hover:border-emerald-500">Notices</Link>
          <Link href="/notifications" className="inline-flex min-h-9 items-center justify-center rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700 hover:border-emerald-500">Notifications</Link>
          <Link href="/events-gallery" className="inline-flex min-h-9 items-center justify-center rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700 hover:border-emerald-500">Events</Link>
        </div>
      </div>

      {loading ? (
        <div role="status" className="mt-4 space-y-3">
          <span className="sr-only">Loading recent institutional updates…</span>
          {[1, 2, 3].map((item) => <div key={item} className="h-16 animate-pulse rounded-xl bg-slate-100" />)}
        </div>
      ) : items.length ? (
        <div className="mt-4 divide-y divide-slate-100">
          {items.map((item) => (
            <article key={item.id} className="flex flex-col gap-2 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-start">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-slate-600">{item.kind}</span>
                  {item.unread ? <span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-black text-emerald-800">Unread</span> : null}
                </div>
                <h3 className="mt-2 text-sm font-bold text-slate-900">{item.title}</h3>
                <p className="mt-1 whitespace-pre-line break-words text-sm leading-5 text-slate-600">{item.description}</p>
                <p className="mt-2 text-xs text-slate-400">{formatDate(item.date)}</p>
              </div>
              <Link href={item.href} className="inline-flex min-h-9 shrink-0 items-center justify-center self-start rounded-lg px-3 py-2 text-xs font-bold text-emerald-800 ring-1 ring-emerald-200 hover:bg-emerald-50">
                View details
              </Link>
            </article>
          ))}
        </div>
      ) : (
        <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center">
          <p className="text-sm font-bold text-slate-800">No updates available to display.</p>
          <p className="mt-1 text-xs text-slate-500">{failedSources.length === 3 ? "The update services could not be reached for this session." : "Published notices, events and notifications will appear here when available."}</p>
          {failedSources.length ? <button type="button" onClick={() => setReloadKey((value) => value + 1)} className="mt-3 min-h-9 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700">Retry feed</button> : null}
        </div>
      )}
      {!loading && items.length > 0 && failedSources.length > 0 ? <p role="status" className="mt-3 text-xs text-slate-500">Some update sources were unavailable: {failedSources.join(", ")}.</p> : null}
    </section>
  );
}
