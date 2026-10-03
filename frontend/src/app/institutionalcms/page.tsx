"use client";

import { useEffect, useState } from "react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { authedFetch } from "@/lib/auth";

const roles = ["superadmin", "admin", "management", "hod", "faculty", "student", "parent"];

const fallback = {
  brand: { acadlyxLogoUrl: "/branding/acadlyx-logo.png", institutionLogoUrl: "", institutionName: "" },
  dashboard: {
    welcome: "Welcome back",
    overviewTitle: "Institution overview",
    overviewSubtitle: "Your authorized institutional workspace.",
    emptyState: "No data is available for this view yet.",
    loadingLabel: "Loading workspace",
    saveLabel: "Save changes",
    navigationLabel: "Workspace navigation",
  },
  workspaces: {},
  messages: {
    noticesTitle: "Notices",
    announcementsTitle: "Announcements",
    upcomingTitle: "Upcoming",
    recentActivityTitle: "Recent activity",
    quickActionsTitle: "Quick actions",
  },
};

export default function InstitutionalCmsPage() {
  const [data, setData] = useState<any>(fallback);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    authedFetch<any>("/institutional-cms")
      .then((response) => setData(response.data?.content || fallback))
      .catch((error) => setMessage(error instanceof Error ? error.message : "Unable to load institutional CMS."));
  }, []);

  function set(path: string, value: unknown) {
    setData((current: any) => {
      const next = structuredClone(current);
      const parts = path.split(".");
      let cursor = next;
      for (let i = 0; i < parts.length - 1; i += 1) cursor = cursor[parts[i]];
      cursor[parts[parts.length - 1]] = value;
      return next;
    });
  }

  async function save() {
    setBusy(true);
    setMessage("");
    try {
      await authedFetch("/institutional-cms", { method: "PUT", body: JSON.stringify(data) });
      setMessage("Institutional dashboard content published.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Save failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <DashboardShell title="Institutional CMS" subtitle="Control institutional dashboard branding and copy" allowedRoles={["INSTITUTION_ADMIN", "MANAGEMENT", "DIRECTOR", "CMS"]}>
      <div className="mx-auto max-w-7xl space-y-5">
        <div className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-600">Dashboard content control</p>
            <h1 className="mt-2 text-2xl font-black text-slate-950">Institutional CMS</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Edit the words, labels and tenant branding used throughout authenticated workspaces. Structure and permissions remain controlled by the application.</p>
          </div>
          <button onClick={save} disabled={busy} className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-black text-white disabled:opacity-50">{busy ? "Publishing…" : "Save & publish"}</button>
        </div>

        {message ? <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-800">{message}</div> : null}

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <SectionTitle title="Dashboard branding" description="These assets are shown in the authenticated dashboard header." />
          <div className="mt-5 grid gap-5 lg:grid-cols-3">
            <Field label="ACADLYX logo URL" value={data.brand.acadlyxLogoUrl} onChange={(v) => set("brand.acadlyxLogoUrl", v)} />
            <Field label="Institution logo URL" value={data.brand.institutionLogoUrl} onChange={(v) => set("brand.institutionLogoUrl", v)} />
            <Field label="Institution display name" value={data.brand.institutionName} onChange={(v) => set("brand.institutionName", v)} />
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <SectionTitle title="Global dashboard copy" description="Common copy used by workspace shells and shared dashboard components." />
          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            {Object.entries(data.dashboard).map(([key, value]) => (
              <Field key={key} label={humanize(key)} value={String(value ?? "")} onChange={(v) => set(`dashboard.${key}`, v)} />
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <SectionTitle title="Shared module labels" description="Edit common titles used by notices, announcements, activity and action areas." />
          <div className="mt-5 grid gap-5 lg:grid-cols-3">
            {Object.entries(data.messages).map(([key, value]) => (
              <Field key={key} label={humanize(key)} value={String(value ?? "")} onChange={(v) => set(`messages.${key}`, v)} />
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <SectionTitle title="Workspace-specific copy" description="Set titles, subtitles, descriptions and empty states per role without changing application code." />
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {roles.map((role) => {
              const value = data.workspaces?.[role] || {};
              return (
                <article key={role} className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                  <h3 className="text-sm font-black uppercase tracking-[0.12em] text-slate-700">{role}</h3>
                  <div className="mt-4 space-y-3">
                    {["title", "subtitle", "welcome", "description", "emptyState"].map((key) => (
                      <Field key={key} label={humanize(key)} value={String(value[key] ?? "")} onChange={(v) => set(`workspaces.${role}.${key}`, v)} />
                    ))}
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <div className="flex justify-end pb-8">
          <button onClick={save} disabled={busy} className="rounded-xl bg-blue-600 px-6 py-3 text-sm font-black text-white disabled:opacity-50">{busy ? "Publishing…" : "Save & publish"}</button>
        </div>
      </div>
    </DashboardShell>
  );
}

function humanize(value: string) {
  return value.replace(/([A-Z])/g, " $1").replace(/^./, (x) => x.toUpperCase());
}

function SectionTitle({ title, description }: { title: string; description: string }) {
  return <div><h2 className="text-xl font-black text-slate-950">{title}</h2><p className="mt-1 text-sm leading-6 text-slate-500">{description}</p></div>;
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="text-xs font-black text-slate-600">{label}</span>
      <input value={value || ""} onChange={(event) => onChange(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
    </label>
  );
}
