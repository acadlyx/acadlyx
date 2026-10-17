"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthRequiredError, getCurrentUser } from "@/lib/auth";
import { getPrimaryRole } from "@/lib/authority";
import { workspaceHome } from "@/lib/navigation";

const PAYMENT_DESTINATION_BY_ROLE: Record<string, string> = {
  ACCOUNTS: "/accounts/payments",
  STUDENT: "/student/fees",
  PARENT: "/parent/children",
};

export default function PaymentsRouteAlias() {
  const router = useRouter();
  const [error, setError] = useState("");

  const openAuthorizedWorkspace = useCallback(async () => {
    setError("");
    try {
      const user = await getCurrentUser();
      const role = getPrimaryRole(user.roles);
      const destination = role ? PAYMENT_DESTINATION_BY_ROLE[role] : undefined;

      router.replace(destination || workspaceHome(user.roles));
    } catch (cause) {
      if (cause instanceof AuthRequiredError) {
        router.replace("/login");
        return;
      }
      setError("The authorized payments workspace could not be opened. Check your connection and retry.");
    }
  }, [router]);

  useEffect(() => {
    void openAuthorizedWorkspace();
  }, [openAuthorizedWorkspace]);

  return (
    <main className="mx-auto flex min-h-[40vh] max-w-xl flex-col items-start justify-center gap-4 px-4 py-10">
      <p role="status" aria-live="polite" className="text-sm font-medium text-[var(--acadlyx-muted)]">
        {error || "Opening your authorized payments workspace…"}
      </p>
      {error ? (
        <button
          type="button"
          onClick={() => void openAuthorizedWorkspace()}
          className="acadlyx-button acadlyx-button-primary"
        >
          Retry
        </button>
      ) : null}
    </main>
  );
}
