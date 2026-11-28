import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/seo/config";
export default function robots(): MetadataRoute.Robots { return { rules: { userAgent: "*", allow: "/", disallow: ["/admin/", "/student/", "/faculty/", "/management/", "/director/", "/superadmin/", "/parent/", "/staff/", "/login", "/forgot-password", "/reset-password", "/api/"] }, sitemap: absoluteUrl("/sitemap.xml") }; }
