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

export default function HomePage() {
  const content = usePublicSiteContent();
  const [loginOpen, setLoginOpen] = useState(false);

  return (
    <PublicSiteShell onLogin={() => setLoginOpen((open) => !open)}>
      {loginOpen ? (
        <section className="public-login-layout" aria-label="Sign in to ACADLYX">
          <div className="public-login-intro">
            <p className="public-eyebrow">ACADLYX workspace</p>
            <h1>Access the work assigned to your role.</h1>
            <p>Sign in to open your institutional workspace. Available areas and records follow your assigned access.</p>
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
        <section className="public-home-hero">
          <div className="public-home-copy">
            <p className="public-eyebrow">
              {content.hero?.eyebrow || "EDUCATION ERP & INSTITUTIONAL INTELLIGENCE"}
            </p>
            <h1 className="public-home-title">
              {content.hero?.title || "Run academic and institutional work from one connected ERP."}
            </h1>
            <p className="public-home-description">
              {content.hero?.description || "ACADLYX connects admissions, academic delivery, fees and finance, examinations, learning, library and placements through role-scoped institutional workspaces."}
            </p>
            <div className="public-home-actions">
              <button type="button" onClick={() => setLoginOpen(true)} className="public-primary-action">
                Sign in to ACADLYX
              </button>
              <Link href="/about" className="public-secondary-action">
                About the platform
              </Link>
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
      )}
    </PublicSiteShell>
  );
}
