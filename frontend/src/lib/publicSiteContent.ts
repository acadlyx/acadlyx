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

type PublicCmsResponse = { data?: { content?: { productPage?: ProductPageContent } } };

/** Read only the published platform document. No editor credentials reach the public route. */
export async function getPublishedProductPage(): Promise<ProductPageContent | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/site-content/public`, {
      next: { revalidate: 60 },
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return null;
    const payload = await response.json() as PublicCmsResponse;
    const page = payload.data?.content?.productPage;
    if (!page || !page.title || !Array.isArray(page.sections)) return null;
    return page;
  } catch {
    return null;
  }
}
