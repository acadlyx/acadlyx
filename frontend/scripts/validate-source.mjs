import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.cwd(), "src");
const extensions = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);
const suspicious = /\\n(?=\s*(?:import\b|export\b|const\b|let\b|var\b|return\b|if\b|for\b|while\b|\}|\)|<))/;

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name === ".next") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(full));
    else if (extensions.has(path.extname(entry.name))) files.push(full);
  }
  return files;
}

const failures = [];

// Entitlement/navigation invariants: these are source-contract checks, not a substitute
// for authenticated browser and backend authorization tests.
const navigationFile = path.join(root, "lib", "navigation.ts");
const shellFile = path.join(root, "components", "dashboard", "DashboardShell.tsx");
const navigationSource = fs.readFileSync(navigationFile, "utf8");
const authorityFile = path.join(root, "lib", "authority.ts");
const authoritySource = fs.readFileSync(authorityFile, "utf8");
const parentChildrenFile = path.join(root, "app", "parent", "children", "page.tsx");
const parentChildrenSource = fs.readFileSync(parentChildrenFile, "utf8");
const dashboardIdsMatch = authoritySource.match(/export const DASHBOARD_IDS = \[([\s\S]*?)\] as const/);
const shellSource = fs.readFileSync(shellFile, "utf8");
const protectedBoundaryFile = path.join(root, "components", "auth", "ProtectedRouteBoundary.tsx");
const protectedBoundarySource = fs.readFileSync(protectedBoundaryFile, "utf8");
const adminNavigationFile = path.join(root, "lib", "adminNavigation.ts");
const adminNavigationSource = fs.readFileSync(adminNavigationFile, "utf8");
const dashboardTokensFile = path.join(root, "app", "acadlyx-dashboard-tokens.css");
const dashboardTokensSource = fs.readFileSync(dashboardTokensFile, "utf8");
const dashboardFrameFile = path.join(root, "components", "dashboard", "UnifiedDashboardFrame.tsx");
const dashboardFrameSource = fs.readFileSync(dashboardFrameFile, "utf8");
const managementFeeApprovalsFile = path.join(root, "app", "management", "fee-approvals", "page.tsx");
const managementFeeApprovalsSource = fs.readFileSync(managementFeeApprovalsFile, "utf8");
const roleScopedStudentsFile = path.join(root, "components", "dashboard", "RoleScopedStudents.tsx");
const roleScopedStudentsSource = fs.readFileSync(roleScopedStudentsFile, "utf8");
const libraryStudentsPageFile = path.join(root, "app", "library", "students", "page.tsx");
const libraryStudentsPageSource = fs.readFileSync(libraryStudentsPageFile, "utf8");
const legacyPaymentsFile = path.join(root, "app", "payments", "page.tsx");
const legacyPaymentsSource = fs.readFileSync(legacyPaymentsFile, "utf8");
const legacyFeeReceiptsFile = path.join(root, "app", "fees", "receipts", "page.tsx");
const legacyFeeReceiptsSource = fs.readFileSync(legacyFeeReceiptsFile, "utf8");
const legacyClubSource = fs.readFileSync(path.join(root, "app", "club", "page.tsx"), "utf8");
const legacyCmsSource = fs.readFileSync(path.join(root, "app", "cms", "page.tsx"), "utf8");
const legacyEnrollmentSource = fs.readFileSync(path.join(root, "app", "enrollment", "page.tsx"), "utf8");
const legacyFormsSource = fs.readFileSync(path.join(root, "app", "forms", "page.tsx"), "utf8");
const legacyInstitutionSettingsSource = fs.readFileSync(path.join(root, "app", "institution-settings", "page.tsx"), "utf8");
const feeApprovalQueueFile = path.join(root, "components", "accounts", "FeeStructureApprovalQueue.tsx");
const feeApprovalQueueSource = fs.readFileSync(feeApprovalQueueFile, "utf8");
if (navigationSource.includes("tenantFeatures.length === 0") && navigationSource.includes("featureAllowed")) {
  failures.push("src/lib/navigation.ts: empty tenant feature list must not imply every module is enabled");
}
if (
  !navigationSource.includes("requiredFeatures.every((feature) =>") ||
  !navigationSource.includes("requiredTenantFeatures.some((feature) => !tenantFeatures.includes(feature))") ||
  !navigationSource.includes("export function tenantFeaturesForPath(pathname: string): string[]") ||
  !navigationSource.includes('[/^\\/documents(\\/|$)/, "documents"]') ||
  !navigationSource.includes('[/^\\/forms(\\/|$)/, "certificates"]') ||
  !navigationSource.includes("admissions|library|placements)\\/students")
) {
  failures.push("src/lib/navigation.ts: navigation and direct-route guards must enforce every matching module and student-workflow tenant feature");
}
if (
  !adminNavigationSource.includes('import { tenantFeaturesForPath } from "@/lib/navigation"') ||
  adminNavigationSource.includes("tenantFeatureForPath") ||
  !adminNavigationSource.includes("requiredFeatures.every((feature) => user.tenantFeatures!.includes(feature))") ||
  !adminNavigationSource.includes("isTenantFeatureEnabled") ||
  !adminNavigationSource.includes("unique.has(destination)")
) {
  failures.push("src/lib/adminNavigation.ts: use the current multi-feature route entitlement contract, fail closed when entitlements are absent, and deduplicate destinations");
}
if (
  /label: "Fee Structures",\s*href: "\/accounts\/fee-structures"/.test(adminNavigationSource) ||
  !navigationSource.includes('label: "Fee Structures"') ||
  !navigationSource.includes('href: "/accounts/fee-structures"') ||
  !navigationSource.includes('roles: ["ACCOUNTS"]')
) {
  failures.push("src/lib/adminNavigation.ts: the Accounts-owned fee-structure route must not be exposed in the Institution Admin menu; retain it in Accounts navigation");
}
const feeStructureNavigation = navigationSource.match(/\{\s*label: "Fee Structures",\s*href: "\/accounts\/fee-structures",[\s\S]*?\n\s*\},/);
const feeHeadsNavigation = navigationSource.match(/\{\s*label: "Fee Heads",\s*href: "\/accounts\/fee-heads",[\s\S]*?\n\s*\},/);
const directorFeeApprovalNavigation = navigationSource.match(/\{\s*label: "Fee approvals",\s*href: "\/director\/fee-approvals",[\s\S]*?\n\s*\},/);
if (
  !feeStructureNavigation ||
  !/roles:\s*\["ACCOUNTS"\]/.test(feeStructureNavigation[0]) ||
  !feeHeadsNavigation ||
  !/roles:\s*\["ACCOUNTS"\]/.test(feeHeadsNavigation[0]) ||
  !directorFeeApprovalNavigation ||
  !/permissions:\s*\["fees.structure.read",\s*"fees.structure.approve"\]/.test(directorFeeApprovalNavigation[0]) ||
  !navigationSource.includes('label: "Fee structure approvals"') ||
  !navigationSource.includes('href: "/management/fee-approvals"') ||
  !managementFeeApprovalsSource.includes('FeeStructureApprovalQueue') ||
  !managementFeeApprovalsSource.includes('role="MANAGEMENT"') ||
  !managementFeeApprovalsSource.includes('scope="institution"') ||
  !feeApprovalQueueSource.includes('"fees.structure.approve"') ||
  !feeApprovalQueueSource.includes('"fees.structure.read"') ||
  !feeApprovalQueueSource.includes("getPrimaryRole(user.roles) !== role")
) {
  failures.push("src/lib/navigation.ts: Accounts fee tools must remain Accounts-owned and Management approvals must use a permission-scoped Management queue");
}
if (
  !/DEAN:\s*\{[^}]*"\/notices": "\/dean\/notices"/.test(navigationSource) ||
  !/HOD:\s*\{[^}]*"\/notices": "\/hod\/notices"/.test(navigationSource) ||
  !/STUDENT:\s*\{[^}]*"\/notices": "\/student\/notices"/.test(navigationSource) ||
  !navigationSource.includes("ROLE_ROUTE_OVERRIDES") ||
  !shellSource.includes("uniqueDestinations.has(destination)")
) {
  failures.push("src/lib/navigation.ts and DashboardShell.tsx: Dean, HOD and Student notice links must use the canonical role-owned override table and unique destinations");
}
if (
  !dashboardTokensSource.includes("--acadlyx-sidebar-bg: #18392d;") ||
  !dashboardTokensSource.includes("--acadlyx-sidebar-active-bg: #315c4a;") ||
  dashboardTokensSource.includes("#2563eb") ||
  dashboardTokensSource.includes("rgba(37, 99, 235")
) {
  failures.push("src/app/acadlyx-dashboard-tokens.css: dashboard navigation must use the semantic green brand palette, not blue active-state tokens");
}
if (
  /(?:text|bg|ring|outline)-blue-(?:50|100|300|600|700)\b/.test(dashboardFrameSource) ||
  !dashboardFrameSource.includes("bg-[var(--acadlyx-primary)]") ||
  !dashboardFrameSource.includes("text-[var(--acadlyx-primary)]")
) {
  failures.push("src/components/dashboard/UnifiedDashboardFrame.tsx: shared shell brand accents must use semantic design tokens");
}
if (!navigationSource.includes("Tenant entitlement checks run before namespace checks")) {
  failures.push("src/lib/navigation.ts: entitlement checks must precede namespace fallback to protect direct routes");
}
if (
  !protectedBoundarySource.includes('state !== "unauthorized" || validatedPath !== route') ||
  !protectedBoundarySource.includes("[pathname, route, router, state, user, validatedPath]")
) {
  failures.push("src/components/auth/ProtectedRouteBoundary.tsx: stale unauthorized state must not redirect a newly requested workspace before its route is verified");
}
if (
  !navigationSource.includes("export function tenantFeaturesForPath(pathname: string): string[]") ||
  !navigationSource.includes("if (requiredTenantFeatures.some((feature) => !tenantFeatures.includes(feature))) return false;")
) {
  failures.push("src/lib/navigation.ts: tenant route checks must use the exported multi-feature resolver and fail closed when a required feature is disabled");
}
if (
  !navigationSource.includes("if (!matchingNamespace) {") ||
  !navigationSource.includes("// Protected routes fail closed unless a namespace") ||
  !navigationSource.includes('["/lms", ["INSTITUTION_ADMIN", "CHAIRMAN", "MANAGEMENT"') ||
  !navigationSource.includes('["/fees/receipts", ["ACCOUNTS"]') ||
  !navigationSource.includes('["/students", ["INSTITUTION_ADMIN"]') ||
  !navigationSource.includes('["/students/[id]", ["INSTITUTION_ADMIN", "CHAIRMAN", "MANAGEMENT", "DIRECTOR", "DEAN", "REGISTRAR", "HOD", "FACULTY", "ACCOUNTS", "ADMISSIONS", "EXAMINATION", "PLACEMENT"]') ||
  !navigationSource.includes("function namespaceMatchesPath(pathname: string, prefix: string): boolean") ||
  !navigationSource.includes('["/academics", ["DEAN"]') ||
  !navigationSource.includes('["/timetable", ["CHAIRMAN", "DIRECTOR", "DEAN", "HOD", "FACULTY"]') ||
  !navigationSource.includes('["/admissions/reports", ["ADMISSIONS"]') ||
  !navigationSource.includes('["/admissions/students", ["ADMISSIONS"]') ||
  !navigationSource.includes('["/library/reports", ["LIBRARIAN"]') ||
  !navigationSource.includes('["/library/students", ["LIBRARIAN"]') ||
  !navigationSource.includes('["/placements", ["PLACEMENT"]') ||
  !navigationSource.includes('["/admissions", ["ADMISSIONS"]') ||
  !navigationSource.includes('["/forms", ["REGISTRAR"]') ||
  !navigationSource.includes('"/payments": ["ACCOUNTS", "STUDENT", "PARENT"]') ||
  !navigationSource.includes('"/fees/receipts": ["ACCOUNTS"]') ||
  !navigationSource.includes('const REDIRECT_ONLY_ROUTE_ROLES: Record<string, string[]>') ||
  !navigationSource.includes('"/club": ["CLUB_PRESIDENT"]') ||
  !navigationSource.includes('"/cms": ["SUPER_ADMIN", "CMS"]') ||
  !navigationSource.includes('"/enrollment": ["ADMISSIONS"]') ||
  !navigationSource.includes('"/forms": ["REGISTRAR"]') ||
  !navigationSource.includes('"/institution-settings": ["INSTITUTION_ADMIN"]') ||
  !legacyPaymentsSource.includes("RoleRedirect") ||
  !legacyFeeReceiptsSource.includes("RoleRedirect") ||
  !legacyPaymentsSource.includes('ACCOUNTS: "/accounts/payments"') ||
  !legacyPaymentsSource.includes('STUDENT: "/student/fees"') ||
  !legacyPaymentsSource.includes('PARENT: "/parent/children"') ||
  !legacyFeeReceiptsSource.includes('RoleRedirect') ||
  !legacyFeeReceiptsSource.includes('destinations={{ ACCOUNTS: "/accounts/receipts" }}') ||
  !legacyClubSource.includes('RoleRedirect') ||
  !legacyClubSource.includes('CLUB_PRESIDENT: "/club-president"') ||
  !legacyCmsSource.includes('RoleRedirect') ||
  !legacyCmsSource.includes('SUPER_ADMIN: "/site-content"') ||
  !legacyCmsSource.includes('CMS: "/site-content"') ||
  !legacyEnrollmentSource.includes('RoleRedirect') ||
  !legacyEnrollmentSource.includes('ADMISSIONS: "/admissions"') ||
  !legacyFormsSource.includes('RoleRedirect') ||
  !legacyFormsSource.includes('REGISTRAR: "/certificates"') ||
  !legacyInstitutionSettingsSource.includes('RoleRedirect') ||
  !legacyInstitutionSettingsSource.includes('INSTITUTION_ADMIN: "/admin"') ||
  !navigationSource.includes('href: "/admissions/students"') ||
  !navigationSource.includes('href: "/library/students"') ||
  !navigationSource.includes('roles: ["ADMISSIONS"]') ||
  !navigationSource.includes('roles: ["LIBRARIAN"]') ||
  !roleScopedStudentsSource.includes("detailBasePath?: string | null;") ||
  !roleScopedStudentsSource.includes("View student profile →") ||
  !libraryStudentsPageSource.includes("detailBasePath={null}") ||
  !navigationSource.includes('["/lms/settings"') ||
  !navigationSource.includes('["/user-deletion-approvals", ["INSTITUTION_ADMIN"]') ||
  !navigationSource.includes('["/profile"') ||
  !navigationSource.includes('["/my-work"')
) {
  failures.push("src/lib/navigation.ts: unknown protected routes must fail closed and shared/legacy route families must declare explicit workspace owners");
}
if (
  !navigationSource.includes("(fees|payments|fee-approvals|fee-structures|fee-heads)") ||
  !dashboardIdsMatch ||
  !dashboardIdsMatch[1].includes('"STAFF"') ||
  !navigationSource.includes('STAFF: "/staff"')
) {
  failures.push("src/lib/authority.ts and src/lib/navigation.ts: fee aliases must enforce tenant entitlement and every routed workspace role must have a dashboard identity");
}
const parentChildrenNavigation = navigationSource.match(/\{\s*label: "Children",\s*href: "\/parent\/children",[\s\S]*?\n\s*\},/);
if (
  !parentChildrenNavigation ||
  !/roles:\s*\["PARENT"\]/.test(parentChildrenNavigation[0]) ||
  !navigationSource.split("\n").some((line) => line.includes("parent_portal") && line.includes("children")) ||
  !parentChildrenSource.includes('allowedRoles={["PARENT"]}')
) {
  failures.push("src/lib/navigation.ts: the linked-children route must be exposed only in the parent workspace and gated by the parent-portal entitlement");
}

