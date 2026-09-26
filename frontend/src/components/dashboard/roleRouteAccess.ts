import type { AuthUser } from "@/lib/auth";
import {
  normalizeRole,
  type CanonicalRole,
} from "@/lib/authorization";
import {
  canAccessRoute,
  navigationForRole,
  workspaceHome,
} from "@/lib/navigation";

function matchesRoute(
  pathname: string,
  route: string,
): boolean {
  return (
    pathname === route ||
    pathname.startsWith(
      `${route}/`,
    )
  );
}

export function getAllowedRoutes(
  role: string,
): readonly string[] {
  const canonical =
    normalizeRole(role);

  return navigationForRole(
    canonical,
  ).map(
    (item) => item.href,
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
      matchesRoute(
        pathname,
        route,
      ),
  );
}

export function getWorkspaceHome(
  role: string,
): string {
  return workspaceHome([
    normalizeRole(role),
  ]);
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

export function canRoleAccessRoute(
  user: AuthUser,
  role: string,
  pathname: string,
): boolean {
  const canonical =
    normalizeRole(
      role,
    ) as CanonicalRole;

  return (
    user.roles.some(
      (userRole) =>
        normalizeRole(
          userRole,
        ) === canonical,
    ) &&
    canAccessRoute(
      user,
      pathname,
      [canonical],
    )
  );
}
