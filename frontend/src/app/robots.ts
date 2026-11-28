import type { MetadataRoute } from "next";
export default function robots(): MetadataRoute.Robots { return { rules: { userAgent: "*", allow: ["/", "/platform", "/solutions", "/modules", "/about", "/contact", "/resources", "/request-demo"], disallow: ["/admin", "/student", "/faculty", "/management", "/director", "/superadmin"] }, sitemap: "/sitemap.xml" }; }
