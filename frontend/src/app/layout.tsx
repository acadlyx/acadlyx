import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ACADLYX",
  description: "Education ERP & Institutional Intelligence Platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white antialiased">{children}</body>
    </html>
  );
}
