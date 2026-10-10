import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path) => readFileSync(resolve(process.cwd(), path), "utf8");
const studentRoute = read("src/app/student/library/page.tsx");
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

assert.match(backendRoutes, /router\.use\(authenticate, requireFeature\("library"\)\)/,
  "all Library API routes must retain authentication and tenant entitlement checks");
assert.match(backendRoutes, /"\/books",[\s\S]*?authorize\("library\.read"\)/,
  "catalogue reads must require library.read");
assert.match(backendRoutes, /"\/loans\/mine",[\s\S]*?authorizeWorkflow\("library\.borrow"\)/,
  "student loans must use the personal library.borrow workflow");
assert.match(backendRoutes, /"\/books",[\s\S]*?authorizeWorkflow\("library\.manage"\)/,
  "catalogue management must remain separately permission-gated");
assert.match(rbac, /STUDENT:\s*\[[\s\S]*?"library\.read",[\s\S]*?"library\.borrow"[\s\S]*?\n\s*\],/,
  "the canonical STUDENT role must have read and personal borrowing permissions");
assert.doesNotMatch(rbac.match(/STUDENT:\s*\[([\s\S]*?)\n\s*\],/)?.[1] ?? "",
  /"library\.manage"|"library\.fines\.waive\.(?:request|approve)/,
  "students must not receive librarian management or fine-waiver authority");
assert.match(libraryService, /buildLibraryFineListWhere[\s\S]*?issue:\s*\{\s*borrowerId:\s*actor\.id\s*\}/,
  "student fine queries must be scoped to their own borrower ID");
assert.match(libraryService, /institutionId,[\s\S]*?actor\.roles\.includes\("STUDENT"\)/,
  "student fine queries must retain institution isolation");
assert.match(entitlementService, /if \(!entitlement \|\| !entitlement\.isEnabled\)/,
  "disabled or missing library entitlements must remain denied");

process.stdout.write("Student Library access source checks passed.\\n");
