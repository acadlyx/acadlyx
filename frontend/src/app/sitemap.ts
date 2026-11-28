import type { MetadataRoute } from "next";
export default function sitemap(): MetadataRoute.Sitemap { const origin = process.env.NEXT_PUBLIC_SITE_URL || "https://acadlyx.com"; const routes = ["", "/platform", "/solutions", "/modules", "/about", "/contact", "/resources", "/request-demo"]; return routes.map((path) => ({ url: origin + path, changeFrequency: "monthly", priority: path ? 0.7 : 1 })); }
