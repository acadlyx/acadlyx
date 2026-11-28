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

type AuthState = "checking" | "authenticated" | "unauthenticated" | "unauthorized";

const PUBLIC_EXACT_ROUTES = new Set([
  "/",
  "/login",
  "/forgot-password",
  "/reset-password",
  "/about",
  "/about-acadlyx",
  "/partners",
  "/contact",
  "/team",
  "/updates",
  "/platform",
  "/solutions",
  "/modules",
  "/resources",
  "/request-demo",
  "/features",
  "/education-erp",
  "/college-management-system",
  "/student-management",
  "/admission-management",
  "/attendance-management",
  "/examination-management",
  "/fee-management",
  "/obe-management",
  "/institutional-intelligence",
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

  useEffect(() => {
    let alive = true;

    if (isPublicRoute(pathname)) {
      setState("authenticated");
      setUser(null);
      setValidatedPath(route);
      return () => {
        alive = false;
      };
    }

    // Never carry a previously authorized route decision into a new path.
    setState("checking");
    setValidatedPath(null);

    getCurrentUser()
      .then((currentUser) => {
        if (!alive) return;

        // This legacy URL is redirect-only. Resolve it in the auth boundary,
        // before mounting the nested dashboard shell and its legacy client
        // redirect component. Only the Director workspace may follow it.
        if (pathname === "/director/operations" && workspaceHome(currentUser.roles) === "/director") {
          setUser(currentUser);
          setState("checking");
          setValidatedPath(null);
          router.replace("/director");
          return;
        }

        if (!canAccessRoute(route, currentUser.roles, currentUser.permissions, currentUser.tenantFeatures || [])) {
          setState("unauthorized");
          setUser(currentUser);
          setValidatedPath(pathname);
          return;
        }

        setUser(currentUser);
        setState("authenticated");
        setValidatedPath(pathname);
      })
      .catch((error) => {
        if (!alive) return;

        if (error instanceof AuthRequiredError) {
          setState("unauthenticated");
          setUser(null);
          setValidatedPath(pathname);
          router.replace("/login");
          return;
        }

        // Authentication could not be established. Fail closed rather than
        // rendering a protected route while session state is uncertain.
        setState("unauthenticated");
        setUser(null);
        setValidatedPath(pathname);
        router.replace("/login");
      });

    return () => {
      alive = false;
    };
  }, [pathname, route, router]);

  useEffect(() => {
    if (state !== "unauthorized") {
      return;
    }

    const destination = user
      ? workspaceHome(user.roles)
      : "/login";

    router.replace(
      destination === pathname
        ? "/login"
        : destination,
    );
  }, [pathname, route, router, state, user]);

  if (isPublicRoute(pathname)) {
    return <>{children}</>;
  }

  /*
   * The key security invariant:
   * no protected child component is mounted while authentication or
   * authorization is unresolved. Therefore its useEffect hooks cannot
   * start dashboard/API work during the auth decision.
   */
  if (
    state === "checking" ||
    validatedPath !== pathname ||
    state === "unauthenticated" ||
    state === "unauthorized"
  ) {
    // Keep protected content unmounted until authorization completes, but do
    // not flash a dashboard-shaped placeholder during ordinary navigation.
    return (
      <div role="status" aria-live="polite" className="sr-only">
        Checking your secure workspace…
      </div>
    );
  }

  return <>{children}</>;
}