if (!shellSource.includes("uniqueDestinations") || !shellSource.includes("uniqueDestinations.has(destination)")) {
  failures.push("src/components/dashboard/DashboardShell.tsx: final role-overridden destinations must be deduplicated");
}
for (const file of walk(root)) {
  const text = fs.readFileSync(file, "utf8");
  const lines = text.split("\n");
  lines.forEach((line, index) => {
    if (suspicious.test(line)) failures.push(`${path.relative(process.cwd(), file)}:${index + 1}: suspicious literal \\n escape`);
  });
  if (/^<<<<<<< |^=======$|^>>>>>>> /m.test(text)) {
    failures.push(`${path.relative(process.cwd(), file)}: unresolved merge conflict marker`);
  }
}

// Every non-public App Router page must have an explicit namespace owner.
const namespaceOwnerStart = navigationSource.indexOf("const NAMESPACE_OWNERS:");
const namespaceOwnerEnd = navigationSource.indexOf("\n];", namespaceOwnerStart);
const namespaceOwnerSource = namespaceOwnerStart >= 0 && namespaceOwnerEnd > namespaceOwnerStart
  ? navigationSource.slice(namespaceOwnerStart, namespaceOwnerEnd)
  : "";
const namespaceOwnerPrefixes = [...namespaceOwnerSource.matchAll(/\[\s*"([^"]+)"\s*,\s*\[/g)].map((match) => match[1]);
const publicExactMatch = protectedBoundarySource.match(/const PUBLIC_EXACT_ROUTES = new Set\(\[([\s\S]*?)\]\);/);
const publicExactRoutes = new Set([...(publicExactMatch?.[1] || "").matchAll(/"([^"]+)"/g)].map((match) => match[1]));
const appRouteRoot = path.join(root, "app");
const routePageFiles = walk(appRouteRoot).filter((file) => /^page\.(tsx|ts|jsx|js)$/.test(path.basename(file)));
const uncoveredProtectedRoutes = routePageFiles.filter((file) => {
  const relative = path.relative(appRouteRoot, file).split(path.sep).join("/");
  const routePath = /^page\.(tsx|ts|jsx|js)$/.test(relative)
    ? "/"
    : "/" + relative.replace(/\/page\.(tsx|ts|jsx|js)$/, "");
  if (publicExactRoutes.has(routePath)) return false;
  return !namespaceOwnerPrefixes.some((prefix) => routePath === prefix || routePath.startsWith(prefix + "/"));
});
if (!publicExactMatch || uncoveredProtectedRoutes.length > 0) {
  failures.push(
    "App Router route ownership: " + uncoveredProtectedRoutes.length + " protected page(s) have no explicit namespace owner: " +
    (uncoveredProtectedRoutes.map((file) => path.relative(root, file)).join(", ") || "public-route registry could not be parsed"),
  );
}

if (failures.length) {
  console.error("Source validation failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(`Source validation passed: scanned ${walk(root).length} frontend source files.`);
