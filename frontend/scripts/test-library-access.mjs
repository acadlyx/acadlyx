import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path) => readFileSync(resolve(process.cwd(), path), "utf8");
const studentRoute = read("src/app/student/library/page.tsx");
const dashboardShell = read("src/components/dashboard/DashboardShell.tsx");
const protectedBoundary = read("src/components/auth/ProtectedRouteBoundary.tsx");
const studentModule = read("src/components/student/StudentSelfServiceModule.tsx");
const navigation = read("src/lib/navigation.ts");
const auth = read("src/lib/auth.ts");
const api = read("src/lib/libraryApi.ts");
const backendRoutes = read("../backend/src/routes/library.routes.ts");
const rbac = read("../backend/src/config/rbac.ts");
const libraryService = read("../backend/src/services/library.service.ts");
const entitlementService = read("../backend/src/services/entitlement.service.ts");

assert.match(studentRoute, /StudentSelfServiceModule module="library"/,
  "the student Library route must render the dedicated self-service module");
assert.match(navigation, /label: "Library",[\s\S]*?href: "\/student\/library",[\s\S]*?roles: \["STUDENT"\],[\s\S]*?permissions: \["library\.read"\]/,
  "student navigation must require the canonical library.read permission");
assert.match(navigation, /TENANT_FEATURE_BY_ROUTE/);
assert.ok(navigation.includes('"/student/library"') && navigation.includes('"library"'),
  "student Library routes must map to the library tenant feature");
assert.match(studentModule, /Issued \{date\(loan\.issuedAt\)\}[\s\S]*?Returned \{date\(loan\.returnedAt\)\}/,
  "students must be able to review issue and return dates");
assert.match(studentModule, /listMyLoans\(\)/,
  "students must load their own loans through the self-service endpoint");
assert.match(studentModule, /listBooks\(/,
  "students must be able to browse the catalogue");
assert.match(studentModule, /reserveBook\(id\)/,
  "students must use the personal reservation workflow");
assert.match(studentModule, /No matching available books were found\./,
  "empty catalogues/search results must show an explicit empty state");
assert.match(api, /authedFetch/,
  "Library API calls must use the authenticated API client");
assert.ok(auth.includes("tenantFeatures?: string[]") && auth.includes("export async function getCurrentUser"),
  "the current-user authentication flow must expose tenant entitlements");

assert.ok(dashboardShell.includes("const [routeAuthReady, setRouteAuthReady] = useState(false);"),
  "cached RBAC data must not mark a protected route as authorization-ready");
assert.ok(dashboardShell.includes("const reconcile = getCurrentUser({ force: true });"),
  "DashboardShell must wait for fresh /auth/me permissions instead of accepting a background cache hit");
assert.ok(dashboardShell.includes("Workspace verification unavailable") && dashboardShell.includes("Retry verification"),
  "a failed permission revalidation must fail closed with a recoverable retry state");

assert.ok(protectedBoundary.includes("getCurrentUser({ force: true })"),
  "the global protected-route boundary must revalidate /auth/me rather than authorize a new path from cached RBAC");
assert.ok(protectedBoundary.includes('type AuthState = "checking" | "authenticated" | "unauthenticated" | "unauthorized" | "unavailable";'),
  "transient identity failures must be tracked separately from confirmed unauthorized access");
assert.ok(protectedBoundary.includes("Workspace verification unavailable") && protectedBoundary.includes("Retry verification"),
  "the global auth boundary must keep protected content hidden and offer retry when /auth/me is temporarily unavailable");
assert.ok(protectedBoundary.includes("validatedPath !== route"),
  "the global auth boundary must bind its authorization result to the complete route contract");

assert.match(backendRoutes, /router\.use\(authenticate, requireFeature\("library"\)\)/,
  "all Library API routes must retain authentication and tenant entitlement checks");
assert.match(backendRoutes, /"\/books",[\s\S]*?authorize\("library\.read"\)/,
  "catalogue reads must require library.read");
assert.match(backendRoutes, /"\/loans\/mine",[\s\S]*?authorize\("library\.borrow"\)/,
  "student loans must require library.borrow without staff-only workflow dependencies");
assert.match(backendRoutes, /"\/books",[\s\S]*?authorizeWorkflow\("library\.manage"\)/,
  "catalogue management must remain separately permission-gated");
assert.match(rbac, /STUDENT:\s*\[[\s\S]*?"library\.read",[\s\S]*?"library\.borrow"[\s\S]*?\n\s*\],/,
  "the canonical STUDENT role must have read and personal borrowing permissions");
assert.doesNotMatch(rbac.match(/STUDENT:\s*\[([\s\S]*?)\n\s*\],/)?.[1] ?? "",
  /"library\.manage"|"library\.fines\.waive\.(?:request|approve)/,
  "students must not receive librarian management or fine-waiver authority");
assert.match(libraryService, /buildLibraryFineListWhere[\s\S]*?effectiveRole === "STUDENT"[\s\S]*?return \{ institutionId, issue: \{ borrowerId: actor\.id \} \}/,
  "student fine queries must use effective Student workspace and scope to their own borrower ID");
assert.match(libraryService, /if \(effectiveRole === "LIBRARIAN"\) return \{ institutionId \}/,
  "institution-wide fine lists must be available only in the effective Librarian workspace");
assert.match(libraryService, /Library fines are not available in the active workspace/,
  "non-student/non-librarian workspaces must fail closed for library fines");
assert.match(entitlementService, /if \(!entitlement \|\| !entitlement\.isEnabled\)/,
  "disabled or missing library entitlements must remain denied");

process.stdout.write("Student Library access source checks passed.\n");
