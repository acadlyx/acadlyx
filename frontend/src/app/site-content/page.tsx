"use client";

import { ChangeEvent, useEffect, useState } from "react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { authedFetch } from "@/lib/auth";

type CmsTeamMember = { name: string; role: string; bio: string; imageUrl: string };
type CmsPage = { eyebrow: string; title: string; description: string; imageUrl?: string };
type CmsTeamPage = CmsPage & { members: CmsTeamMember[] };
type CmsCollectionItem = { title: string; description: string; meta: string; imageUrl: string; linkUrl: string };
type CmsCollectionPage = CmsPage & { items: CmsCollectionItem[] };
type CmsProductSection = { id: string; visible: boolean; title: string; body: string; imageUrl: string; imageAlt: string; layout: "statement" | "split" };
type CmsProductPage = { seo: { title: string; description: string }; title: string; introduction: string; sections: CmsProductSection[]; media: Array<{ url: string; alt: string; caption: string }> };
type CmsSections = {
  statsEyebrow: string; statsTitle: string; statsDescription: string; stats: string[];
  capabilitiesEyebrow: string; capabilitiesTitle: string; capabilitiesDescription: string; features: Array<{ eyebrow: string; title: string; text: string }>;
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
  productPage: CmsProductPage;
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
  hero: { eyebrow: "", title: "Admissions, academics and finance, connected to the student record.", description: "ACADLYX is an Education ERP for colleges and universities. It connects student information with the academic, administrative and financial workflows used across an institution.", primaryCtaLabel: "Learn More About ACADLYX", primaryCtaHref: "/about-acadlyx", secondaryCtaLabel: "", secondaryCtaHref: "", dashboardImageUrl: "", dashboardCaption: "" },
  sections: {
    statsEyebrow: "", statsTitle: "", statsDescription: "", stats: [],
    capabilitiesEyebrow: "", capabilitiesTitle: "The work that keeps an institution running.", capabilitiesDescription: "Admissions, student records, teaching activity, attendance, examinations and finance depend on the same institutional information. ACADLYX keeps those workflows in context.", features: [{ eyebrow: "", title: "Admissions and enrolment", text: "Review applications, record admission decisions and carry student information into the academic record." }, { eyebrow: "", title: "Academic operations", text: "Manage programmes, courses, sections, timetables and the records used by academic departments and faculty." }, { eyebrow: "", title: "Attendance and examinations", text: "Keep attendance, assessments, examination schedules and results connected to the student’s academic journey." }, { eyebrow: "", title: "Fees and finance", text: "Coordinate fee structures, collections, concessions and the supporting work of finance teams." }],
    rolesEyebrow: "", rolesTitle: "", rolesDescription: "", roles: [],
    ctaEyebrow: "", ctaTitle: "", ctaDescription: "", ctaLabel: "Login", ctaHref: "/",
  },
  contact: { email: "", phone: "", address: "", website: "" },
  footer: { text: "" },
  productPage: { seo: { title: "", description: "" }, title: "", introduction: "", sections: [], media: [] },
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
      let cursor: Record<string, unknown> | unknown[] = next as unknown as Record<string, unknown>;
      for (let i = 0; i < parts.length - 1; i += 1) {
        const part = parts[i];
        const child = Array.isArray(cursor) ? cursor[Number(part)] : cursor[part];
        if (!child || typeof child !== "object") return current;
        cursor = child as Record<string, unknown> | unknown[];
      }
      const finalPart = parts[parts.length - 1];
      if (Array.isArray(cursor)) cursor[Number(finalPart)] = value;
      else cursor[finalPart] = value;
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
    <DashboardShell title="Website CMS" subtitle="Platform-owned public website content" allowedRoles={["SUPER_ADMIN", "CMS"]}>
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
              
              <Field label="Title" value={data.hero.title} onChange={(v) => set("hero.title", v)} />
              <TextArea label="Introduction" value={data.hero.description} onChange={(v) => set("hero.description", v)} />
              
              <ImageField label="Hero visual" value={data.hero.dashboardImageUrl} onChange={(v) => set("hero.dashboardImageUrl", v)} upload={(e) => upload(e, "hero.dashboardImageUrl")} />
              <Field label="Hero visual caption" value={data.hero.dashboardCaption} onChange={(v) => set("hero.dashboardCaption", v)} />
            </div>
          </Card>
        </section>

        <div hidden aria-hidden="true">
          {/* Retain old CMS records for compatibility; the public site no longer publishes these pages or menus. */}
                  <PageEditor title="About page" data={data.pages.about} set={(key: string, value: string) => set(`pages.about.${key}`, value)} upload={(e: ChangeEvent<HTMLInputElement>) => upload(e, "pages.about.imageUrl")} imageKey="imageUrl" />
        <CollectionPageEditor title="Our Partners page" data={data.pages.partners} set={(key, value) => set(`pages.partners.${key}`, value)} setItem={(index, key, value) => set(`pages.partners.items.${index}.${key}`, value)} add={() => set("pages.partners.items", [...data.pages.partners.items, { title: "", description: "", meta: "", imageUrl: "", linkUrl: "" }])} remove={(index) => set("pages.partners.items", data.pages.partners.items.filter((_, itemIndex) => itemIndex !== index))} upload={(index, event) => upload(event, `pages.partners.items.${index}.imageUrl`)} />
        <CollectionPageEditor title="Updates page" data={data.pages.updates} set={(key, value) => set(`pages.updates.${key}`, value)} setItem={(index, key, value) => set(`pages.updates.items.${index}.${key}`, value)} add={() => set("pages.updates.items", [...data.pages.updates.items, { title: "", description: "", meta: "", imageUrl: "", linkUrl: "" }])} remove={(index) => set("pages.updates.items", data.pages.updates.items.filter((_, itemIndex) => itemIndex !== index))} upload={(index, event) => upload(event, `pages.updates.items.${index}.imageUrl`)} />
        <TeamEditor data={data.pages.team} set={(key: string, value: string) => set(`pages.team.${key}`, value)} setMember={(index: number, key: string, value: string) => set(`pages.team.members.${index}.${key}`, value)} add={() => set("pages.team.members", [...(data.pages.team.members || []), { name: "", role: "", bio: "", imageUrl: "" }])} remove={(index: number) => set("pages.team.members", data.pages.team.members.filter((_: unknown, i: number) => i !== index))} upload={(index: number, event: ChangeEvent<HTMLInputElement>) => upload(event, `pages.team.members.${index}.imageUrl`)} />
        <PageEditor title="Contact page" data={data.pages.contact} set={(key: string, value: string) => set(`pages.contact.${key}`, value)} />
        </div>

        <Card title="Homepage content">
          <div className="space-y-6">
            <TextGroup prefix="sections.capabilities" title="Homepage capabilities" data={data.sections} set={set} />
            <FeatureListEditor items={data.sections.features} set={set} />
            <TextGroup prefix="sections.roles" title="Workspaces" data={data.sections} set={set} />
          </div>
        </Card>

        <ProductPageEditor data={data.productPage} set={set} upload={upload} />

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
  return <div className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:flex-row sm:items-end sm:justify-between"><div><h1 className="text-2xl font-black">Public website content</h1>{message ? <p className="mt-3 text-sm font-bold text-blue-700">{message}</p> : null}</div><button onClick={save} disabled={busy} className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-black text-white disabled:opacity-50">{busy ? "Publishing…" : "Save & publish"}</button></div>;
}

