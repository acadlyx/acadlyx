import type { CanonicalRole } from "@/lib/authorization";
import { normalizeRole } from "@/lib/authorization";
import {
  navigationForRole,
  workspaceHome,
} from "@/lib/navigation";

/**
 * Compatibility adapter.
 *
 * There is intentionally no independent route table here anymore.
 * All route ownership comes from lib/navigation.ts.
 */

export function getAllowedRoutes(
  role: string,
): readonly string[] {
  const canonical =
    normalizeRole(
      role,
    ) as CanonicalRole;

  return navigationForRole(
    canonical,
  ).map(
    (item) =>
      item.href,
  );
}

export function isRouteInWorkspace(
  role: string,
  pathname: string,
): boolean {
  return getAllowedRoutes(
    role,
  ).some(
    (route) =>
      pathname === route ||
      pathname.startsWith(
        `${route}/`,
      ),
  );
}

export function getWorkspaceHome(
  role: string,
): string {
  const canonical =
    normalizeRole(
      role,
    ) as CanonicalRole;

  return (
    workspaceHome([
      canonical,
    ]) || "/login"
  );
}

export function roleOwnsRoute(
  role: string,
  pathname: string,
): boolean {
  return isRouteInWorkspace(
    role,
    pathname,
  );
}
