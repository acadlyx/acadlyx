import type { Metadata } from "next";
import { Suspense } from "react";
import "./globals.css";
import "./acadlyx-contrast.css";
import "./acadlyx-responsive.css";
import "./acadlyx-dashboard-tokens.css";
import "./acadlyx-modal-responsive.css";
import { ProtectedRouteBoundary } from "@/components/auth/ProtectedRouteBoundary";
import { PersistentDashboardRoute } from "@/components/dashboard/PersistentDashboardRoute";
import { ResponsiveNavigationGuard } from "@/components/system/ResponsiveNavigationGuard";
import { ServiceWorkerRegistration } from "@/components/system/ServiceWorkerRegistration";
import { API_BASE_URL } from "@/lib/api";

export const metadata: Metadata = {
  title: "ACADLYX",
  description: "Education ERP & Institutional Intelligence Platform",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href={API_BASE_URL} crossOrigin="anonymous" />
        <link rel="dns-prefetch" href={API_BASE_URL} />
      </head>
      <body className="min-h-screen antialiased">
        <ServiceWorkerRegistration />
        <ResponsiveNavigationGuard />
        <Suspense fallback={null}>
          <ProtectedRouteBoundary><PersistentDashboardRoute>{children}</PersistentDashboardRoute></ProtectedRouteBoundary>
        </Suspense>
      </body>
    </html>
  );
}
