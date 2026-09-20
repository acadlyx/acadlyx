import type { Metadata } from "next";
import "./globals.css";
import { ServiceWorkerRegistration } from "@/components/system/ServiceWorkerRegistration";

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
      <body className="min-h-screen bg-slate-50 antialiased">
        <ServiceWorkerRegistration />
        {children}
      </body>
    </html>
  );
}
