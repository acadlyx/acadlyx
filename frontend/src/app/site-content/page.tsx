"use client";

import { ChangeEvent, useEffect, useState } from "react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { authedFetch } from "@/lib/auth";

const fallback: any = {
  brand: { siteName: "ACADLYX", tagline: "", logoUrl: "/branding/acadlyx-logo.png", faviconUrl: "" },
  navigation: [],
  pages: {
    about: { eyebrow: "", title: "", description: "", imageUrl: "" },
    team: { eyebrow: "", title: "", description: "", members: [] },
    contact: { eyebrow: "", title: "", description: "" },
  },
  hero: { eyebrow: "", title: "", description: "", primaryCtaLabel: "Login", primaryCtaHref: "/", secondaryCtaLabel: "", secondaryCtaHref: "", dashboardImageUrl: "", dashboardCaption: "" },
  sections: {
    statsEyebrow: "", statsTitle: "", statsDescription: "", stats: [],
    capabilitiesEyebrow: "", capabilitiesTitle: "", capabilitiesDescription: "", features: [],
    rolesEyebrow: "", rolesTitle: "", rolesDescription: "", roles: [],
    ctaEyebrow: "", ctaTitle: "", ctaDescription: "", ctaLabel: "Login", ctaHref: "/",
  },
  contact: { email: "", phone: "", address: "", website: "" },
  footer: { text: "" },
};

