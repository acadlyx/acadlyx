"use client";

import { useState } from "react";
import Link from "next/link";
import { InlineLogin } from "@/components/public/InlineLogin";
import { PublicSiteShell, usePublicSiteContent } from "@/components/public/PublicSiteShell";

const platformAreas = [
  { number: "01", title: "Admissions", detail: "Applications and enrolment" },
  { number: "02", title: "Academics", detail: "Programmes and course delivery" },
  { number: "03", title: "Finance", detail: "Fees, invoices and payments" },
  { number: "04", title: "Examinations", detail: "Assessment and results" },
  { number: "05", title: "Learning & library", detail: "Courses and circulation" },
  { number: "06", title: "Placements", detail: "Drives and student outcomes" },
];

const publicDestinations = new Set(["/about", "/contact", "/partners", "/updates", "/team"]);

export default function HomePage() {
  const content = usePublicSiteContent();
  const [loginOpen, setLoginOpen] = useState(false);
  const features = Array.isArray(content.sections?.features) ? content.sections.features : [];
  const roles = Array.isArray(content.sections?.roles) ? content.sections.roles : [];
  const requestedSecondaryHref = content.hero?.secondaryCtaHref;
  const validExternalHref =
    typeof requestedSecondaryHref === "string" && /^https?:\/\//i.test(requestedSecondaryHref);
  const secondaryHref =
    typeof requestedSecondaryHref === "string" &&
    (publicDestinations.has(requestedSecondaryHref) || validExternalHref)
      ? requestedSecondaryHref
      : "/about";
  const secondaryLabel = content.hero?.secondaryCtaLabel || "About the platform";

  return (
    <PublicSiteShell onLogin={() => setLoginOpen((open) => !open)}>
      {loginOpen ? (
        <section className="public-login-layout" aria-label="Sign in to ACADLYX">
          <div className="public-login-intro">
            <h1>Access the work assigned to your role.</h1>
          </div>
          <div className="public-login-form-wrap">
            <div className="public-login-heading">
              <h2>Sign in</h2>
              <button type="button" onClick={() => setLoginOpen(false)} className="public-text-button">
                Back to website
              </button>
            </div>
            <InlineLogin />
          </div>
        </section>
      ) : (
        <>
          <section className="public-home-hero">
            <div className="public-home-copy">
              <h1 className="public-home-title">
                {content.hero?.title || "Coordinate admissions, academics, finance and student services in one ERP."}
              </h1>
              <div className="public-home-actions">
                <button type="button" onClick={() => setLoginOpen(true)} className="public-primary-action">
                  {content.hero?.primaryCtaLabel || "Sign in to ACADLYX"}
                </button>
                {validExternalHref ? (
                  <a href={secondaryHref} target="_blank" rel="noopener noreferrer" className="public-secondary-action">
                    {secondaryLabel}
                  </a>
                ) : (
                  <Link href={secondaryHref} className="public-secondary-action">
                    {secondaryLabel}
                  </Link>
                )}
              </div>
              <p className="public-home-note">One institution. One connected system. Smarter decisions.</p>
            </div>

            <aside className="public-home-index" aria-label="ACADLYX platform areas">
              <div className="public-home-index-heading">
                <span>Platform coverage</span>
                <span>01 — 06</span>
              </div>
              <ol>
                {platformAreas.map((area) => (
                  <li key={area.number}>
                    <span className="public-home-index-number">{area.number}</span>
                    <span className="public-home-index-copy">
                      <strong>{area.title}</strong>
                      <small>{area.detail}</small>
                    </span>
                  </li>
                ))}
              </ol>
              <p className="public-home-index-footnote">
                Workspace access is determined by the user&apos;s assigned role and institutional permissions.
              </p>
            </aside>
          </section>

          {features.length ? (
            <section className="public-capabilities">
              <header className="public-capabilities-intro">
                <h2>{content.sections.capabilitiesTitle || "Operational workflows connected across the institution."}</h2>
                <p>{content.sections.capabilitiesDescription || "Explore the workflows available in the ACADLYX education ERP."}</p>
              </header>
              <ol className="public-capability-list">
                {features.map((feature: { title?: string; text?: string }, index: number) => (
                  <li key={(feature.title || "capability") + "-" + index} className="public-capability-row">
                    <span className="public-capability-number">{String(index + 1).padStart(2, "0")}</span>
                    <div>
                      {feature.title ? <h3>{feature.title}</h3> : null}
                      {feature.text ? <p>{feature.text}</p> : null}
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          ) : null}

          {roles.length ? (
            <section className="public-roles-section">
              <div className="public-roles-copy">
                <h2>{content.sections.rolesTitle || "Workspaces shaped around each responsibility."}</h2>
                <p>{content.sections.rolesDescription || "Navigation and available actions follow each account's assigned role and institutional scope."}</p>
              </div>
              <ul className="public-roles-list">
                {roles.map((role: string) => <li key={role}>{role}</li>)}
              </ul>
            </section>
          ) : null}
        </>
      )}
    </PublicSiteShell>
  );
}
