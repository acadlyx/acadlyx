import type { Metadata } from "next";
import "./globals.css";
import "./acadlyx-contrast.css";
import "./acadlyx-responsive.css";
import { ServiceWorkerRegistration } from "@/components/system/ServiceWorkerRegistration";
import { API_BASE_URL } from "@/lib/api";

export const metadata: Metadata = {
  title: "ACADLYX",
  description: "Education ERP & Institutional Intelligence Platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        {/* Establish the API connection before the first authenticated request. */}
        <link rel="preconnect" href={API_BASE_URL} crossOrigin="anonymous" />
        <link rel="dns-prefetch" href={API_BASE_URL} />
      </head>
      <body className="min-h-screen antialiased">
        <ServiceWorkerRegistration />
        {children}
      </body>
    </html>
  );
}