export default function SiteContentPage() {
  const [data, setData] = useState<any>(fallback);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    authedFetch<any>("/site-content")
      .then((response) => setData(response.data?.content || fallback))
      .catch((error) => setMessage(error instanceof Error ? error.message : "Unable to load website CMS."));
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
      await authedFetch("/site-content", { method: "PUT", body: JSON.stringify(data) });
      setMessage("Public website content saved and published.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Save failed.");
    } finally {
      setBusy(false);
    }
  }

  async function upload(event: ChangeEvent<HTMLInputElement>, path: string) {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const api = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001/api/v1";
      const response = await fetch(`${api}/site-content/media`, {
        method: "POST",
        headers: { Authorization: `Bearer ${localStorage.getItem("acadlyx_access_token") || ""}` },
        body: form,
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.error?.message || "Upload failed.");
      set(path, body.data.url);
      setMessage("Image uploaded. Save to publish.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <DashboardShell title="Website CMS" subtitle="Control every public page before login" allowedRoles={["INSTITUTION_ADMIN", "MANAGEMENT", "DIRECTOR", "CMS"]}>
      <div className="mx-auto max-w-7xl space-y-5">
        <Header busy={busy} save={save} message={message} />

        <section className="grid gap-5 lg:grid-cols-2">
          <Card title="Branding">
            <div className="space-y-4">
              <Field label="Site name" value={data.brand.siteName} onChange={(v) => set("brand.siteName", v)} />
              <Field label="Tagline" value={data.brand.tagline} onChange={(v) => set("brand.tagline", v)} />
              <ImageField label="ACADLYX logo" value={data.brand.logoUrl} onChange={(v) => set("brand.logoUrl", v)} upload={(e) => upload(e, "brand.logoUrl")} />
              <ImageField label="Favicon" value={data.brand.faviconUrl} onChange={(v) => set("brand.faviconUrl", v)} upload={(e) => upload(e, "brand.faviconUrl")} />
            </div>
          </Card>

          <Card title="Hero">
            <div className="space-y-4">
              <Field label="Eyebrow" value={data.hero.eyebrow} onChange={(v) => set("hero.eyebrow", v)} />
              <Field label="Title" value={data.hero.title} onChange={(v) => set("hero.title", v)} />
              <TextArea label="Description" value={data.hero.description} onChange={(v) => set("hero.description", v)} />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Primary CTA label" value={data.hero.primaryCtaLabel} onChange={(v) => set("hero.primaryCtaLabel", v)} />
                <Field label="Primary CTA href" value={data.hero.primaryCtaHref} onChange={(v) => set("hero.primaryCtaHref", v)} />
                <Field label="Secondary CTA label" value={data.hero.secondaryCtaLabel} onChange={(v) => set("hero.secondaryCtaLabel", v)} />
                <Field label="Secondary CTA href" value={data.hero.secondaryCtaHref} onChange={(v) => set("hero.secondaryCtaHref", v)} />
              </div>
              <ImageField label="Hero visual" value={data.hero.dashboardImageUrl} onChange={(v) => set("hero.dashboardImageUrl", v)} upload={(e) => upload(e, "hero.dashboardImageUrl")} />
              <Field label="Hero visual caption" value={data.hero.dashboardCaption} onChange={(v) => set("hero.dashboardCaption", v)} />
            </div>
          </Card>
        </section>

        <PageEditor title="About page" data={data.pages.about} set={(key: string, value: string) => set(`pages.about.${key}`, value)} upload={(e: ChangeEvent<HTMLInputElement>) => upload(e, "pages.about.imageUrl")} imageKey="imageUrl" />
        <TeamEditor data={data.pages.team} set={(key: string, value: string) => set(`pages.team.${key}`, value)} setMember={(index: number, key: string, value: string) => set(`pages.team.members.${index}.${key}`, value)} add={() => set("pages.team.members", [...(data.pages.team.members || []), { name: "", role: "", bio: "", imageUrl: "" }])} remove={(index: number) => set("pages.team.members", data.pages.team.members.filter((_: unknown, i: number) => i !== index))} upload={(index: number, event: ChangeEvent<HTMLInputElement>) => upload(event, `pages.team.members.${index}.imageUrl`)} />
        <PageEditor title="Contact page" data={data.pages.contact} set={(key: string, value: string) => set(`pages.contact.${key}`, value)} />

        <Card title="Platform sections">
          <div className="space-y-6">
            <TextGroup prefix="sections.stats" title="Stats" data={data.sections} set={set} />
            <TextGroup prefix="sections.capabilities" title="Capabilities" data={data.sections} set={set} />
            <TextGroup prefix="sections.roles" title="Workspaces" data={data.sections} set={set} />
            <TextGroup prefix="sections.cta" title="Final CTA" data={data.sections} set={set} />
          </div>
        </Card>

        <Card title="Public contact & footer">
          <div className="grid gap-4 lg:grid-cols-2">
            {["email", "phone", "address", "website"].map((key) => <Field key={key} label={humanize(key)} value={data.contact[key]} onChange={(v) => set(`contact.${key}`, v)} />)}
            <div className="lg:col-span-2"><TextArea label="Footer text" value={data.footer.text} onChange={(v) => set("footer.text", v)} /></div>
          </div>
        </Card>

        <div className="flex justify-end pb-8"><button onClick={save} disabled={busy} className="rounded-xl bg-blue-600 px-6 py-3 text-sm font-black text-white disabled:opacity-50">{busy ? "Publishing…" : "Save & publish website"}</button></div>
      </div>
    </DashboardShell>
  );
}

function Header({ busy, save, message }: { busy: boolean; save: () => void; message: string }) {
  return <div className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:flex-row sm:items-end sm:justify-between"><div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-600">Public website control</p><h1 className="mt-2 text-2xl font-black">100% CMS-driven external site</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Manage the landing page, About, Team, Contact, navigation, visuals and public copy from this workspace.</p>{message ? <p className="mt-3 text-sm font-bold text-blue-700">{message}</p> : null}</div><button onClick={save} disabled={busy} className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-black text-white disabled:opacity-50">{busy ? "Publishing…" : "Save & publish"}</button></div>;
}

function PageEditor({ title, data, set, upload, imageKey }: any) {
  return <Card title={title}><div className="grid gap-4 lg:grid-cols-2"><Field label="Eyebrow" value={data.eyebrow} onChange={(v) => set("eyebrow", v)} /><Field label="Title" value={data.title} onChange={(v) => set("title", v)} /><div className="lg:col-span-2"><TextArea label="Description" value={data.description} onChange={(v) => set("description", v)} /></div>{imageKey ? <ImageField label="Page image" value={data[imageKey]} onChange={(v) => set(imageKey, v)} upload={upload} /> : null}</div></Card>;
}

function TeamEditor({ data, set, setMember, add, remove, upload }: any) {
  return <Card title="Team page"><div className="grid gap-4 lg:grid-cols-3"><Field label="Eyebrow" value={data.eyebrow} onChange={(v) => set("eyebrow", v)} /><Field label="Title" value={data.title} onChange={(v) => set("title", v)} /><Field label="Description" value={data.description} onChange={(v) => set("description", v)} /></div><div className="mt-5 space-y-4">{(data.members || []).map((member: any, index: number) => <div key={index} className="rounded-2xl border border-slate-200 bg-slate-50 p-5"><div className="flex items-center justify-between"><b className="text-sm">Team member {index + 1}</b><button type="button" onClick={() => remove(index)} className="text-xs font-bold text-red-600">Remove</button></div><div className="mt-4 grid gap-4 lg:grid-cols-2"><Field label="Name" value={member.name} onChange={(v) => setMember(index, "name", v)} /><Field label="Role" value={member.role} onChange={(v) => setMember(index, "role", v)} /><TextArea label="Bio" value={member.bio} onChange={(v) => setMember(index, "bio", v)} /><ImageField label="Photo" value={member.imageUrl} onChange={(v) => setMember(index, "imageUrl", v)} upload={(e) => upload(index, e)} /></div></div>)}</div><button type="button" onClick={add} className="mt-4 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold">+ Add team member</button></Card>;
}

function TextGroup({ prefix, title, data, set }: any) {
  const key = prefix.split(".").pop();
  const source = data;
  return <div className="border-t border-slate-100 pt-5"><h3 className="text-sm font-black">{title}</h3><div className="mt-4 grid gap-4 lg:grid-cols-2">{["Eyebrow", "Title", "Description"].map((label) => { const field = `${key}${label}`; const actual = label === "Eyebrow" ? `${key}Eyebrow` : label === "Title" ? `${key}Title` : `${key}Description`; return <div key={actual} className={label === "Description" ? "lg:col-span-2" : ""}>{label === "Description" ? <TextArea label={label} value={source[actual]} onChange={(v) => set(`${prefix}${label}`, v)} /> : <Field label={label} value={source[actual]} onChange={(v) => set(`${prefix}${label}`, v)} />}</div>; })}</div></div>;
}

function Card({ title, children }: { title: string; children: React.ReactNode }) { return <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="text-xl font-black text-slate-950">{title}</h2><div className="mt-5">{children}</div></section>; }
function humanize(value: string) { return value.replace(/([A-Z])/g, " $1").replace(/^./, (x) => x.toUpperCase()); }
function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label className="block"><span className="text-xs font-black text-slate-600">{label}</span><input value={value || ""} onChange={(e) => onChange(e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" /></label>; }
function TextArea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label className="block"><span className="text-xs font-black text-slate-600">{label}</span><textarea value={value || ""} onChange={(e) => onChange(e.target.value)} rows={4} className="mt-1.5 w-full resize-y rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm leading-6 text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" /></label>; }
function ImageField({ label, value, onChange, upload }: { label: string; value: string; onChange: (value: string) => void; upload: (event: ChangeEvent<HTMLInputElement>) => void }) { return <div><Field label={`${label} URL`} value={value} onChange={onChange} /><input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={upload} className="mt-2 block w-full text-xs text-slate-500" /></div>; }
