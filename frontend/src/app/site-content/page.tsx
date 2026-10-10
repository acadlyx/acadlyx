"use client";

import { ChangeEvent, useEffect, useState } from "react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { authedFetch } from "@/lib/auth";

type CmsTeamMember = { name: string; role: string; bio: string; imageUrl: string };
type CmsPage = { eyebrow: string; title: string; description: string; imageUrl?: string };
type CmsTeamPage = CmsPage & { members: CmsTeamMember[] };
type CmsCollectionItem = { title: string; description: string; meta: string; imageUrl: string; linkUrl: string };
type CmsCollectionPage = CmsPage & { items: CmsCollectionItem[] };
type CmsSections = {
  statsEyebrow: string; statsTitle: string; statsDescription: string; stats: string[];
  capabilitiesEyebrow: string; capabilitiesTitle: string; capabilitiesDescription: string; features: string[];
  rolesEyebrow: string; rolesTitle: string; rolesDescription: string; roles: string[];
  ctaEyebrow: string; ctaTitle: string; ctaDescription: string; ctaLabel: string; ctaHref: string;
};
type CmsData = {
  brand: { siteName: string; tagline: string; logoUrl: string; faviconUrl: string };
  navigation: Array<{ label: string; href: string }>;
  pages: { about: CmsPage; team: CmsTeamPage; partners: CmsCollectionPage; updates: CmsCollectionPage; contact: CmsPage };
  hero: {
    eyebrow: string; title: string; description: string;
    primaryCtaLabel: string; primaryCtaHref: string;
    secondaryCtaLabel: string; secondaryCtaHref: string;
    dashboardImageUrl: string; dashboardCaption: string;
  };
  sections: CmsSections;
  contact: { email: string; phone: string; address: string; website: string };
  footer: { text: string };
};

