"use client";

import Image from "next/image";
import Link from "next/link";
import { ReactNode, useEffect, useState, useSyncExternalStore } from "react";
import { apiFetch } from "@/lib/api";

export interface PublicSiteContent {
  brand: { siteName: string; tagline: string; logoUrl: string; faviconUrl?: string };
  navigation: { label: string; href: string }[];
  hero: any;
  pages: { about: any; team: any; partners: any; updates: any; contact: any };
  sections: any;
  contact: { email: string; phone: string; address: string; website: string };
  footer: { text: string };
  _ready?: boolean;
}

const fallback: PublicSiteContent = {
  brand: { siteName: "ACADLYX", tagline: "Education ERP", logoUrl: "/branding/acadlyx-logo.png" },
  navigation: [
    { label: "Home", href: "/" },
    { label: "About", href: "/about" },
    { label: "Contact", href: "/contact" },
  ],
  hero: { eyebrow: "", title: "", description: "", primaryCtaLabel: "Sign in", primaryCtaHref: "/", secondaryCtaLabel: "", secondaryCtaHref: "" },
  pages: { about: {}, team: { members: [] }, partners: { items: [] }, updates: { items: [] }, contact: {} },
  sections: { stats: [], features: [], roles: [] },
  contact: { email: "", phone: "", address: "", website: "" },
  footer: { text: "" },
  _ready: false,
};

type PublicSiteSnapshot = PublicSiteContent & { _ready: boolean };

let publicSiteSnapshot: PublicSiteSnapshot = { ...fallback, _ready: false };
let publicSiteRequest: Promise<void> | null = null;
const publicSiteListeners = new Set<() => void>();

function subscribePublicSite(listener: () => void) {
  publicSiteListeners.add(listener);
  return () => publicSiteListeners.delete(listener);
}

function getPublicSiteSnapshot() {
  return publicSiteSnapshot;
}

function notifyPublicSiteListeners() {
  publicSiteListeners.forEach((listener) => listener());
}

function ensurePublicSiteContent() {
  if (publicSiteRequest) return;

  const slug = process.env.NEXT_PUBLIC_PUBLIC_SITE_SLUG || "aimt";
  publicSiteRequest = apiFetch<{ data: { content: PublicSiteContent } }>(
    `/site-content/public?slug=${encodeURIComponent(slug)}`,
  )
    .then((response) => {
      publicSiteSnapshot = {
        ...merge(fallback, response?.data?.content || fallback),
        _ready: true,
      };
    })
    .catch(() => {
      // Show the small local default only after the backend request has failed.
      publicSiteSnapshot = { ...fallback, _ready: true };
    })
    .finally(notifyPublicSiteListeners);
}

export function usePublicSiteContent() {
  const content = useSyncExternalStore(
    subscribePublicSite,
    getPublicSiteSnapshot,
    getPublicSiteSnapshot,
  );

  useEffect(() => {
    ensurePublicSiteContent();
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
  if (!content._ready) return <main className="public-site min-h-screen bg-white" aria-busy="true" />;\n\n  const navigation = (content.navigation || fallback.navigation).filter((item) =>
    ["/", "/about", "/contact"].includes(item.href),
  );

  return (
    <main className="public-site min-h-screen bg-white text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex min-h-20 max-w-7xl items-center justify-between gap-6 px-5 sm:px-8">
          <Link href="/" className="flex items-center gap-3" onClick={() => setMobileNav(false)}>
            <Image src={content.brand.logoUrl || "/branding/acadlyx-logo.png"} alt={content.brand.siteName} width={40} height={40} className="h-9 w-9 object-contain" priority />
            <span className="text-base font-semibold tracking-tight text-slate-950">{content.brand.siteName}</span>
          </Link>

          <nav className="hidden items-center gap-8 md:flex" aria-label="Main navigation">
            {navigation.map((item) => (
              <Link key={item.href} href={item.href} className="text-sm font-medium text-slate-600 hover:text-slate-950">
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            {onLogin ? (
              <button type="button" onClick={onLogin} className="hidden rounded-md bg-[#315c4a] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#244638] md:inline-flex">Sign in</button>
            ) : null}
            <button type="button" aria-label={mobileNav ? "Close navigation" : "Open navigation"} aria-expanded={mobileNav} onClick={() => setMobileNav((open) => !open)} className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 md:hidden">
              {mobileNav ? "Close" : "Menu"}
            </button>
          </div>
        </div>
        {mobileNav ? (
          <nav className="grid gap-1 border-t border-slate-200 px-5 py-3 md:hidden" aria-label="Mobile navigation">
            {navigation.map((item) => (
              <Link key={item.href} href={item.href} onClick={() => setMobileNav(false)} className="py-2 text-sm font-medium text-slate-700">{item.label}</Link>
            ))}
            {onLogin ? <button type="button" onClick={() => { setMobileNav(false); onLogin(); }} className="py-2 text-left text-sm font-semibold text-[#315c4a]">Sign in</button> : null}
          </nav>
        ) : null}
      </header>

      {children}

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-5 py-8 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <span>{content.brand.siteName}</span>
          <span>A product of <a href="https://ayzent-solutions.vercel.app/" target="_blank" rel="noopener noreferrer" className="font-medium text-slate-700 hover:underline">Ayzent Solutions</a></span>
        </div>
      </footer>
    </main>
  );
}
