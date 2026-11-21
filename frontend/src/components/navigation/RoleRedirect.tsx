"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { AuthRequiredError, getCurrentUser } from "@/lib/auth";
import { getPrimaryRole } from "@/lib/authority";
import { workspaceHome } from "@/lib/navigation";

export function RoleRedirect({
  destinations,
  title = "Opening your authorized workspace…",
}: {
  destinations: Record<string, string>;
  title?: string;
}) {
  const router = useRouter();
  const [error, setError] = useState("");

  const resolveDestination = useCallback(async () => {
    setError("");
    try {
      const user = await getCurrentUser();
      const role = getPrimaryRole(user.roles);
      const destination = role ? destinations[role] : undefined;

      router.replace(destination || workspaceHome(user.roles) || "/login");
    } catch (cause) {
      if (cause instanceof AuthRequiredError) {
        router.replace("/login");
        return;
      }
      setError("We couldn't verify the destination for your current workspace. Check your connection and retry.");
    }
  }, [destinations, router]);

  useEffect(() => {
    void resolveDestination();
  }, [resolveDestination]);

  return (
    <main className="mx-auto flex min-h-[40vh] max-w-xl flex-col items-start justify-center gap-4 px-4 py-10">
      <p role={error ? "alert" : "status"} aria-live={error ? "assertive" : "polite"} className="text-sm font-medium text-[var(--acadlyx-muted)]">
        {error || title}
      </p>
      {error ? (
        <button
          type="button"
          onClick={() => void resolveDestination()}
          className="acadlyx-button acadlyx-button-primary"
        >
          Retry
        </button>
      ) : null}
    </main>
  );
}
