"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import {
  AuthRequiredError,
  getCurrentUser,
  type AuthUser,
} from "@/lib/auth";
import {
  canAccessRoute,
  workspaceHome,
} from "@/lib/navigation";

type AuthState = "checking" | "authenticated" | "unauthenticated" | "unauthorized" | "unavailable";

const PUBLIC_EXACT_ROUTES = new Set([
  "/",
  "/login",
  "/forgot-password",
  "/reset-password",
  "/about",
  "/partners",
  "/contact",
  "/team",
  "/updates",
]);

function isPublicRoute(pathname: string): boolean {
  if (PUBLIC_EXACT_ROUTES.has(pathname)) {
    return true;
  }

  return false;
}

/**
 * Global route boundary for ACADLYX's client-owned session architecture.
 *
 * ACADLYX deliberately keeps credentials in per-tab sessionStorage so
 * different accounts can coexist in different tabs. That means Next.js
 * middleware cannot authenticate these requests: middleware runs on the
 * server and cannot read a browser tab's sessionStorage.
 *
 * This boundary therefore becomes the first client-side rendering gate:
 * protected page elements are not mounted until /auth/me has established
 * the current tab's authenticated identity and route authorization.
 *
 * API authorization remains an independent backend security boundary.
 */
export function ProtectedRouteBoundary({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  // Only query parameters that participate in ROLE_NAVIGATION change the
  // route authorization contract. Search, pagination and filter parameters
  // must not blank the dashboard or trigger another identity check.
  const authorizationQueryKeys =
    pathname === "/superadmin" ? ["section"] :
    pathname === "/hod" || pathname === "/library" ? ["tab"] : [];
  const routeQuery = new URLSearchParams();
  for (const key of authorizationQueryKeys) {
    const value = searchParams.get(key);
    if (value) routeQuery.set(key, value);
  }
  const route = routeQuery.size ? pathname + "?" + routeQuery.toString() : pathname;
  const [state, setState] = useState<AuthState>("checking");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [validatedPath, setValidatedPath] = useState<string | null>(null);
  const [verificationError, setVerificationError] = useState("");
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let alive = true;

    if (isPublicRoute(pathname)) {
      setState("authenticated");
      setUser(null);
      setVerificationError("");
      setValidatedPath(route);
      return () => {
        alive = false;
      };
    }

    // Never carry a previously authorized route decision into a new path.
    // This boundary runs before DashboardShell and is the first protected
    // rendering gate, so it must bypass getCurrentUser's fresh-cache shortcut.
    setState("checking");
    setVerificationError("");
    setValidatedPath(null);

    getCurrentUser({ force: true })
      .then((currentUser) => {
        if (!alive) return;

        if (!canAccessRoute(route, currentUser.roles, currentUser.permissions, currentUser.tenantFeatures || [])) {
          setState("unauthorized");
          setUser(currentUser);
          setValidatedPath(route);
          return;
        }

        setUser(currentUser);
        setState("authenticated");
        setValidatedPath(route);
      })
      .catch((error) => {
        if (!alive) return;

        if (error instanceof AuthRequiredError) {
          setState("unauthenticated");
          setUser(null);
          setValidatedPath(null);
          router.replace("/login");
          return;
        }

        // A transient identity-service failure is not evidence that a cached
        // route is unauthorized. Stay fail-closed on this destination and let
        // the user retry verification instead of bouncing through workspace home.
        setUser(null);
        setValidatedPath(null);
        setVerificationError("We couldn't verify your current workspace permissions. Check your connection and retry.");
        setState("unavailable");
      });

    return () => {
      alive = false;
    };
  }, [pathname, route, router, retryCount]);

  useEffect(() => {
    // The previous route's authorization result is stale as soon as the
    // pathname changes. Do not apply that decision to the destination while
    // its own /auth/me validation is still pending; otherwise a legitimate
    // redirect to the user's home can be redirected again to /login.
    if (state !== "unauthorized" || validatedPath !== route) {
      return;
    }

    const destination = user
      ? workspaceHome(user.roles)
      : "/login";

    router.replace(
      destination === route
        ? "/login"
        : destination,
    );
  }, [pathname, route, router, state, user, validatedPath]);

  if (isPublicRoute(pathname)) {
    return <>{children}</>;
  }

  if (state === "unavailable" && validatedPath === null) {
    return (
      <main role="alert" aria-live="assertive" className="mx-auto flex min-h-[45vh] max-w-2xl flex-col items-start justify-center gap-4 p-6 sm:p-8">
        <h1 className="text-xl font-bold text-slate-900">Workspace verification unavailable</h1>
        <p className="text-sm text-slate-600">{verificationError}</p>
        <button
          type="button"
          onClick={() => setRetryCount((attempt) => attempt + 1)}
          className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700"
        >
          Retry verification
        </button>
      </main>
    );
  }

  /*
   * The key security invariant:
   * no protected child component is mounted while authentication or
   * authorization is unresolved. Therefore its useEffect hooks cannot
   * start dashboard/API work during the auth decision.
   */
  if (
    state === "checking" ||
    validatedPath !== route ||
    state === "unauthenticated" ||
    state === "unauthorized"
  ) {
    return (
      <div role="status" aria-live="polite" className="min-h-[45vh] p-6 sm:p-8">
        <div className="mx-auto max-w-7xl space-y-5">
          <div className="h-8 w-56 animate-pulse rounded-xl bg-slate-200" />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[1, 2, 3, 4].map((item) => (
              <div key={item} className="h-28 animate-pulse rounded-2xl bg-slate-100" />
            ))}
          </div>
          <div className="h-64 animate-pulse rounded-2xl bg-slate-100" />
          <p className="text-sm font-medium text-slate-500">Checking your secure workspace…</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
