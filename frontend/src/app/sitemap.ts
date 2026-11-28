import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/seo/config";
const routes = ["", "/about", "/platform", "/solutions", "/modules", "/features", "/education-erp", "/college-management-system", "/student-management", "/admission-management", "/attendance-management", "/examination-management", "/fee-management", "/faculty-management", "/obe-management", "/institutional-intelligence", "/resources", "/contact", "/request-demo"];
export default function sitemap(): MetadataRoute.Sitemap { const lastModified = new Date("2026-11-28T00:00:00.000Z"); return routes.map((path) => ({ url: absoluteUrl(path), lastModified, changeFrequency: "monthly", priority: path === "" ? 1 : path === "/request-demo" || path === "/contact" ? 0.6 : 0.8 })); }
