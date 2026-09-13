import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";
import { AuthenticatedUser } from "../types/auth";

export type SiteContent = {
  brand: {
    siteName: string;
    tagline: string;
    acadlyxLogoUrl: string;
    institutionLogoUrl: string;
    faviconUrl: string;
  };
  hero: {
    eyebrow: string;
    title: string;
    description: string;
    primaryCtaLabel: string;
    primaryCtaHref: string;
    secondaryCtaLabel: string;
    secondaryCtaHref: string;
    slides: { imageUrl: string; title?: string; subtitle?: string }[];
  };
  sections: {
    aboutTitle: string;
    aboutText: string;
    features: { title: string; text: string; icon?: string }[];
    stats: { label: string; value: string }[];
    gallery: { imageUrl: string; title?: string; alt?: string }[];
  };
  contact: { email: string; phone: string; address: string; website: string };
  footer: { text: string; links: { label: string; href: string }[] };
};

export const DEFAULT_SITE_CONTENT: SiteContent = {
  brand: {
    siteName: "ACADLYX",
    tagline: "Education ERP & Institutional Intelligence",
    acadlyxLogoUrl: "/branding/acadlyx-logo.png",
    institutionLogoUrl: "/branding/aimt-logo.png",
    faviconUrl: "/branding/acadlyx-logo.png",
  },
  hero: {
    eyebrow: "ERP + Analytics + Institutional Intelligence",
    title: "A clearer operating system for modern institutions.",
    description: "ACADLYX connects academic operations, student success, institutional intelligence and career readiness in one platform.",
    primaryCtaLabel: "Login to ERP",
    primaryCtaHref: "/login",
    secondaryCtaLabel: "Explore capabilities",
    secondaryCtaHref: "#capabilities",
    slides: [],
  },
  sections: {
    aboutTitle: "One connected institutional platform",
    aboutText: "Built for students, faculty, parents and institutional leadership.",
    features: [
      { title: "Academic operations", text: "Students, faculty, courses, sections, attendance, assignments, marks and examinations." },
      { title: "Institutional intelligence", text: "Academic health, risk signals, recommendations and decision support." },
      { title: "Career readiness", text: "Skills, target roles, placement readiness and opportunity tracking." },
    ],
    stats: [
      { label: "Students", value: "10,000+" },
      { label: "Faculty & staff", value: "1,000+" },
      { label: "Institution", value: "AIMT" },
      { label: "Platform", value: "ACADLYX" },
    ],
    gallery: [],
  },
  contact: { email: "", phone: "", address: "", website: "" },
  footer: {
    text: "ACADLYX · Education ERP & Institutional Intelligence",
    links: [{ label: "ERP Login", href: "/login" }],
  },
};

function mergeDefaults(value: unknown): SiteContent {
  const input = (value && typeof value === "object" ? value : {}) as Partial<SiteContent>;
  return {
    ...DEFAULT_SITE_CONTENT,
    ...input,
    brand: { ...DEFAULT_SITE_CONTENT.brand, ...(input.brand || {}) },
    hero: { ...DEFAULT_SITE_CONTENT.hero, ...(input.hero || {}), slides: Array.isArray(input.hero?.slides) ? input.hero!.slides : [] },
    sections: {
      ...DEFAULT_SITE_CONTENT.sections,
      ...(input.sections || {}),
      features: Array.isArray(input.sections?.features) ? input.sections!.features : DEFAULT_SITE_CONTENT.sections.features,
      stats: Array.isArray(input.sections?.stats) ? input.sections!.stats : DEFAULT_SITE_CONTENT.sections.stats,
      gallery: Array.isArray(input.sections?.gallery) ? input.sections!.gallery : [],
    },
    contact: { ...DEFAULT_SITE_CONTENT.contact, ...(input.contact || {}) },
    footer: { ...DEFAULT_SITE_CONTENT.footer, ...(input.footer || {}), links: Array.isArray(input.footer?.links) ? input.footer!.links : DEFAULT_SITE_CONTENT.footer.links },
  };
}

export async function getPublicSiteContent(institutionId: string): Promise<SiteContent> {
  const record = await prisma.siteContent.findUnique({ where: { institutionId } });
  return mergeDefaults(record?.content);
}

export async function getSiteContent(institutionId: string): Promise<SiteContent> {
  return getPublicSiteContent(institutionId);
}

export async function updateSiteContent(institutionId: string, actor: AuthenticatedUser, content: unknown) {
  if (!actor.roles.some((r) => ["SUPER_ADMIN", "INSTITUTION_ADMIN", "DIRECTOR", "MANAGEMENT"].includes(r))) {
    throw new AppError("You are not allowed to manage website content", 403);
  }
  const normalized = mergeDefaults(content);
  const existing = await prisma.siteContent.findUnique({ where: { institutionId } });
  return prisma.siteContent.upsert({
    where: { institutionId },
    update: { content: normalized as any, version: { increment: 1 }, updatedById: actor.id, publishedAt: new Date() },
    create: { institutionId, content: normalized as any, updatedById: actor.id },
  });
}
