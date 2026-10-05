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
  "/contact",
  "/team",
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
  const route = searchParams.toString() ? pathname + "?" + searchParams.toString() : pathname;
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

        if (!canAccessRoute(route, currentUser.roles, currentUser.permissions)) {
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
    validatedPath !== pathname
  ) {
    return null;
  }

  if (state === "unauthenticated") {
    return null;
  }

  if (state === "unauthorized") {
    return null;
  }

  return <>{children}</>;
}
