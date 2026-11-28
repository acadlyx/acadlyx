import Image from "next/image";
import Link from "next/link";
import { getPublishedSiteContent } from "@/lib/publicSiteContent";

export async function PublicSiteShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const content = await getPublishedSiteContent();
  const siteName = content?.brand?.siteName?.trim() || "ACADLYX";
  const logoUrl = content?.brand?.logoUrl?.trim() || "/branding/acadlyx-logo.png";
  const footerText =
    content?.footer?.text?.trim() || "Education ERP for colleges and universities";

  return (
    <div className="public-site public-site--quiet">
      <a className="public-skip-link" href="#main-content">
        Skip to content
      </a>

      <header className="public-site-header public-site-header--quiet">
        <div className="public-container public-site-header-inner">
          <Link href="/" className="public-site-brand" aria-label={`${siteName} home`}>
            <Image
              src={logoUrl}
              alt=""
              width={34}
              height={34}
              priority
              unoptimized
            />
            <span>{siteName}</span>
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
            © {new Date().getFullYear()} {siteName}. A product of Ayzent Solutions.
          </span>
          <span>{footerText}</span>
        </div>
      </footer>
    </div>
  );
}
