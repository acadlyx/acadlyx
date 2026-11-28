import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/seo/config";

/** The public site has a homepage and one CMS-managed product information page. */
const routes = ["", "/about-acadlyx"];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return routes.map((path) => ({
    url: absoluteUrl(path),
    lastModified,
    changeFrequency: "weekly",
    priority: path === "" ? 1 : 0.8,
  }));
}