function PageEditor({ title, data, set, upload, imageKey }: { title: string; data: CmsPage; set: (key: string, value: string) => void; upload?: (event: ChangeEvent<HTMLInputElement>) => void; imageKey?: string }) {
  return <Card title={title}><div className="grid gap-4 lg:grid-cols-2"><Field label="Title" value={data.title} onChange={(v) => set("title", v)} />{imageKey ? <ImageField label="Page image" value={imageKey === "imageUrl" ? (data.imageUrl ?? "") : ""} onChange={(v) => set(imageKey, v)} upload={upload} /> : null}</div></Card>;
}

function CollectionPageEditor({ title, data, set, setItem, add, remove, upload }: { title: string; data: CmsCollectionPage; set: (key: string, value: string) => void; setItem: (index: number, key: string, value: string) => void; add: () => void; remove: (index: number) => void; upload: (index: number, event: ChangeEvent<HTMLInputElement>) => void }) {
  return <Card title={title}>
    <div className="grid gap-4 lg:grid-cols-2"><Field label="Title" value={data.title} onChange={(value) => set("title", value)} /></div>
    <div className="mt-5 space-y-4">{(data.items || []).map((item, index) => <div key={index} className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
      <div className="flex items-center justify-between"><b className="text-sm">Item {index + 1}</b><button type="button" onClick={() => remove(index)} className="text-xs font-bold text-red-600">Remove</button></div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2"><Field label="Name / title" value={item.title} onChange={(value) => setItem(index, "title", value)} /><Field label="Category / date" value={item.meta} onChange={(value) => setItem(index, "meta", value)} /><div className="lg:col-span-2"><TextArea label="Description" value={item.description} onChange={(value) => setItem(index, "description", value)} /></div><ImageField label="Image or logo" value={item.imageUrl} onChange={(value) => setItem(index, "imageUrl", value)} upload={(event) => upload(index, event)} /><Field label="Website / article link" value={item.linkUrl} onChange={(value) => setItem(index, "linkUrl", value)} /></div>
    </div>)}</div>
    <button type="button" onClick={add} className="mt-4 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold">+ Add item</button>
  </Card>;
}

