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
      <section className="relative min-h-[calc(100svh-76px)] overflow-visible px-5 py-8 sm:px-8 sm:py-14">
        <div className="mx-auto grid max-w-7xl items-center gap-8 lg:grid-cols-[1.02fr_.98fr] lg:gap-10">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-slate-950/60 px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-cyan-100 shadow-lg backdrop-blur-xl">
              <span className="h-2 w-2 animate-pulse rounded-full bg-cyan-300" />{content.hero.eyebrow}
            </div>
            <h1 className="mt-7 max-w-4xl text-5xl font-black tracking-[-0.055em] text-white sm:text-7xl">{content.hero.title}</h1>
            <p className="mt-6 max-w-2xl text-base leading-8 text-slate-300 sm:text-lg">{content.hero.description}</p>
            <div className="mt-8"><button onClick={() => setLoginOpen(true)} className="rounded-2xl bg-cyan-300 px-7 py-4 text-sm font-black text-slate-950 shadow-[0_0_40px_rgba(34,211,238,.22)] transition hover:-translate-y-1 hover:bg-cyan-200">{content.hero.primaryCtaLabel || "Login"}</button></div>
            <div className="mt-9 flex flex-wrap gap-x-6 gap-y-3 text-xs font-bold text-slate-400">{content.navigation.filter((item) => item.href.startsWith("/") && item.href !== "/").map((item) => <Link key={item.href} href={item.href} className="transition hover:text-cyan-200">{item.label} ↗</Link>)}</div>
          </div>

          <div className="relative mx-auto w-full max-w-[620px]">
            <div className="absolute -inset-8 rounded-[46px] bg-cyan-400/10 blur-3xl" />
            <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[32px] border border-white/15 bg-slate-950/90 p-2.5 shadow-[0_35px_120px_rgba(0,0,0,.55)] sm:p-3 lg:aspect-[1/0.9]">
              <div className="h-full min-h-0 overflow-hidden rounded-[25px] border border-white/10 bg-slate-100">
                {loginOpen ? <InlineLogin /> : (
                  <div className="h-full overflow-y-auto bg-[#f8f4eb] p-4 sm:p-7">
                    <div className="flex items-center justify-between gap-3"><Image src={content.brand.logoUrl || "/branding/acadlyx-logo.png"} alt={content.brand.siteName} width={38} height={38} className="h-9 w-9 object-contain" priority /><span className="rounded-full bg-white px-3 py-1 text-[9px] font-black uppercase tracking-widest text-slate-500">Live workspace</span></div>
                    <div className="mt-6 grid grid-cols-2 gap-2.5 sm:mt-8 sm:grid-cols-4 sm:gap-3">{(content.sections.stats || []).slice(0, 4).map((stat: any) => <div key={stat.label} className="rounded-2xl border border-slate-900/5 bg-white p-3"><p className="text-[9px] font-black uppercase tracking-wide text-slate-400">{stat.label}</p><p className="mt-2 text-xl font-black">{stat.value}</p></div>)}</div>
                    <div className="mt-3 grid gap-3 sm:mt-4 sm:gap-4 sm:grid-cols-[1.4fr_.8fr]"><div className="rounded-2xl bg-white p-4"><div className="flex items-center justify-between"><b className="text-xs">Institution pulse</b><span className="text-[9px] text-slate-400">Current</span></div><div className="mt-6 flex h-28 items-end gap-1.5 sm:h-32 sm:gap-2">{[35, 52, 42, 68, 58, 78, 65, 91, 74].map((height, i) => <div key={i} className="flex-1 rounded-t-lg bg-blue-100" style={{ height: `${height}%` }}><div className="h-1/2 rounded-t-lg bg-blue-500" /></div>)}</div></div><div className="rounded-2xl bg-white p-4"><b className="text-xs">Connected areas</b><div className="mt-4 space-y-2">{(content.sections.roles || []).slice(0, 5).map((role: string) => <div key={role} className="rounded-lg bg-slate-50 px-3 py-2 text-[10px] font-bold text-slate-600">{role}</div>)}</div></div></div>
                    <div className="mt-4 rounded-2xl border border-slate-900/5 bg-white/75 p-4 text-xs font-bold text-slate-600">Tap <span className="text-slate-950">Login</span> above to transform this workspace preview into secure access.</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="platform" className="border-y border-white/10 bg-slate-950/65 px-5 py-20 text-white backdrop-blur sm:px-8"><div className="mx-auto max-w-7xl"><p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300">{content.sections.statsEyebrow}</p><h2 className="mt-3 max-w-3xl text-4xl font-black tracking-tight">{content.sections.statsTitle}</h2><p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300">{content.sections.statsDescription}</p><div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{(content.sections.stats || []).map((stat: any) => <div key={stat.label} className="rounded-3xl border border-white/10 bg-white/5 p-6"><p className="text-3xl font-black">{stat.value}</p><p className="mt-2 text-sm font-bold text-slate-300">{stat.label}</p></div>)}</div></div></section>
      <section id="capabilities" className="px-5 py-20 text-white sm:px-8"><div className="mx-auto max-w-7xl"><div className="max-w-3xl"><p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300">{content.sections.capabilitiesEyebrow}</p><h2 className="mt-3 text-4xl font-black tracking-tight">{content.sections.capabilitiesTitle}</h2><p className="mt-4 text-sm leading-7 text-slate-300">{content.sections.capabilitiesDescription}</p></div><div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">{(content.sections.features || []).map((feature: any, i: number) => <article key={feature.title} className="group rounded-[28px] border border-white/10 bg-white/5 p-6 shadow-sm backdrop-blur transition duration-500 hover:-translate-y-2 hover:bg-white/10 hover:shadow-2xl"><span className="text-[9px] font-black tracking-[0.18em] text-cyan-300">{feature.eyebrow}</span><div className="mt-12 text-3xl font-black text-slate-700">0{i + 1}</div><h3 className="mt-3 text-lg font-black">{feature.title}</h3><p className="mt-2 text-sm leading-6 text-slate-400">{feature.text}</p></article>)}</div></div></section>
      <section id="workspaces" className="bg-black/45 px-5 py-20 text-white backdrop-blur sm:px-8"><div className="mx-auto max-w-7xl"><p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300">{content.sections.rolesEyebrow}</p><h2 className="mt-3 text-4xl font-black tracking-tight">{content.sections.rolesTitle}</h2><p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300">{content.sections.rolesDescription}</p><div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{(content.sections.roles || []).map((role: string) => <div key={role} className="rounded-2xl border border-white/10 bg-white/5 px-5 py-5 text-sm font-black transition hover:bg-white/10">{role}</div>)}</div></div></section>
      <section className="px-5 py-20 text-white sm:px-8"><div className="mx-auto max-w-5xl rounded-[35px] border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur sm:p-12"><p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300">{content.sections.ctaEyebrow}</p><h2 className="mt-3 text-4xl font-black tracking-tight">{content.sections.ctaTitle}</h2><p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300">{content.sections.ctaDescription}</p><p className="mt-7 text-sm font-bold text-slate-400">Use the single Login control in the hero to access your workspace.</p></div></section>
    </PublicSiteShell>
  );
}
