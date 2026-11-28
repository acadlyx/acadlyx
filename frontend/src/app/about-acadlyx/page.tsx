import Image from "next/image";
import { PublicSiteShell } from "@/components/public/PublicSiteShell";
import { publicMetadata } from "@/lib/seo/metadata";
import { getPublishedProductPage } from "@/lib/publicSiteContent";

export async function generateMetadata() {
  const page = await getPublishedProductPage();
  return publicMetadata({
    title: page?.seo?.title || "About ACADLYX | Education ERP & Institutional Intelligence",
    description: page?.seo?.description || "Learn how ACADLYX connects academic management, institutional operations and institutional intelligence for colleges and universities.",
    path: "/about-acadlyx",
  });
}

export default async function AboutAcadlyxPage() {
  const page = await getPublishedProductPage();
  if (!page) return <PublicSiteShell><section className="cms-state public-container"><h1>ACADLYX information is being prepared.</h1><p>This page will be available when its published CMS content is ready.</p></section></PublicSiteShell>;
  const sections = page.sections.filter((section) => section.visible && section.title && section.body);
  return <PublicSiteShell>
    <article className="cms-product-page">
      <header className="cms-product-intro public-container"><p className="home-kicker">ABOUT ACADLYX</p><h1>{page.title}</h1><p>{page.introduction}</p></header>
      {sections.map((section, index) => <section key={section.id} className={`cms-product-section ${section.layout === "split" ? "cms-product-section--split" : ""}`}>
        <div className="public-container cms-product-section-inner"><span>{String(index + 1).padStart(2, "0")}</span><div><h2>{section.title}</h2><p>{section.body}</p></div>{section.imageUrl ? <figure><Image src={section.imageUrl} alt={section.imageAlt || section.title} width={1200} height={760} sizes="(max-width: 820px) 100vw, 45vw" /></figure> : null}</div>
      </section>)}
    </article>
  </PublicSiteShell>;
}