function TeamEditor({ data, set, setMember, add, remove, upload }: { data: CmsTeamPage; set: (key: string, value: string) => void; setMember: (index: number, key: string, value: string) => void; add: () => void; remove: (index: number) => void; upload: (index: number, event: ChangeEvent<HTMLInputElement>) => void }) {
  return <Card title="Team page"><div className="grid gap-4 lg:grid-cols-3"><Field label="Title" value={data.title} onChange={(v) => set("title", v)} /></div><div className="mt-5 space-y-4">{(data.members || []).map((member, index) => <div key={index} className="rounded-2xl border border-slate-200 bg-slate-50 p-5"><div className="flex items-center justify-between"><b className="text-sm">Team member {index + 1}</b><button type="button" onClick={() => remove(index)} className="text-xs font-bold text-red-600">Remove</button></div><div className="mt-4 grid gap-4 lg:grid-cols-2"><Field label="Name" value={member.name} onChange={(v) => setMember(index, "name", v)} /><Field label="Role" value={member.role} onChange={(v) => setMember(index, "role", v)} /><TextArea label="Bio" value={member.bio} onChange={(v) => setMember(index, "bio", v)} /><ImageField label="Photo" value={member.imageUrl} onChange={(v) => setMember(index, "imageUrl", v)} upload={(e) => upload(index, e)} /></div></div>)}</div><button type="button" onClick={add} className="mt-4 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold">+ Add team member</button></Card>;
}

function TextGroup({ prefix, title, data, set }: { prefix: string; title: string; data: CmsSections; set: (path: string, value: string) => void }) {
  const key = prefix.split(".").pop();
  const source = data as unknown as Record<string, string | string[]>;
  return <div className="border-t border-slate-100 pt-5"><h3 className="text-sm font-black">{title}</h3><div className="mt-4 grid gap-4 lg:grid-cols-2">{["Title", "Description"].map((label) => { const actual = label === "Title" ? `${key}Title` : `${key}Description`; const value = typeof source[actual] === "string" ? source[actual] : ""; return <div key={actual} className={label === "Description" ? "lg:col-span-2" : ""}>{label === "Description" ? <TextArea label={label} value={value} onChange={(v) => set(`${prefix}${label}`, v)} /> : <Field label={label} value={value} onChange={(v) => set(`${prefix}${label}`, v)} />}</div>; })}</div></div>;
}


function FeatureListEditor({ items, set }: { items: Array<{ eyebrow: string; title: string; text: string }>; set: (path: string, value: unknown) => void }) {
  return (
    <div className="space-y-4 border-t border-slate-200 pt-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-bold text-slate-900">Institutional workflows</h3>
        <button type="button" onClick={() => set("sections.features", [...items, { eyebrow: "", title: "", text: "" }])} className="text-sm font-semibold text-emerald-800 underline underline-offset-4">Add workflow</button>
      </div>
      {items.map((item, index) => (
        <article key={index} className="grid gap-3 border-b border-slate-200 pb-4">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-semibold text-slate-500">Workflow {index + 1}</span>
            <button type="button" onClick={() => set("sections.features", items.filter((_, itemIndex) => itemIndex !== index))} className="text-xs font-semibold text-red-700 underline underline-offset-4">Remove</button>
          </div>
          <Field label="Workflow name" value={item.title} onChange={(value) => set(`sections.features.${index}.title`, value)} />
          <TextArea label="What this workflow does" value={item.text} onChange={(value) => set(`sections.features.${index}.text`, value)} />
        </article>
      ))}
    </div>
  );
}

