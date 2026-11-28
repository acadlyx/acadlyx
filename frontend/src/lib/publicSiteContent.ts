import { API_BASE_URL } from "@/lib/api";

export type ProductSection = {
  id: string;
  visible: boolean;
  title: string;
  body: string;
  imageUrl?: string;
  imageAlt?: string;
  layout?: "statement" | "split";
};

export type ProductPageContent = {
  seo?: { title?: string; description?: string };
  title: string;
  introduction: string;
  sections: ProductSection[];
  media?: Array<{ url: string; alt: string; caption?: string }>;
};

export type PublishedSiteContent = {
  brand?: { siteName?: string; logoUrl?: string };
  hero?: {
    title?: string;
    description?: string;
    dashboardImageUrl?: string;
    dashboardCaption?: string;
  };
  sections?: {
    capabilitiesTitle?: string;
    capabilitiesDescription?: string;
    features?: Array<{ title?: string; text?: string }>;
    rolesTitle?: string;
    rolesDescription?: string;
  };
  footer?: { text?: string };
  productPage?: ProductPageContent;
};

type PublicCmsResponse = {
  data?: { content?: PublishedSiteContent };
};

export async function getPublishedSiteContent(): Promise<PublishedSiteContent | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/site-content/public`, {
      next: { revalidate: 60 },
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as PublicCmsResponse;
    return payload.data?.content ?? null;
  } catch {
    return null;
  }
}

export async function getPublishedProductPage(): Promise<ProductPageContent | null> {
  const page = (await getPublishedSiteContent())?.productPage;
  if (!page || !page.title?.trim() || !Array.isArray(page.sections)) return null;
  return page;
}
