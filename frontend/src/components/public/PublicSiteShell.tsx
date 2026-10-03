"use client";

import Image from "next/image";
import Link from "next/link";
import { ReactNode, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

export interface PublicSiteContent {
  brand: { siteName: string; tagline: string; logoUrl: string; faviconUrl?: string };
  navigation: { label: string; href: string }[];
  hero: any;
  pages: {
    about: any;
    team: any;
    contact: any;
  };
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
      .then((response) => { if (active && response?.data?.content) setContent(merge(fallback, response.data.content)); })
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
  return (
    <main className="min-h-screen overflow-hidden bg-[#f5efe4] text-slate-950">
      <header className="sticky top-0 z-50 border-b border-slate-900/10 bg-[#f5efe4]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-5 px-5 py-4 sm:px-8">
          <Link href="/" className="flex items-center gap-3">
            <Image src={content.brand.logoUrl || "/branding/acadlyx-logo.png"} alt={content.brand.siteName} width={42} height={42} className="h-10 w-10 rounded-xl object-contain" priority />
            <span className="hidden text-sm font-black tracking-[0.18em] sm:inline">{content.brand.siteName}</span>
          </Link>
          <nav className="hidden items-center gap-6 md:flex">
            {content.navigation.map((item) => (
              <Link key={item.href + item.label} href={item.href} className="text-sm font-bold text-slate-600 transition hover:text-slate-950">{item.label}</Link>
            ))}
          </nav>
          {onLogin ? <button onClick={onLogin} className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-black text-white shadow-lg shadow-slate-950/10">Login</button> : <Link href="/" className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-black text-white">Home</Link>}
        </div>
      </header>
      {children}
      <footer className="border-t border-slate-900/10 bg-[#efe5d4]">
        <div className="mx-auto grid max-w-7xl gap-8 px-5 py-12 sm:px-8 md:grid-cols-3">
          <div><div className="flex items-center gap-3"><Image src={content.brand.logoUrl || "/branding/acadlyx-logo.png"} alt={content.brand.siteName} width={36} height={36} className="h-9 w-9 object-contain" /><span className="font-black">{content.brand.siteName}</span></div><p className="mt-4 max-w-sm text-sm leading-6 text-slate-600">{content.footer.text}</p></div>
          <div><h3 className="font-black">Explore</h3><div className="mt-3 grid gap-2 text-sm text-slate-600">{content.navigation.map((item) => <Link key={item.href + item.label} href={item.href} className="hover:text-slate-950">{item.label}</Link>)}</div></div>
          <div><h3 className="font-black">Contact</h3><div className="mt-3 space-y-2 text-sm text-slate-600">{content.contact.email ? <p>{content.contact.email}</p> : null}{content.contact.phone ? <p>{content.contact.phone}</p> : null}{content.contact.address ? <p>{content.contact.address}</p> : null}</div></div>
        </div>
      </footer>
    </main>
  );
}
