"use client";

import { PublicSiteShell, usePublicSiteContent } from "@/components/public/PublicSiteShell";

export default function ContactPage() {
  const content = usePublicSiteContent();
  const page = content.pages.contact || {};
  const details = [
    { label: "Email", value: content.contact.email },
    { label: "Phone", value: content.contact.phone },
    { label: "Address", value: content.contact.address },
    { label: "Website", value: content.contact.website },
  ];

  return (
    <PublicSiteShell>
      <section className="public-page-section">
        <header className="public-page-intro">
          <p className="public-eyebrow">{page.eyebrow || "Contact"}</p>
          <h1>{page.title || "Contact the ACADLYX team"}</h1>
          <p>{page.description || "Use the published institutional contact details below to reach the team."}</p>
        </header>
        <dl className="public-contact-list">
          {details.map((detail) => (
            <div className="public-contact-row" key={detail.label}>
              <dt>{detail.label}</dt>
              <dd>{detail.value || "Not published"}</dd>
            </div>
          ))}
        </dl>
      </section>
    </PublicSiteShell>
  );
}
