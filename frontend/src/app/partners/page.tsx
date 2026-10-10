"use client";

import Image from "next/image";
import Link from "next/link";
import { PublicSiteShell, usePublicSiteContent } from "@/components/public/PublicSiteShell";

export default function PartnersPage() {
  const content = usePublicSiteContent();
  const page = content.pages.partners;
  const items = Array.isArray(page.items) ? page.items : [];

  return (
    <PublicSiteShell>
      <section className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-24">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-300">{page.eyebrow}</p>
        <h1 className="mt-4 max-w-4xl text-4xl font-black tracking-tight text-white sm:text-6xl">{page.title}</h1>
        <p className="mt-5 max-w-3xl text-base leading-8 text-slate-300">{page.description}</p>
        {items.length ? <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item: { title: string; description: string; meta: string; imageUrl: string; linkUrl: string }, index: number) => <article key={`${item.title}-${index}`} className="rounded-3xl border border-slate-700 bg-slate-900/70 p-6 shadow-xl">
            {item.imageUrl ? <div className="grid h-24 place-items-center rounded-2xl bg-white p-4"><Image src={item.imageUrl} alt={item.title} width={180} height={72} className="max-h-16 w-auto object-contain" /></div> : null}
            {item.meta ? <p className="mt-5 text-xs font-bold uppercase tracking-widest text-blue-300">{item.meta}</p> : null}
            <h2 className="mt-3 text-xl font-bold text-white">{item.title}</h2>
            <p className="mt-3 text-sm leading-7 text-slate-300">{item.description}</p>
            {item.linkUrl ? <Link href={item.linkUrl} target="_blank" rel="noopener noreferrer" className="mt-5 inline-flex text-sm font-bold text-blue-300 hover:text-blue-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300">Visit website ↗</Link> : null}
          </article>)}
        </div> : <div className="mt-12 rounded-3xl border border-dashed border-slate-600 p-8 text-slate-300">Partner information will appear here when published by the website team.</div>}
      </section>
    </PublicSiteShell>
  );
}
