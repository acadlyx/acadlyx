"use client";

import { PublicSiteShell, usePublicSiteContent } from "@/components/public/PublicSiteShell";

export default function AboutPage() {
  const content = usePublicSiteContent();
  const page = content.pages.about || {};
  const title = page.title || "About ACADLYX";
  const description = page.description || "ACADLYX is an education ERP for coordinating academic, administrative and student-facing work through connected institutional workflows.";

  return (
    <PublicSiteShell>
      <section className="public-page-section public-about-layout">
        <div className="public-page-intro">
          <p className="public-eyebrow">{page.eyebrow || "The platform"}</p>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        {page.imageUrl ? (
          <figure className="public-about-image">
            <img src={page.imageUrl} alt={page.imageAlt || title} />
          </figure>
        ) : (
          <aside className="public-about-note">
            <span>ACADLYX</span>
            <p>Education ERP</p>
            <small>Academic operations · Institutional administration · Student services</small>
          </aside>
        )}
      </section>
    </PublicSiteShell>
  );
}
