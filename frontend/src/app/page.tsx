"use client";

import Link from "next/link";
import { useState } from "react";
import { InlineLogin } from "@/components/public/InlineLogin";
import { PublicSiteShell, usePublicSiteContent } from "@/components/public/PublicSiteShell";

type Stat = { label: string; value: string };
type Feature = { eyebrow?: string; title: string; text: string };

export default function HomePage() {
  const content = usePublicSiteContent();
  const [loginOpen, setLoginOpen] = useState(false);
  const stats = (content.sections.stats || []) as Stat[];
  const features = (content.sections.features || []) as Feature[];
  const roles = (content.sections.roles || []) as string[];
  const hero = content.hero;
  const hasHeroImage = Boolean(hero.dashboardImageUrl);

  return (
    <PublicSiteShell onLogin={() => setLoginOpen((value) => !value)}>
      {loginOpen ? (
        <section className="mx-auto max-w-5xl px-5 py-12 sm:px-8" aria-label="Sign in to ACADLYX">
          <div className="rounded-3xl border border-slate-700 bg-slate-900/95 p-5 shadow-2xl sm:p-8">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-300">Secure workspace</p>
                <h1 className="mt-2 text-2xl font-black text-white">Sign in to ACADLYX</h1>
              </div>
              <button type="button" onClick={() => setLoginOpen(false)} className="rounded-xl border border-slate-600 px-3 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300">Close</button>
            </div>
            <InlineLogin />
          </div>
        </section>
      ) : (
        <>
          <section className="relative isolate overflow-hidden px-5 pb-20 pt-16 sm:px-8 sm:pb-28 sm:pt-24 lg:pt-28">
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
              <div className="absolute -right-24 top-0 h-96 w-96 rounded-full bg-blue-600/20 blur-3xl" />
              <div className="absolute -left-24 bottom-0 h-80 w-80 rounded-full bg-cyan-500/10 blur-3xl" />
              <div className="absolute inset-x-0 top-1/2 h-px bg-gradient-to-r from-transparent via-blue-400/30 to-transparent" />
            </div>
            <div className="mx-auto grid max-w-7xl items-center gap-14 lg:grid-cols-[1.1fr_.9fr]">
              <div className="max-w-3xl">
                {hero.eyebrow ? <p className="inline-flex items-center gap-2 rounded-full border border-blue-300/25 bg-blue-400/10 px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-blue-200"><span className="h-2 w-2 rounded-full bg-cyan-300 shadow-[0_0_18px_rgba(103,232,249,.8)]" />{hero.eyebrow}</p> : null}
                <h1 className="mt-7 max-w-4xl text-5xl font-black leading-[1.04] tracking-[-0.055em] text-white sm:text-6xl lg:text-7xl">{hero.title || content.brand.siteName}</h1>
                {hero.description ? <p className="mt-7 max-w-2xl text-base leading-8 text-slate-300 sm:text-lg">{hero.description}</p> : null}
                <div className="mt-9 flex flex-wrap gap-3">
                  <button type="button" onClick={() => setLoginOpen(true)} className="inline-flex min-h-12 items-center justify-center rounded-xl bg-blue-600 px-6 py-3 text-sm font-extrabold text-white shadow-[0_12px_35px_rgba(37,99,235,.32)] transition hover:-translate-y-0.5 hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300">{hero.primaryCtaLabel || "Access ACADLYX"} <span aria-hidden="true" className="ml-2">↗</span></button>
                  {hero.secondaryCtaLabel && hero.secondaryCtaHref ? <Link href={hero.secondaryCtaHref} className="inline-flex min-h-12 items-center justify-center rounded-xl border border-slate-600 bg-slate-900/60 px-6 py-3 text-sm font-bold text-slate-100 transition hover:border-blue-400/60 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300">{hero.secondaryCtaLabel}</Link> : null}
                </div>
                <div className="mt-8 flex flex-wrap gap-x-5 gap-y-3 text-xs font-semibold text-slate-400">
                  <span className="inline-flex items-center gap-2"><span className="text-cyan-300">✓</span> Role-aware workspaces</span>
                  <span className="inline-flex items-center gap-2"><span className="text-cyan-300">✓</span> Institution-scoped access</span>
                  <span className="inline-flex items-center gap-2"><span className="text-cyan-300">✓</span> Connected operations</span>
                </div>
              </div>

              <div className="relative mx-auto w-full max-w-xl">
                <div aria-hidden="true" className="absolute -inset-4 rounded-[2rem] border border-blue-400/15 bg-blue-500/5 blur-xl" />
                <div className="relative overflow-hidden rounded-[2rem] border border-slate-600/80 bg-slate-900/90 p-4 shadow-[0_35px_100px_rgba(0,0,0,.42)] sm:p-6">
                  <div className="flex items-center justify-between border-b border-slate-700 pb-4">
                    <div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-300">Institutional intelligence</p><p className="mt-1 text-lg font-extrabold text-white">One connected workspace</p></div>
                    <span className="grid h-11 w-11 place-items-center rounded-2xl border border-blue-300/20 bg-blue-500/10 text-xl text-blue-200" aria-hidden="true">✦</span>
                  </div>
                  {hasHeroImage ? <img src={hero.dashboardImageUrl} alt={hero.dashboardCaption || "ACADLYX platform overview"} className="mt-5 max-h-72 w-full rounded-2xl border border-slate-700 object-cover" /> : (
                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                      {[
                        { title: "Academic operations", description: "Programs, classes and academic workflows", icon: "▦" },
                        { title: "Finance & collections", description: "Fee structures and financial visibility", icon: "₹" },
                        { title: "People & workspaces", description: "Purpose-built views by responsibility", icon: "♙" },
                        { title: "Institutional insights", description: "Decision support within permitted scope", icon: "✧" },
                      ].map((item) => <div key={item.title} className="min-h-32 rounded-2xl border border-slate-700 bg-gradient-to-br from-slate-800/90 to-slate-950/80 p-4"><span className="grid h-9 w-9 place-items-center rounded-xl bg-blue-500/15 text-lg text-blue-200">{item.icon}</span><h2 className="mt-4 text-sm font-bold text-white">{item.title}</h2><p className="mt-1 text-xs leading-5 text-slate-400">{item.description}</p></div>)}
                    </div>
                  )}
                  {hero.dashboardCaption && hasHeroImage ? <p className="mt-3 text-xs leading-5 text-slate-400">{hero.dashboardCaption}</p> : null}
                  <div className="mt-4 flex items-center justify-between gap-4 rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3"><div><p className="text-xs font-bold text-slate-100">Designed around institutional roles</p><p className="mt-1 text-[11px] text-slate-400">Clear access boundaries. Connected workflows.</p></div><span className="text-lg text-cyan-300" aria-hidden="true">↗</span></div>
                </div>
              </div>
            </div>
          </section>

          {stats.length ? <section id="platform" className="border-y border-slate-700/70 bg-slate-950/65 px-5 py-16 backdrop-blur sm:px-8 sm:py-20">
            <div className="mx-auto max-w-7xl">
              <div className="max-w-3xl"><p className="text-[10px] font-black uppercase tracking-[0.22em] text-blue-300">{content.sections.statsEyebrow}</p><h2 className="mt-3 text-3xl font-black tracking-tight text-white sm:text-4xl">{content.sections.statsTitle}</h2><p className="mt-4 text-sm leading-7 text-slate-300">{content.sections.statsDescription}</p></div>
              <div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{stats.map((stat, index) => <article key={stat.label || index} className="rounded-2xl border border-slate-700 bg-slate-900/80 p-5 transition hover:border-blue-400/40"><p className="text-3xl font-black tracking-tight text-white">{stat.value}</p><p className="mt-2 text-sm font-semibold text-slate-300">{stat.label}</p></article>)}</div>
            </div>
          </section> : null}

          {features.length ? <section id="capabilities" className="px-5 py-20 sm:px-8 sm:py-24">
            <div className="mx-auto max-w-7xl">
              <div className="max-w-3xl"><p className="text-[10px] font-black uppercase tracking-[0.22em] text-blue-300">{content.sections.capabilitiesEyebrow}</p><h2 className="mt-3 text-3xl font-black tracking-tight text-white sm:text-4xl">{content.sections.capabilitiesTitle}</h2><p className="mt-4 text-sm leading-7 text-slate-300">{content.sections.capabilitiesDescription}</p></div>
              <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">{features.map((feature, index) => <article key={feature.title || index} className="group rounded-2xl border border-slate-700/90 bg-gradient-to-br from-slate-900/95 to-slate-950/80 p-6 shadow-lg transition duration-300 hover:-translate-y-1 hover:border-blue-400/40 hover:shadow-blue-950/30"><div className="flex items-center justify-between gap-3"><span className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-300">{feature.eyebrow || "CAPABILITY"}</span><span className="text-xl text-slate-600 transition group-hover:text-blue-300" aria-hidden="true">✧</span></div><h3 className="mt-8 text-lg font-extrabold text-white">{feature.title}</h3><p className="mt-3 text-sm leading-7 text-slate-300">{feature.text}</p></article>)}</div>
            </div>
          </section> : null}

          {roles.length ? <section id="workspaces" className="border-y border-slate-700/70 bg-[#060d18]/90 px-5 py-20 sm:px-8 sm:py-24">
            <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[.8fr_1.2fr]"><div><p className="text-[10px] font-black uppercase tracking-[0.22em] text-blue-300">{content.sections.rolesEyebrow}</p><h2 className="mt-3 text-3xl font-black tracking-tight text-white sm:text-4xl">{content.sections.rolesTitle}</h2><p className="mt-4 text-sm leading-7 text-slate-300">{content.sections.rolesDescription}</p></div><div className="grid gap-3 sm:grid-cols-2">{roles.map((role) => <div key={role} className="flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-900/70 px-4 py-4 text-sm font-bold text-slate-100"><span className="grid h-8 w-8 place-items-center rounded-lg bg-blue-500/15 text-blue-200" aria-hidden="true">↗</span>{role}</div>)}</div></div>
          </section> : null}

          <section className="px-5 py-20 sm:px-8 sm:py-24">
            <div className="mx-auto max-w-7xl overflow-hidden rounded-[2rem] border border-blue-300/20 bg-gradient-to-br from-blue-950/80 via-slate-900 to-slate-950 p-8 shadow-2xl sm:p-12 lg:p-16">
              <div className="grid gap-8 md:grid-cols-[1fr_auto] md:items-end"><div className="max-w-3xl">{content.sections.ctaEyebrow ? <p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300">{content.sections.ctaEyebrow}</p> : null}<h2 className="mt-3 text-3xl font-black tracking-tight text-white sm:text-5xl">{content.sections.ctaTitle}</h2><p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300">{content.sections.ctaDescription}</p></div><button type="button" onClick={() => setLoginOpen(true)} className="inline-flex min-h-12 items-center justify-center rounded-xl bg-blue-600 px-6 py-3 text-sm font-extrabold text-white transition hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300">{content.sections.ctaLabel || "Sign in to ACADLYX"} <span aria-hidden="true" className="ml-2">↗</span></button></div>
            </div>
          </section>
        </>
      )}
    </PublicSiteShell>
  );
}
