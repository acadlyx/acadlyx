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
          <h1>{page.title || "Contact the ACADLYX team"}</h1>
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
