"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { InlineLogin } from "@/components/public/InlineLogin";
import { PublicSiteShell, usePublicSiteContent } from "@/components/public/PublicSiteShell";

export default function HomePage() {
  const content = usePublicSiteContent();
  const [loginOpen, setLoginOpen] = useState(false);

  return (
    <PublicSiteShell onLogin={() => setLoginOpen((value) => !value)}>
      <section className="relative min-h-[calc(100vh-74px)] overflow-hidden px-5 py-16 sm:px-8 sm:py-24">
        <div className="pointer-events-none absolute -left-32 top-10 h-80 w-80 animate-pulse rounded-full bg-blue-400/20 blur-3xl" />
        <div className="pointer-events-none absolute right-[-100px] top-40 h-96 w-96 animate-pulse rounded-full bg-amber-300/25 blur-3xl [animation-delay:900ms]" />
        <div className="pointer-events-none absolute bottom-[-150px] left-1/3 h-96 w-96 rounded-full bg-violet-300/20 blur-3xl" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[1.05fr_.95fr]">
          <div>
            <div className="inline-flex animate-[float_5s_ease-in-out_infinite] items-center gap-2 rounded-full border border-slate-900/10 bg-white/60 px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] shadow-sm backdrop-blur">
              <span className="h-2 w-2 rounded-full bg-blue-600" />{content.hero.eyebrow}
            </div>
            <h1 className="mt-7 max-w-4xl text-5xl font-black tracking-[-0.055em] text-slate-950 sm:text-7xl">{content.hero.title}</h1>
            <p className="mt-6 max-w-2xl text-base leading-8 text-slate-600 sm:text-lg">{content.hero.description}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <button onClick={() => setLoginOpen(true)} className="rounded-2xl bg-slate-950 px-6 py-3.5 text-sm font-black text-white shadow-xl shadow-slate-950/15 transition hover:-translate-y-1">{content.hero.primaryCtaLabel}</button>
              {content.hero.secondaryCtaLabel ? <Link href={content.hero.secondaryCtaHref || "#platform"} className="rounded-2xl border border-slate-900/10 bg-white/70 px-6 py-3.5 text-sm font-black text-slate-800 transition hover:-translate-y-1">{content.hero.secondaryCtaLabel}</Link> : null}
            </div>
            <div className="mt-10 flex flex-wrap gap-x-7 gap-y-3 text-xs font-bold text-slate-500">
              {content.navigation.filter((item) => item.href.startsWith("/")).map((item) => <Link key={item.href} href={item.href} className="hover:text-slate-950">{item.label} ↗</Link>)}
            </div>
          </div>

          <div className="relative">
            <div className="absolute -inset-5 rounded-[40px] bg-blue-500/10 blur-2xl" />
            <div className="relative rotate-[1.5deg] overflow-hidden rounded-[32px] border border-white/80 bg-slate-950 p-3 shadow-[0_35px_100px_rgba(15,23,42,.22)] transition duration-700 hover:rotate-0">
              <div className="rounded-[25px] bg-[#f8f4eb] p-5 sm:p-7">
                <div className="flex items-center justify-between"><Image src={content.brand.logoUrl || "/branding/acadlyx-logo.png"} alt={content.brand.siteName} width={38} height={38} className="h-9 w-9 object-contain" /><span className="rounded-full bg-white px-3 py-1 text-[9px] font-black uppercase tracking-widest text-slate-500">Live workspace</span></div>
                <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {(content.sections.stats || []).slice(0, 4).map((stat: any) => <div key={stat.label} className="rounded-2xl border border-slate-900/5 bg-white p-3"><p className="text-[9px] font-black uppercase tracking-wide text-slate-400">{stat.label}</p><p className="mt-2 text-xl font-black">{stat.value}</p></div>)}
                </div>
                <div className="mt-4 grid gap-4 sm:grid-cols-[1.4fr_.8fr]">
                  <div className="rounded-2xl bg-white p-4"><div className="flex items-center justify-between"><b className="text-xs">Institution pulse</b><span className="text-[9px] text-slate-400">Current</span></div><div className="mt-6 flex h-32 items-end gap-2">{[35,52,42,68,58,78,65,91,74].map((height, i) => <div key={i} className="flex-1 rounded-t-lg bg-blue-100" style={{height: `${height}%`}}><div className="h-1/2 rounded-t-lg bg-blue-500" /></div>)}</div></div>
                  <div className="rounded-2xl bg-white p-4"><b className="text-xs">Connected areas</b><div className="mt-4 space-y-2">{(content.sections.roles || []).slice(0, 5).map((role: string) => <div key={role} className="rounded-lg bg-slate-50 px-3 py-2 text-[10px] font-bold text-slate-600">{role}</div>)}</div></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {loginOpen ? <InlineLogin onClose={() => setLoginOpen(false)} /> : null}

      <section id="platform" className="border-y border-slate-900/10 bg-white/55 px-5 py-20 sm:px-8">
        <div className="mx-auto max-w-7xl">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600">{content.sections.statsEyebrow}</p>
          <h2 className="mt-3 max-w-3xl text-4xl font-black tracking-tight">{content.sections.statsTitle}</h2>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600">{content.sections.statsDescription}</p>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{(content.sections.stats || []).map((stat: any) => <div key={stat.label} className="rounded-3xl border border-slate-900/10 bg-[#f5efe4] p-6"><p className="text-3xl font-black">{stat.value}</p><p className="mt-2 text-sm font-bold text-slate-500">{stat.label}</p></div>)}</div>
        </div>
      </section>

      <section id="capabilities" className="px-5 py-20 sm:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl"><p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600">{content.sections.capabilitiesEyebrow}</p><h2 className="mt-3 text-4xl font-black tracking-tight">{content.sections.capabilitiesTitle}</h2><p className="mt-4 text-sm leading-7 text-slate-600">{content.sections.capabilitiesDescription}</p></div>
          <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">{(content.sections.features || []).map((feature: any, i: number) => <article key={feature.title} className="group rounded-[28px] border border-slate-900/10 bg-white p-6 transition duration-500 hover:-translate-y-2 hover:shadow-2xl hover:shadow-slate-900/10"><span className="text-[9px] font-black tracking-[0.18em] text-blue-600">{feature.eyebrow}</span><div className="mt-12 text-3xl font-black text-slate-300">0{i + 1}</div><h3 className="mt-3 text-lg font-black">{feature.title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{feature.text}</p></article>)}</div>
        </div>
      </section>

      <section id="workspaces" className="bg-slate-950 px-5 py-20 text-white sm:px-8">
        <div className="mx-auto max-w-7xl"><p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-300">{content.sections.rolesEyebrow}</p><h2 className="mt-3 text-4xl font-black tracking-tight">{content.sections.rolesTitle}</h2><p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300">{content.sections.rolesDescription}</p><div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{(content.sections.roles || []).map((role: string) => <div key={role} className="rounded-2xl border border-white/10 bg-white/5 px-5 py-5 text-sm font-black transition hover:bg-white/10">{role}</div>)}</div></div>
      </section>

      <section className="px-5 py-20 sm:px-8"><div className="mx-auto max-w-5xl rounded-[35px] bg-gradient-to-br from-blue-600 to-indigo-700 p-8 text-white shadow-2xl sm:p-12"><p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-100">{content.sections.ctaEyebrow}</p><h2 className="mt-3 text-4xl font-black tracking-tight">{content.sections.ctaTitle}</h2><p className="mt-4 max-w-2xl text-sm leading-7 text-blue-50">{content.sections.ctaDescription}</p><button onClick={() => setLoginOpen(true)} className="mt-7 rounded-2xl bg-white px-6 py-3.5 text-sm font-black text-slate-950">{content.sections.ctaLabel}</button></div></section>
    </PublicSiteShell>
  );
}
