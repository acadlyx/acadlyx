"use client";

import { useState } from "react";
import { InlineLogin } from "@/components/public/InlineLogin";
import { PublicSiteShell, usePublicSiteContent } from "@/components/public/PublicSiteShell";

export default function HomePage() {
  const content = usePublicSiteContent();
  const [loginOpen, setLoginOpen] = useState(false);

  return (
    <PublicSiteShell onLogin={() => setLoginOpen((open) => !open)}>
      {loginOpen ? (
        <section className="mx-auto max-w-md px-5 py-16 sm:py-24" aria-label="Sign in to ACADLYX">
          <div className="mb-6 flex items-center justify-between">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Sign in</h1>
            <button type="button" onClick={() => setLoginOpen(false)} className="text-sm font-medium text-slate-500 hover:text-slate-900">Close</button>
          </div>
          <InlineLogin />
        </section>
      ) : (
        <section className="mx-auto flex min-h-[68vh] max-w-7xl flex-col items-start justify-center px-5 py-24 sm:px-8 lg:py-32">
          <h1 className="max-w-3xl text-4xl font-semibold leading-tight tracking-tight text-slate-950 sm:text-6xl">
            {content.hero.title || "One institution. One connected system."}
          </h1>
          <p className="mt-6 max-w-xl text-base leading-7 text-slate-600 sm:text-lg">
            {content.hero.description || "ACADLYX brings academic and institutional operations together in one place."}
          </p>
          <button
            type="button"
            onClick={() => setLoginOpen(true)}
            className="mt-9 inline-flex min-h-11 items-center justify-center rounded-md bg-[#315c4a] px-6 py-3 text-sm font-semibold text-white hover:bg-[#244638] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#315c4a] focus-visible:ring-offset-2"
          >
            {content.hero.primaryCtaLabel || "Sign in"}
          </button>
        </section>
      )}
    </PublicSiteShell>
  );
}
