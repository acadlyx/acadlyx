"use client";

import Image from "next/image";
import Link from "next/link";
import { ReactNode, useEffect, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
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
    { label: "Partners", href: "/partners" },
    { label: "Updates", href: "/updates" },
    { label: "Team", href: "/team" },
    { label: "Contact", href: "/contact" },
  ],
  hero: {
    eyebrow: "",
    title: "",
    description: "",
    primaryCtaLabel: "Sign in",
    primaryCtaHref: "/",
    secondaryCtaLabel: "",
    secondaryCtaHref: "",
  },
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
    "/site-content/public?slug=" + encodeURIComponent(slug),
  )
    .then((response) => {
      publicSiteSnapshot = {
        ...merge(fallback, response?.data?.content || fallback),
        _ready: true,
      };
    })
    .catch(() => {
      // Fall back only when the public CMS endpoint is unavailable.
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

const PUBLIC_PATHS = new Set(["/", "/about", "/contact", "/partners", "/updates", "/team"]);

export function PublicSiteShell({ children, onLogin }: { children: ReactNode; onLogin?: () => void }) {
  const content = usePublicSiteContent();
  const pathname = usePathname() || "/";
  const [mobileNav, setMobileNav] = useState(false);

  useEffect(() => {
    if (!mobileNav) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileNav(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [mobileNav]);

  useEffect(() => {
    setMobileNav(false);
  }, [pathname]);

  if (!content._ready) {
    return (
      <main
        className="public-site public-site-loading min-h-screen"
        aria-busy="true"
        aria-label="Loading ACADLYX website"
      />
    );
  }

  const configured = Array.isArray(content.navigation) ? content.navigation : fallback.navigation;
  const seen = new Set<string>();
  const navigation = configured.filter((item) => {
    if (!item || typeof item.label !== "string" || !item.label.trim()) return false;
    if (!PUBLIC_PATHS.has(item.href) || seen.has(item.href)) return false;
    seen.add(item.href);
    return true;
  });
  const visibleNavigation = navigation.length ? navigation : fallback.navigation;

  return (
    <main className="public-site min-h-screen">
      <header className="public-site-header">
        <div className="public-site-header-inner">
          <Link href="/" className="public-site-brand" onClick={() => setMobileNav(false)}>
            <Image
              src={content.brand.logoUrl || "/branding/acadlyx-logo.png"}
              alt=""
              width={44}
              height={44}
              className="public-site-brand-logo"
              priority
            />
            <span className="public-site-brand-copy">
              <strong>{content.brand.siteName || "ACADLYX"}</strong>
              <small>{content.brand.tagline || "Education ERP"}</small>
            </span>
          </Link>

          <nav className="public-site-nav" aria-label="Main navigation">
            {visibleNavigation.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={pathname === item.href ? "page" : undefined}
                className="public-site-nav-link"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="public-site-header-actions">
            {onLogin ? (
              <button type="button" onClick={onLogin} className="public-site-login">
                Sign in
              </button>
            ) : null}
            <button
              type="button"
              aria-label={mobileNav ? "Close navigation" : "Open navigation"}
              aria-expanded={mobileNav}
              aria-controls="public-mobile-navigation"
              onClick={() => setMobileNav((open) => !open)}
              className="public-site-menu-button"
            >
              {mobileNav ? "Close" : "Menu"}
            </button>
          </div>
        </div>

        {mobileNav ? (
          <nav id="public-mobile-navigation" className="public-site-mobile-nav" aria-label="Mobile navigation">
            {visibleNavigation.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={pathname === item.href ? "page" : undefined}
                onClick={() => setMobileNav(false)}
                className="public-site-mobile-link"
              >
                {item.label}
              </Link>
            ))}
            {onLogin ? (
              <button
                type="button"
                onClick={() => {
                  setMobileNav(false);
                  onLogin();
                }}
                className="public-site-mobile-login"
              >
                Sign in to ACADLYX
              </button>
            ) : null}
          </nav>
        ) : null}
      </header>

      {children}

      <footer className="public-site-footer">
        <div className="public-site-footer-inner">
          <div>
            <strong>{content.brand.siteName || "ACADLYX"}</strong>
            <p>{content.footer.text || content.brand.tagline || "Education ERP"}</p>
          </div>
          <a
            href="https://ayzent-solutions.vercel.app/"
            target="_blank"
            rel="noopener noreferrer"
            className="public-site-credit"
          >
            Built by Ayzent Solutions
          </a>
        </div>
      </footer>
    </main>
  );
}