function ProductPageEditor({ data, set, upload }: { data: CmsProductPage; set: (path: string, value: unknown) => void; upload: (event: ChangeEvent<HTMLInputElement>, path: string) => Promise<void> }) {
  const sections = data.sections || [];
  const update = (index: number, key: keyof CmsProductSection, value: string | boolean) => set(`productPage.sections.${index}.${key}`, value);
  const move = (index: number, direction: -1 | 1) => { const next = [...sections]; const target = index + direction; if (!next[target]) return; [next[index], next[target]] = [next[target], next[index]]; set("productPage.sections", next); };
  return <Card title="About ACADLYX product page"><p className="mb-5 text-sm text-slate-500">Published content for <code>/about-acadlyx</code>. Editors control its SEO, ordering, visibility, copy and media.</p><div className="grid gap-4 lg:grid-cols-2"><Field label="Page title" value={data.title} onChange={(v) => set("productPage.title", v)} /><TextArea label="Introduction" value={data.introduction} onChange={(v) => set("productPage.introduction", v)} /><Field label="SEO title" value={data.seo.title} onChange={(v) => set("productPage.seo.title", v)} /><TextArea label="SEO description" value={data.seo.description} onChange={(v) => set("productPage.seo.description", v)} /></div><div className="mt-6 space-y-4">{sections.map((section, index) => <article key={section.id || index} className="rounded-2xl border border-slate-200 bg-slate-50 p-5"><div className="flex flex-wrap items-center justify-between gap-3"><b className="text-sm">Section {index + 1}</b><div className="flex gap-2"><button type="button" onClick={() => move(index, -1)} className="rounded-lg border px-2 py-1 text-xs" disabled={index === 0}>Up</button><button type="button" onClick={() => move(index, 1)} className="rounded-lg border px-2 py-1 text-xs" disabled={index === sections.length - 1}>Down</button><button type="button" onClick={() => set("productPage.sections", sections.filter((_, itemIndex) => itemIndex !== index))} className="rounded-lg border border-red-200 px-2 py-1 text-xs text-red-700">Remove</button></div></div><div className="mt-4 grid gap-4 lg:grid-cols-2"><Field label="Section ID" value={section.id} onChange={(v) => update(index, "id", v)} /><label className="flex items-center gap-2 self-end text-sm font-bold"><input type="checkbox" checked={section.visible} onChange={(e) => update(index, "visible", e.target.checked)} /> Visible publicly</label><Field label="Heading" value={section.title} onChange={(v) => update(index, "title", v)} /><label className="block"><span className="text-xs font-black text-slate-600">Layout</span><select value={section.layout} onChange={(e) => update(index, "layout", e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm"><option value="statement">Statement</option><option value="split">Split</option></select></label><div className="lg:col-span-2"><TextArea label="Section content" value={section.body} onChange={(v) => update(index, "body", v)} /></div><ImageField label="Image" value={section.imageUrl} onChange={(v) => update(index, "imageUrl", v)} upload={(event) => upload(event, `productPage.sections.${index}.imageUrl`)} /><Field label="Image alt text" value={section.imageAlt} onChange={(v) => update(index, "imageAlt", v)} /></div></article>)}</div><button type="button" onClick={() => set("productPage.sections", [...sections, { id: `section-${sections.length + 1}`, visible: true, title: "", body: "", imageUrl: "", imageAlt: "", layout: "statement" }])} className="mt-4 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold">Add section</button><div className="mt-6 border-t pt-5"><h3 className="text-sm font-black">Homepage product media</h3><p className="mt-1 text-sm text-slate-500">Use only genuine ACADLYX product screenshots or approved product media.</p>{(data.media || []).map((media, index) => <div key={index} className="mt-4 grid gap-4 rounded-xl border p-4 lg:grid-cols-3"><ImageField label="Screenshot" value={media.url} onChange={(v) => set(`productPage.media.${index}.url`, v)} upload={(event) => upload(event, `productPage.media.${index}.url`)} /><Field label="Alt text" value={media.alt} onChange={(v) => set(`productPage.media.${index}.alt`, v)} /><Field label="Caption" value={media.caption} onChange={(v) => set(`productPage.media.${index}.caption`, v)} /></div>)}<button type="button" onClick={() => set("productPage.media", [...(data.media || []), { url: "", alt: "", caption: "" }])} className="mt-4 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold">Add product media</button></div></Card>;
}

function Card({ title, children }: { title: string; children: React.ReactNode }) { return <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="text-xl font-black text-slate-950">{title}</h2><div className="mt-5">{children}</div></section>; }
function humanize(value: string) { return value.replace(/([A-Z])/g, " $1").replace(/^./, (x) => x.toUpperCase()); }
function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label className="block"><span className="text-xs font-black text-slate-600">{label}</span><input value={value || ""} onChange={(e) => onChange(e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" /></label>; }
function TextArea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label className="block"><span className="text-xs font-black text-slate-600">{label}</span><textarea value={value || ""} onChange={(e) => onChange(e.target.value)} rows={4} className="mt-1.5 w-full resize-y rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm leading-6 text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" /></label>; }
function ImageField({ label, value, onChange, upload }: { label: string; value: string; onChange: (value: string) => void; upload?: (event: ChangeEvent<HTMLInputElement>) => void }) { return <div><Field label={`${label} URL`} value={value} onChange={onChange} /><input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={upload} disabled={!upload} className="mt-2 block w-full text-xs text-slate-500" /></div>; }
