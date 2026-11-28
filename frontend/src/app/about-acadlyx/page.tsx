import Image from "next/image";
import { PublicSiteShell } from "@/components/public/PublicSiteShell";
import { publicMetadata } from "@/lib/seo/metadata";
import { getPublishedProductPage } from "@/lib/publicSiteContent";

export async function generateMetadata() {
  const page = await getPublishedProductPage();
  return publicMetadata({
    title:
      page?.seo?.title ||
      "About ACADLYX | Education ERP for Colleges and Universities",
    description:
      page?.seo?.description ||
      "Product information, workflows and details about ACADLYX, managed by the ACADLYX content team.",
    path: "/about-acadlyx",
  });
}

export default async function AboutAcadlyxPage() {
  const page = await getPublishedProductPage();

  if (!page) {
    return (
      <PublicSiteShell>
        <section className="cms-state public-container" aria-live="polite">
          <h1>This page has not been published.</h1>
        </section>
      </PublicSiteShell>
    );
  }

  const sections = page.sections.filter(
    (section) => section.visible && section.title?.trim() && section.body?.trim(),
  );

  return (
    <PublicSiteShell>
      <article className="cms-product-page">
        <header className="cms-product-intro public-container">
          <h1>{page.title}</h1>
          {page.introduction?.trim() ? <p>{page.introduction}</p> : null}
        </header>

        {sections.map((section) => {
          const hasImage = Boolean(section.imageUrl);
          const layout =
            section.layout === "split" && hasImage ? "split" : "statement";

          return (
            <section
              key={section.id}
              className={`cms-product-section cms-product-section--${layout}`}
              aria-labelledby={`cms-section-${section.id}`}
            >
              <div className="public-container cms-product-section-inner">
                <header>
                  <h2 id={`cms-section-${section.id}`}>{section.title}</h2>
                </header>

                <div className="cms-product-section-copy">
                  <p>{section.body}</p>
                </div>

                {hasImage ? (
                  <figure>
                    <Image
                      src={section.imageUrl!}
                      alt={section.imageAlt?.trim() || section.title}
                      width={1440}
                      height={960}
                      sizes="(max-width: 820px) 100vw, 42vw"
                    />
                  </figure>
                ) : null}
              </div>
            </section>
          );
        })}
      </article>
    </PublicSiteShell>
  );
}
