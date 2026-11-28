export const siteConfig = {
  url: process.env.NEXT_PUBLIC_SITE_URL || "https://acadlyx-orcin.vercel.app",
  name: "ACADLYX",
  company: "Ayzent Solutions",
  title: "ACADLYX | Education ERP & Institutional Intelligence Platform",
  description: "ACADLYX is an integrated Education ERP and Institutional Intelligence Platform that helps colleges and universities manage admissions, academics, attendance, examinations, fees, faculty, placements and institutional operations.",
  keywords: ["ACADLYX", "Education ERP", "College Management Software", "University Management System", "Institutional Management Platform", "Student Information System", "Academic Management Software"],
} as const;
export function absoluteUrl(path = "/") { return new URL(path, siteConfig.url).toString(); }
