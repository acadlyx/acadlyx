"use client";

import Image from "next/image";
import { PublicSiteShell, usePublicSiteContent } from "@/components/public/PublicSiteShell";

type PartnerItem = {
  title: string;
  description: string;
  meta?: string;
  imageUrl?: string;
  linkUrl?: string;
};

export default function PartnersPage() {
  const content = usePublicSiteContent();
  const page = content.pages.partners || {};
  const items: PartnerItem[] = Array.isArray(page.items) ? page.items : [];

  return (
    <PublicSiteShell>
      <section className="public-page-section">
        <header className="public-page-intro">
          <p className="public-eyebrow">{page.eyebrow || "Published information"}</p>
          <h1>{page.title || "Partners and external resources"}</h1>
          <p>{page.description || "Partner information published by the website team."}</p>
        </header>
        {items.length ? (
          <div className="public-editorial-list">
            {items.map((item, index) => (
              <article key={item.title + "-" + index} className="public-editorial-row">
                {item.imageUrl ? (
                  <div className="public-editorial-media">
                    <Image src={item.imageUrl} alt={item.title} width={180} height={96} className="public-partner-image" />
                  </div>
                ) : null}
                <div className="public-editorial-copy">
                  {item.meta ? <p className="public-editorial-meta">{item.meta}</p> : null}
                  <h2>{item.title}</h2>
                  <p>{item.description}</p>
                  {item.linkUrl ? (
                    <a href={item.linkUrl} target="_blank" rel="noopener noreferrer" className="public-editorial-link">
                      Visit partner website
                    </a>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="public-empty-message">No partner information has been published.</p>
        )}
      </section>
    </PublicSiteShell>
  );
}
