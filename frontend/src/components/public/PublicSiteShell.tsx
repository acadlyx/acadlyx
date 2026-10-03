"use client";

import Image from "next/image";
import Link from "next/link";
import { ReactNode, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { PublicMotionBackground } from "./PublicMotionBackground";

export interface PublicSiteContent {
  brand: { siteName: string; tagline: string; logoUrl: string; faviconUrl?: string };
  navigation: { label: string; href: string }[];
  hero: any;
  pages: { about: any; team: any; contact: any };
  sections: any;
  contact: { email: string; phone: string; address: string; website: string };
  footer: { text: string };
}

const fallback: PublicSiteContent = {
  brand: { siteName: "ACADLYX", tagline: "Education ERP", logoUrl: "/branding/acadlyx-logo.png" },
  navigation: [
    { label: "Home", href: "/" },
    { label: "Platform", href: "#platform" },
    { label: "About", href: "/about" },
    { label: "Team", href: "/team" },
    { label: "Contact", href: "/contact" },
  ],
  hero: { eyebrow: "", title: "", description: "", primaryCtaLabel: "Login", primaryCtaHref: "/", secondaryCtaLabel: "", secondaryCtaHref: "" },
  pages: { about: {}, team: { members: [] }, contact: {} },
  sections: { stats: [], features: [], roles: [] },
  contact: { email: "", phone: "", address: "", website: "" },
  footer: { text: "" },
};

export function usePublicSiteContent() {
  const [content, setContent] = useState<PublicSiteContent>(fallback);
  useEffect(() => {
    let active = true;
    const slug = process.env.NEXT_PUBLIC_PUBLIC_SITE_SLUG || "aimt";
    apiFetch<{ data: { content: PublicSiteContent } }>(`/site-content/public?slug=${encodeURIComponent(slug)}`)
      .then((response) => {
        if (active && response?.data?.content) setContent(merge(fallback, response.data.content));
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);
  return content;
}

function merge(base: any, incoming: any): any {
  if (!incoming || typeof incoming !== "object" || Array.isArray(incoming)) return incoming ?? base;
  const result = { ...base };
  for (const [key, value] of Object.entries(incoming)) {
    if (value && typeof value === "object" && !Array.isArray(value)) result[key] = merge(base?.[key] || {}, value);
    else result[key] = value;
  }
  return result;
}

export function PublicSiteShell({ children, onLogin }: { children: ReactNode; onLogin?: () => void }) {
  const content = usePublicSiteContent();
  const [mobileNav, setMobileNav] = useState(false);

  return (
    <main className="relative min-h-screen overflow-x-clip bg-[#020617] text-white selection:bg-cyan-300/30 selection:text-white">
      <PublicMotionBackground />
      <div className="pointer-events-none fixed inset-0 z-[1] bg-[radial-gradient(circle_at_50%_20%,rgba(13,148,136,0.06),transparent_38%),linear-gradient(180deg,rgba(2,6,23,0.08),rgba(2,6,23,0.28))]" />

      <div className="relative z-10">
        <header className="sticky top-0 z-50 border-b border-white/10 bg-[#020617]/68 shadow-[0_12px_50px_rgba(0,0,0,0.35)] backdrop-blur-xl">
          <div className="mx-auto flex min-h-[76px] max-w-7xl items-center justify-between gap-5 px-5 sm:px-8">
            <Link href="/" className="group flex items-center gap-3" onClick={() => setMobileNav(false)}>
              <span className="relative grid h-11 w-11 place-items-center overflow-hidden rounded-2xl border border-white/15 bg-white/[0.07] shadow-[0_0_30px_rgba(34,211,238,0.12)]">
                <Image src={content.brand.logoUrl || "/branding/acadlyx-logo.png"} alt={content.brand.siteName} width={42} height={42} className="h-9 w-9 object-contain" priority />
              </span>
              <span className="hidden sm:block">
                <span className="block text-sm font-black tracking-[0.22em] text-white">{content.brand.siteName}</span>
                <span className="mt-0.5 block text-[9px] font-bold uppercase tracking-[0.22em] text-cyan-200/55">{content.brand.tagline}</span>
              </span>
            </Link>

            <nav className="hidden items-center gap-1 md:flex">
              {content.navigation.map((item) => (
                <Link key={item.href + item.label} href={item.href} className="rounded-xl px-3.5 py-2.5 text-sm font-bold text-slate-300 transition hover:bg-white/[0.07] hover:text-white">
                  {item.label}
                </Link>
              ))}
            </nav>

            <div className="flex items-center gap-2">
              {onLogin ? (
                <button type="button" onClick={onLogin} className="hidden rounded-xl border border-cyan-200/20 bg-cyan-300 px-4 py-2.5 text-sm font-black text-slate-950 shadow-[0_0_28px_rgba(34,211,238,0.22)] transition hover:bg-cyan-200 md:inline-flex">Login</button>
              ) : (
                <Link href="/" className="hidden rounded-xl border border-white/10 bg-white/[0.07] px-4 py-2.5 text-sm font-black text-white md:inline-flex">Home</Link>
              )}
              <button type="button" aria-label={mobileNav ? "Hide navigation" : "Show navigation"} aria-expanded={mobileNav} onClick={() => setMobileNav((value) => !value)} className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/[0.06] text-white md:hidden">
                {mobileNav ? <span className="text-xl">×</span> : <span className="space-y-1.5"><i className="block h-0.5 w-5 bg-current" /><i className="block h-0.5 w-5 bg-current" /><i className="block h-0.5 w-5 bg-current" /></span>}
              </button>
            </div>
          </div>
          {mobileNav ? (
            <div className="border-t border-white/10 bg-[#020617]/96 px-5 py-4 shadow-2xl backdrop-blur-2xl md:hidden">
              <nav className="mx-auto grid max-w-7xl gap-1">
                {content.navigation.map((item) => (
                  <Link key={item.href + item.label} href={item.href} onClick={() => setMobileNav(false)} className="rounded-xl px-4 py-3 text-sm font-bold text-slate-300 transition hover:bg-white/[0.07] hover:text-white">{item.label}</Link>
                ))}
              </nav>
            </div>
          ) : null}
        </header>

        {children}

        <footer className="border-t border-white/10 bg-[#020617]/82 backdrop-blur-2xl">
          <div className="mx-auto grid max-w-7xl gap-10 px-5 py-14 sm:px-8 md:grid-cols-3">
            <div>
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/[0.06]"><Image src={content.brand.logoUrl || "/branding/acadlyx-logo.png"} alt={content.brand.siteName} width={36} height={36} className="h-8 w-8 object-contain" /></span>
                <span className="font-black tracking-[0.16em]">{content.brand.siteName}</span>
              </div>
              <p className="mt-4 max-w-sm text-sm leading-6 text-slate-400">{content.footer.text}</p>
            </div>
            <div><h3 className="font-black text-white">Explore</h3><div className="mt-3 grid gap-2 text-sm text-slate-400">{content.navigation.map((item) => <Link key={item.href + item.label} href={item.href} className="transition hover:text-cyan-200">{item.label}</Link>)}</div></div>
            <div><h3 className="font-black text-white">Contact</h3><div className="mt-3 space-y-2 text-sm text-slate-400">{content.contact.email ? <p>{content.contact.email}</p> : null}{content.contact.phone ? <p>{content.contact.phone}</p> : null}{content.contact.address ? <p>{content.contact.address}</p> : null}</div></div>
          </div>
        </footer>

        <div className="border-t border-white/10 bg-black/20">
          <div className="mx-auto flex max-w-7xl flex-col items-center justify-center gap-1 px-5 py-5 text-center sm:px-8">
            <p className="text-[11px] font-medium tracking-wide text-slate-400">
              A product of{" "}
              <a
                href="https://ayzent-solutions.vercel.app/"
                target="_blank"
                rel="noopener noreferrer"
                className="font-bold text-cyan-200 transition hover:text-cyan-100 hover:underline"
              >
                Ayzent Solutions
              </a>
            </p>
            <p className="text-[10px] font-medium tracking-wide text-slate-500">
              Designed, developed &amp; maintained by{" "}
              <a
                href="https://ayzent-solutions.vercel.app/"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-slate-300 transition hover:text-white hover:underline"
              >
                Ayzent Solutions
              </a>{" "}
              · © 2026 ACADLYX
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
