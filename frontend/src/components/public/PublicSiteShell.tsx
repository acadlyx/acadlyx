"use client";

import Image from "next/image";
import Link from "next/link";
import { ReactNode, useEffect, useState } from "react";
import { usePathname } from "next/navigation";

const navigation = [
  { label: "Platform", href: "/platform" },
  { label: "Solutions", href: "/solutions" },
  { label: "Modules", href: "/modules" },
  { label: "About", href: "/about" },
];

export function PublicSiteShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() || "/";
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
    };

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, []);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  return (
    <main className="public-site">
      <header className="public-site-header">
        <div className="public-container public-site-header-inner">
          <Link href="/" className="public-site-brand" aria-label="ACADLYX home">
            <Image src="/branding/acadlyx-logo.png" alt="" width={38} height={38} priority />
            <span>ACADLYX</span>
          </Link>

          <nav className="public-desktop-nav" aria-label="Primary navigation">
            {navigation.map((item) => (
              <Link
                href={item.href}
                key={item.href}
                aria-current={pathname === item.href ? "page" : undefined}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="public-header-actions">
            <Link href="/login" className="public-sign-in">Sign in</Link>
            <Link href="/request-demo" className="public-button public-button-small">
              Request a demo
            </Link>
            <button
              type="button"
              className="public-mobile-toggle"
              aria-label={mobileOpen ? "Close navigation" : "Open navigation"}
              aria-expanded={mobileOpen}
              onClick={() => setMobileOpen((open) => !open)}
            >
              <MenuIcon close={mobileOpen} />
            </button>
          </div>
        </div>

        {mobileOpen ? (
          <div className="public-mobile-panel" id="public-mobile-navigation">
            <nav className="public-mobile-nav" aria-label="Mobile navigation">
              {navigation.map((item) => (
                <Link
                  href={item.href}
                  key={item.href}
                  aria-current={pathname === item.href ? "page" : undefined}
                  onClick={() => setMobileOpen(false)}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            <div className="public-mobile-actions">
              <Link
                href="/request-demo"
                onClick={() => setMobileOpen(false)}
                className="public-button"
              >
                Request a demo
              </Link>
              <Link
                href="/login"
                onClick={() => setMobileOpen(false)}
                className="public-mobile-sign-in"
              >
                Sign in
              </Link>
            </div>
          </div>
        ) : null}
      </header>

      {children}

      <footer className="public-footer">
        <div className="public-container public-footer-grid">
          <div className="public-footer-brand">
            <Link href="/" className="public-site-brand" aria-label="ACADLYX home">
              <Image src="/branding/acadlyx-logo.png" alt="" width={36} height={36} />
              <span>ACADLYX</span>
            </Link>
            <p>Connected operations and institutional intelligence for education.</p>
          </div>

          <FooterColumn
            title="Explore"
            links={[
              ["Platform", "/platform"],
              ["Solutions", "/solutions"],
              ["Modules", "/modules"],
              ["About ACADLYX", "/about"],
            ]}
          />

          <FooterColumn
            title="Company"
            links={[
              ["Resources", "/resources"],
              ["Contact", "/contact"],
              ["Sign in", "/login"],
            ]}
          />
        </div>

        <div className="public-container public-footer-bottom">
          <span>© {new Date().getFullYear()} ACADLYX. All rights reserved.</span>
        </div>
      </footer>
    </main>
  );
}

function MenuIcon({ close = false }: { close?: boolean }) {
  return (
    <span className={close ? "public-menu-icon is-close" : "public-menu-icon"} aria-hidden="true">
      <i />
      <i />
      <i />
    </span>
  );
}

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: [string, string][];
}) {
  return (
    <div className="public-footer-column">
      <h2>{title}</h2>
      {links.map(([label, href]) => (
        <Link key={href} href={href}>{label}</Link>
      ))}
    </div>
  );
}
