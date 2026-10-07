"use client";

import { useEffect, useState } from "react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { AuthRequiredError, authedFetch, clearTokens, getCurrentUser } from "@/lib/auth";
import { useRouter } from "next/navigation";

type CmsData = {
  id?: string;
  institutionId: string;
  content: Record<string, unknown>;
  draftContent: Record<string, unknown> | null;
  approvalStatus: "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED" | "PUBLISHED";
  rejectionReason: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  publishedAt: string | null;
};

function readString(source: Record<string, unknown>, section: string, key: string): string {
  const value = source[section];
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  const field = (value as Record<string, unknown>)[key];
  return typeof field === "string" ? field : "";
}

function setString(source: Record<string, unknown>, section: string, key: string, value: string): Record<string, unknown> {
  const current = source[section];
  const sectionValue = current && typeof current === "object" && !Array.isArray(current) ? { ...(current as Record<string, unknown>) } : {};
  sectionValue[key] = value;
  return { ...source, [section]: sectionValue };
}

export default function InstitutionalCmsPage() {
  const router = useRouter();
  const [data, setData] = useState<CmsData | null>(null);
  const [draft, setDraft] = useState<Record<string, unknown>>({});
  const [roleNames, setRoleNames] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const canApprove = roleNames.some(role => ["CHAIRMAN", "DIRECTOR", "MANAGEMENT"].includes(role));
  const isManager = roleNames.some(role => ["INSTITUTION_ADMIN"].includes(role));

  async function load() {
    setError("");
    try {
      const user = await getCurrentUser();
      setRoleNames(user.roles);
      const response = await authedFetch<{ success: true; data: CmsData }>("/institutional-cms");
      setData(response.data);
      setDraft(response.data.draftContent ?? response.data.content);
    } catch (err) {
      if (err instanceof AuthRequiredError) {
        clearTokens();
        router.replace("/login");
        return;
      }
      setError(err instanceof Error ? err.message : "Unable to load institutional CMS.");
    }
  }

  useEffect(() => { void load(); }, []);

  async function saveDraft() {
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await authedFetch<{ success: true; data: CmsData }>("/institutional-cms", {
        method: "PUT",
        body: JSON.stringify({ content: draft }),
      });
      setData(response.data);
      setDraft(response.data.draftContent ?? draft);
      setMessage("Draft saved. Submit it for institutional approval before it becomes active.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save draft.");
    } finally { setBusy(false); }
  }

  async function submit() {
    setBusy(true); setError(""); setMessage("");
    try {
      await authedFetch("/institutional-cms/submit", { method: "POST" });
      setMessage("CMS change submitted for approval.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to submit CMS change.");
    } finally { setBusy(false); }
  }

  async function approve() {
    setBusy(true); setError(""); setMessage("");
    try {
      await authedFetch("/institutional-cms/approve", { method: "POST" });
      setMessage("Institutional CMS change approved and published.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to approve CMS change.");
    } finally { setBusy(false); }
  }

  async function reject() {
    const reason = window.prompt("Reason for rejection:");
    if (!reason?.trim()) return;
    setBusy(true); setError(""); setMessage("");
    try {
      await authedFetch("/institutional-cms/reject", {
        method: "POST",
        body: JSON.stringify({ reason }),
      });
      setMessage("CMS change rejected with the recorded reason.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to reject CMS change.");
    } finally { setBusy(false); }
  }

  if (!data) {
    return <DashboardShell title="Institutional CMS" subtitle="Institution identity and approved dashboard configuration"><div className="rounded-2xl border bg-white p-6">{error || "Loading institutional configuration…"}</div></DashboardShell>;
  }

  const status = data.approvalStatus;
  return (
    <DashboardShell title="Institutional CMS" subtitle="Manage tenant branding and dashboard identity through controlled approval">
      <div className="mx-auto max-w-5xl space-y-6">
        {message && <div className="rounded-xl border bg-white p-4 text-sm">{message}</div>}
        {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>}

        <section className="rounded-2xl border bg-white p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Approval state</p>
              <h2 className="mt-1 text-xl font-semibold">{status}</h2>
              {data.rejectionReason && <p className="mt-2 text-sm text-red-700">Rejection reason: {data.rejectionReason}</p>}
            </div>
            <div className="flex flex-wrap gap-2">
              {isManager && <button disabled={busy} onClick={saveDraft} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Save draft</button>}
              {isManager && (status === "DRAFT" || status === "REJECTED") && <button disabled={busy} onClick={submit} className="rounded-xl border px-4 py-2 text-sm font-semibold disabled:opacity-50">Submit for approval</button>}
              {canApprove && status === "SUBMITTED" && <><button disabled={busy} onClick={approve} className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Approve & publish</button><button disabled={busy} onClick={reject} className="rounded-xl border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 disabled:opacity-50">Reject</button></>}
            </div>
          </div>
        </section>

        {isManager ? (
          <section className="grid gap-5 md:grid-cols-2">
            <div className="rounded-2xl border bg-white p-6">
              <h2 className="font-semibold">Institution branding</h2>
              <div className="mt-4 space-y-4">
                <label className="block text-sm font-medium">Institution name<input className="mt-1 w-full rounded-xl border px-3 py-2" value={readString(draft, "brand", "institutionName")} onChange={e => setDraft(current => setString(current, "brand", "institutionName", e.target.value))} /></label>
                <label className="block text-sm font-medium">Institution logo URL<input className="mt-1 w-full rounded-xl border px-3 py-2" value={readString(draft, "brand", "institutionLogoUrl")} onChange={e => setDraft(current => setString(current, "brand", "institutionLogoUrl", e.target.value))} /></label>
                <label className="block text-sm font-medium">Primary color<input className="mt-1 w-full rounded-xl border px-3 py-2" value={readString(draft, "brand", "primaryColor")} onChange={e => setDraft(current => setString(current, "brand", "primaryColor", e.target.value))} placeholder="#123456" /></label>
                <label className="block text-sm font-medium">Secondary color<input className="mt-1 w-full rounded-xl border px-3 py-2" value={readString(draft, "brand", "secondaryColor")} onChange={e => setDraft(current => setString(current, "brand", "secondaryColor", e.target.value))} placeholder="#abcdef" /></label>
              </div>
            </div>
            <div className="rounded-2xl border bg-white p-6">
              <h2 className="font-semibold">Dashboard identity</h2>
              <div className="mt-4 space-y-4">
                <label className="block text-sm font-medium">Welcome text<input className="mt-1 w-full rounded-xl border px-3 py-2" value={readString(draft, "dashboard", "welcome")} onChange={e => setDraft(current => setString(current, "dashboard", "welcome", e.target.value))} /></label>
                <label className="block text-sm font-medium">Overview title<input className="mt-1 w-full rounded-xl border px-3 py-2" value={readString(draft, "dashboard", "overviewTitle")} onChange={e => setDraft(current => setString(current, "dashboard", "overviewTitle", e.target.value))} /></label>
                <label className="block text-sm font-medium">Overview subtitle<textarea className="mt-1 min-h-24 w-full rounded-xl border px-3 py-2" value={readString(draft, "dashboard", "overviewSubtitle")} onChange={e => setDraft(current => setString(current, "dashboard", "overviewSubtitle", e.target.value))} /></label>
              </div>
            </div>
          </section>
        ) : (
          <section className="rounded-2xl border bg-white p-6">
            <h2 className="font-semibold">Review</h2>
            <p className="mt-2 text-sm text-slate-600">Leadership review is limited to submitted changes. Published institutional configuration remains the active source of truth until approval.</p>
          </section>
        )}
      </div>
    </DashboardShell>
  );
}
