"use client";

import Image from "next/image";
import { PublicSiteShell, usePublicSiteContent } from "@/components/public/PublicSiteShell";

type UpdateItem = {
  title: string;
  description: string;
  meta?: string;
  imageUrl?: string;
  linkUrl?: string;
};

export default function UpdatesPage() {
  const content = usePublicSiteContent();
  const page = content.pages.updates || {};
  const items: UpdateItem[] = Array.isArray(page.items) ? page.items : [];

  return (
    <PublicSiteShell>
      <section className="public-page-section">
        <header className="public-page-intro">
          <h1>{page.title || "ACADLYX updates"}</h1>
        </header>
        {items.length ? (
          <div className="public-editorial-list public-update-list">
            {items.map((item, index) => (
              <article key={item.title + "-" + index} className="public-editorial-row">
                {item.imageUrl ? (
                  <div className="public-update-media">
                    <Image src={item.imageUrl} alt="" width={480} height={280} className="public-update-image" />
                  </div>
                ) : null}
                <div className="public-editorial-copy">
                  {item.meta ? <p className="public-editorial-meta">{item.meta}</p> : null}
                  <h2>{item.title}</h2>
                  <p>{item.description}</p>
                  {item.linkUrl ? (
                    <a href={item.linkUrl} target="_blank" rel="noopener noreferrer" className="public-editorial-link">
                      Read update
                    </a>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="public-empty-message">No public updates have been published.</p>
        )}
      </section>
    </PublicSiteShell>
  );
}
