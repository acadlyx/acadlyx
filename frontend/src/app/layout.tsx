import type { Metadata } from "next";
import { Suspense } from "react";
import { headers } from "next/headers";
import "./globals.css";
import "./acadlyx-contrast.css";
import "./acadlyx-responsive.css";
import "./acadlyx-dashboard-tokens.css";
import "./acadlyx-modal-responsive.css";
import "./public-site.css";
import { ProtectedRouteBoundary } from "@/components/auth/ProtectedRouteBoundary";
import { PersistentDashboardRoute } from "@/components/dashboard/PersistentDashboardRoute";
import { ResponsiveNavigationGuard } from "@/components/system/ResponsiveNavigationGuard";
import { ServiceWorkerRegistration } from "@/components/system/ServiceWorkerRegistration";
import { API_BASE_URL } from "@/lib/api";
import { siteConfig } from "@/lib/seo/config";
import { organizationSchema, softwareSchema, websiteSchema } from "@/lib/seo/schema";

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: { default: siteConfig.title, template: "%s | ACADLYX" },
  description: siteConfig.description,
  keywords: [...siteConfig.keywords],
  applicationName: siteConfig.name,
  category: "Education software",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/branding/acadlyx-logo.png", apple: "/branding/acadlyx-logo.png" },
  openGraph: { type: "website", siteName: siteConfig.name, title: siteConfig.title, description: siteConfig.description, url: siteConfig.url },
  twitter: { card: "summary", title: siteConfig.title, description: siteConfig.description },
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const isPublicRoute = (await headers()).get("x-acadlyx-public-route") === "1";
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href={API_BASE_URL} crossOrigin="anonymous" />
        <link rel="dns-prefetch" href={API_BASE_URL} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify([organizationSchema, websiteSchema, softwareSchema]).replace(/</g, "\\u003c") }} />
      </head>
      <body className="min-h-screen antialiased">
        {isPublicRoute ? children : <><ServiceWorkerRegistration /><ResponsiveNavigationGuard /><Suspense fallback={null}><ProtectedRouteBoundary><PersistentDashboardRoute>{children}</PersistentDashboardRoute></ProtectedRouteBoundary></Suspense></>}
      </body>
    </html>
  );
}
