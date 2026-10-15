"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Client-side compatibility redirect keeps the active browser session intact.
 * A server redirect can bounce authenticated users to the public root because
 * ACADLYX's access token is held in sessionStorage rather than an HTTP cookie.
 */
export default function DirectorOperationsRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/director");
  }, [router]);
  return <main aria-live="polite" className="p-6">Opening Director workspace…</main>;
}
