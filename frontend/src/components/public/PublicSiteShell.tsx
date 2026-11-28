import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

export function PublicSiteShell({ children }: { children: ReactNode }) {
  return (
    <main className="public-site public-site--quiet">
      <header className="public-site-header public-site-header--quiet">
        <div className="public-container public-site-header-inner">
          <Link href="/" className="public-site-brand" aria-label="ACADLYX home">
            <Image src="/branding/acadlyx-logo.png" alt="" width={38} height={38} priority />
            <span>ACADLYX</span>
          </Link>

          <Link href="/login" className="public-sign-in public-sign-in--quiet">Sign in</Link>
        </div>
      </header>

      {children}

      <footer className="public-footer public-footer--quiet">
        <div className="public-container public-footer-bottom public-footer-bottom--quiet">
          <span>© {new Date().getFullYear()} ACADLYX. A product of Ayzent Solutions.</span>
          <span>Education ERP &amp; Institutional Intelligence Platform</span>
        </div>
      </footer>
    </main>
  );
}