const fallback: CmsData = {
  brand: { siteName: "ACADLYX", tagline: "", logoUrl: "/branding/acadlyx-logo.png", faviconUrl: "" },
  navigation: [],
  pages: {
    about: { eyebrow: "", title: "", description: "", imageUrl: "" },
    team: { eyebrow: "", title: "", description: "", members: [] },
    partners: { eyebrow: "", title: "", description: "", items: [] },
    updates: { eyebrow: "", title: "", description: "", items: [] },
    contact: { eyebrow: "", title: "", description: "", imageUrl: "" },
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
  const [data, setData] = useState<CmsData>(fallback);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    authedFetch<{ data?: { content?: CmsData } }>("/site-content")
      .then((response) => setData(response.data?.content || fallback))
      .catch((error) => setMessage(error instanceof Error ? error.message : "Unable to load website CMS."));
  }, []);

  function set(path: string, value: unknown) {
    setData((current) => {
      const next = structuredClone(current) as CmsData;
      const parts = path.split(".");
      let cursor: Record<string, unknown> = next as unknown as Record<string, unknown>;
      for (let i = 0; i < parts.length - 1; i += 1) {
        const child = cursor[parts[i]];
        if (!child || typeof child !== "object" || Array.isArray(child)) return current;
        cursor = child as Record<string, unknown>;
      }
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
      const response = await authedFetch<{ data: { url: string } }>("/site-content/media", {
        method: "POST",
        body: form,
      });
      
      set(path, response.data.url);
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

        <Card title="Website navigation">
          <p className="mb-4 text-sm text-slate-500">Edit the public menu labels and destinations. Keep destinations on trusted site routes unless an external URL is intentional.</p>
          <div className="space-y-3">
            {data.navigation.map((item, index) => (
              <div key={index} className="grid gap-3 rounded-xl border border-slate-200 p-4 sm:grid-cols-2">
                <Field label={`Menu label ${index + 1}`} value={item.label} onChange={(value) => set(`navigation.${index}.label`, value)} />
                <Field label={`Destination ${index + 1}`} value={item.href} onChange={(value) => set(`navigation.${index}.href`, value)} />
                <div className="sm:col-span-2 flex justify-end">
                  <button type="button" onClick={() => set("navigation", data.navigation.filter((_, itemIndex) => itemIndex !== index))} className="rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-700">Remove item</button>
                </div>
              </div>
            ))}
            <button type="button" onClick={() => set("navigation", [...data.navigation, { label: "", href: "/" }])} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700">Add menu item</button>
          </div>
        </Card>

        <PageEditor title="About page" data={data.pages.about} set={(key: string, value: string) => set(`pages.about.${key}`, value)} upload={(e: ChangeEvent<HTMLInputElement>) => upload(e, "pages.about.imageUrl")} imageKey="imageUrl" />
        <CollectionPageEditor title="Our Partners page" data={data.pages.partners} set={(key, value) => set(`pages.partners.${key}`, value)} setItem={(index, key, value) => set(`pages.partners.items.${index}.${key}`, value)} add={() => set("pages.partners.items", [...data.pages.partners.items, { title: "", description: "", meta: "", imageUrl: "", linkUrl: "" }])} remove={(index) => set("pages.partners.items", data.pages.partners.items.filter((_, itemIndex) => itemIndex !== index))} upload={(index, event) => upload(event, `pages.partners.items.${index}.imageUrl`)} />
        <CollectionPageEditor title="Updates page" data={data.pages.updates} set={(key, value) => set(`pages.updates.${key}`, value)} setItem={(index, key, value) => set(`pages.updates.items.${index}.${key}`, value)} add={() => set("pages.updates.items", [...data.pages.updates.items, { title: "", description: "", meta: "", imageUrl: "", linkUrl: "" }])} remove={(index) => set("pages.updates.items", data.pages.updates.items.filter((_, itemIndex) => itemIndex !== index))} upload={(index, event) => upload(event, `pages.updates.items.${index}.imageUrl`)} />
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
            {(["email", "phone", "address", "website"] as Array<keyof CmsData["contact"]>).map((key) => <Field key={key} label={humanize(key)} value={data.contact[key]} onChange={(v) => set(`contact.${key}`, v)} />)}
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

function PageEditor({ title, data, set, upload, imageKey }: { title: string; data: CmsPage; set: (key: string, value: string) => void; upload?: (event: ChangeEvent<HTMLInputElement>) => void; imageKey?: string }) {
  return <Card title={title}><div className="grid gap-4 lg:grid-cols-2"><Field label="Eyebrow" value={data.eyebrow} onChange={(v) => set("eyebrow", v)} /><Field label="Title" value={data.title} onChange={(v) => set("title", v)} /><div className="lg:col-span-2"><TextArea label="Description" value={data.description} onChange={(v) => set("description", v)} /></div>{imageKey ? <ImageField label="Page image" value={imageKey === "imageUrl" ? (data.imageUrl ?? "") : ""} onChange={(v) => set(imageKey, v)} upload={upload} /> : null}</div></Card>;
}

function CollectionPageEditor({ title, data, set, setItem, add, remove, upload }: { title: string; data: CmsCollectionPage; set: (key: string, value: string) => void; setItem: (index: number, key: string, value: string) => void; add: () => void; remove: (index: number) => void; upload: (index: number, event: ChangeEvent<HTMLInputElement>) => void }) {
  return <Card title={title}>
    <div className="grid gap-4 lg:grid-cols-2"><Field label="Eyebrow" value={data.eyebrow} onChange={(value) => set("eyebrow", value)} /><Field label="Title" value={data.title} onChange={(value) => set("title", value)} /><div className="lg:col-span-2"><TextArea label="Description" value={data.description} onChange={(value) => set("description", value)} /></div></div>
    <div className="mt-5 space-y-4">{(data.items || []).map((item, index) => <div key={index} className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
      <div className="flex items-center justify-between"><b className="text-sm">Item {index + 1}</b><button type="button" onClick={() => remove(index)} className="text-xs font-bold text-red-600">Remove</button></div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2"><Field label="Name / title" value={item.title} onChange={(value) => setItem(index, "title", value)} /><Field label="Category / date" value={item.meta} onChange={(value) => setItem(index, "meta", value)} /><div className="lg:col-span-2"><TextArea label="Description" value={item.description} onChange={(value) => setItem(index, "description", value)} /></div><ImageField label="Image or logo" value={item.imageUrl} onChange={(value) => setItem(index, "imageUrl", value)} upload={(event) => upload(index, event)} /><Field label="Website / article link" value={item.linkUrl} onChange={(value) => setItem(index, "linkUrl", value)} /></div>
    </div>)}</div>
    <button type="button" onClick={add} className="mt-4 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold">+ Add item</button>
  </Card>;
}

function TeamEditor({ data, set, setMember, add, remove, upload }: { data: CmsTeamPage; set: (key: string, value: string) => void; setMember: (index: number, key: string, value: string) => void; add: () => void; remove: (index: number) => void; upload: (index: number, event: ChangeEvent<HTMLInputElement>) => void }) {
  return <Card title="Team page"><div className="grid gap-4 lg:grid-cols-3"><Field label="Eyebrow" value={data.eyebrow} onChange={(v) => set("eyebrow", v)} /><Field label="Title" value={data.title} onChange={(v) => set("title", v)} /><Field label="Description" value={data.description} onChange={(v) => set("description", v)} /></div><div className="mt-5 space-y-4">{(data.members || []).map((member, index) => <div key={index} className="rounded-2xl border border-slate-200 bg-slate-50 p-5"><div className="flex items-center justify-between"><b className="text-sm">Team member {index + 1}</b><button type="button" onClick={() => remove(index)} className="text-xs font-bold text-red-600">Remove</button></div><div className="mt-4 grid gap-4 lg:grid-cols-2"><Field label="Name" value={member.name} onChange={(v) => setMember(index, "name", v)} /><Field label="Role" value={member.role} onChange={(v) => setMember(index, "role", v)} /><TextArea label="Bio" value={member.bio} onChange={(v) => setMember(index, "bio", v)} /><ImageField label="Photo" value={member.imageUrl} onChange={(v) => setMember(index, "imageUrl", v)} upload={(e) => upload(index, e)} /></div></div>)}</div><button type="button" onClick={add} className="mt-4 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold">+ Add team member</button></Card>;
}

function TextGroup({ prefix, title, data, set }: { prefix: string; title: string; data: CmsSections; set: (path: string, value: string) => void }) {
  const key = prefix.split(".").pop();
  const source = data as unknown as Record<string, string | string[]>;
  return <div className="border-t border-slate-100 pt-5"><h3 className="text-sm font-black">{title}</h3><div className="mt-4 grid gap-4 lg:grid-cols-2">{["Eyebrow", "Title", "Description"].map((label) => { const actual = label === "Eyebrow" ? `${key}Eyebrow` : label === "Title" ? `${key}Title` : `${key}Description`; const value = typeof source[actual] === "string" ? source[actual] : ""; return <div key={actual} className={label === "Description" ? "lg:col-span-2" : ""}>{label === "Description" ? <TextArea label={label} value={value} onChange={(v) => set(`${prefix}${label}`, v)} /> : <Field label={label} value={value} onChange={(v) => set(`${prefix}${label}`, v)} />}</div>; })}</div></div>;
}

function Card({ title, children }: { title: string; children: React.ReactNode }) { return <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="text-xl font-black text-slate-950">{title}</h2><div className="mt-5">{children}</div></section>; }
function humanize(value: string) { return value.replace(/([A-Z])/g, " $1").replace(/^./, (x) => x.toUpperCase()); }
function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label className="block"><span className="text-xs font-black text-slate-600">{label}</span><input value={value || ""} onChange={(e) => onChange(e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" /></label>; }
function TextArea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label className="block"><span className="text-xs font-black text-slate-600">{label}</span><textarea value={value || ""} onChange={(e) => onChange(e.target.value)} rows={4} className="mt-1.5 w-full resize-y rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm leading-6 text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" /></label>; }
function ImageField({ label, value, onChange, upload }: { label: string; value: string; onChange: (value: string) => void; upload?: (event: ChangeEvent<HTMLInputElement>) => void }) { return <div><Field label={`${label} URL`} value={value} onChange={onChange} /><input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={upload} disabled={!upload} className="mt-2 block w-full text-xs text-slate-500" /></div>; }
