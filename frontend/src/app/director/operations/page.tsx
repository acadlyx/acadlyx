"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Legacy route: replace browser history with the role-owned Director workspace. */
export default function DirectorOperationsRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/director");
  }, [router]);
  return null;
}
