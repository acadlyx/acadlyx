"use client";

import { useEffect } from "react";

/**
 * Client-side compatibility redirect keeps the active browser session intact.
 * A server redirect can bounce authenticated users to the public root because
 * ACADLYX's access token is held in sessionStorage rather than an HTTP cookie.
 */
export default function DirectorOperationsRedirect() {
  useEffect(() => {
    // A full client-side navigation avoids racing the legacy route's auth guard;
    // sessionStorage tokens survive this same-origin navigation.
    window.location.replace("/director");
  }, []);
  return <main aria-live="polite" className="p-6">Opening Director workspace…</main>;
}
