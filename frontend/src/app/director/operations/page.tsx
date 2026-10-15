"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Compatibility route for old Director bookmarks. Use the app router so the
 * existing client session remains mounted and auth state is not reset by a
 * full-document navigation.
 */
export default function DirectorOperationsRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/director");
  }, [router]);
  return <main aria-live="polite" className="p-6">Opening Director workspace…</main>;
}
