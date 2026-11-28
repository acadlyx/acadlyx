import Image from "next/image";
import Link from "next/link";

export function PublicSiteShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="public-site public-site--quiet">
      <a className="public-skip-link" href="#main-content">
        Skip to content
      </a>

      <header className="public-site-header public-site-header--quiet">
        <div className="public-container public-site-header-inner">
          <Link href="/" className="public-site-brand" aria-label="ACADLYX home">
            <Image
              src="/branding/acadlyx-logo.png"
              alt=""
              width={34}
              height={34}
              priority
            />
            <span>ACADLYX</span>
          </Link>

          <Link href="/login" className="public-sign-in public-sign-in--quiet">
            Sign in
          </Link>
        </div>
      </header>

      <main id="main-content" tabIndex={-1}>
        {children}
      </main>

      <footer className="public-footer public-footer--quiet">
        <div className="public-container public-footer-bottom public-footer-bottom--quiet">
          <span>
            © {new Date().getFullYear()} ACADLYX. A product of Ayzent Solutions.
          </span>
          <span>Education ERP for colleges and universities</span>
        </div>
      </footer>
    </div>
  );
}
