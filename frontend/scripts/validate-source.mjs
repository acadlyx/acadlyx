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
const shellSource = fs.readFileSync(shellFile, "utf8");
const adminNavigationFile = path.join(root, "lib", "adminNavigation.ts");
const adminNavigationSource = fs.readFileSync(adminNavigationFile, "utf8");
const dashboardTokensFile = path.join(root, "app", "acadlyx-dashboard-tokens.css");
const dashboardTokensSource = fs.readFileSync(dashboardTokensFile, "utf8");
const dashboardFrameFile = path.join(root, "components", "dashboard", "UnifiedDashboardFrame.tsx");
const dashboardFrameSource = fs.readFileSync(dashboardFrameFile, "utf8");
const managementFeeApprovalsFile = path.join(root, "app", "management", "fee-approvals", "page.tsx");
const managementFeeApprovalsSource = fs.readFileSync(managementFeeApprovalsFile, "utf8");
if (navigationSource.includes("tenantFeatures.length === 0") && navigationSource.includes("featureAllowed")) {
  failures.push("src/lib/navigation.ts: empty tenant feature list must not imply every module is enabled");
}
if (!navigationSource.includes("!feature || tenantFeatures.includes(feature)") || !navigationSource.includes("if (tenantFeature && !tenantFeatures.includes(tenantFeature)) return false;")) {
  failures.push("src/lib/navigation.ts: navigation and direct-route guards must fail closed for disabled tenant features");
}
if (!adminNavigationSource.includes("isTenantFeatureEnabled") || !adminNavigationSource.includes("unique.has(destination)")) {
  failures.push("src/lib/adminNavigation.ts: institution-admin navigation must enforce tenant features and deduplicate destinations");
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
if (
  !feeStructureNavigation ||
  !/roles:\s*\["ACCOUNTS"\]/.test(feeStructureNavigation[0]) ||
  !feeHeadsNavigation ||
  !/roles:\s*\["ACCOUNTS"\]/.test(feeHeadsNavigation[0]) ||
  !navigationSource.includes('label: "Fee structure approvals"') ||
  !navigationSource.includes('href: "/management/fee-approvals"') ||
  !managementFeeApprovalsSource.includes('allowedRoles={["MANAGEMENT"]}') ||
  !managementFeeApprovalsSource.includes('view="fee-structures"')
) {
  failures.push("src/lib/navigation.ts: Accounts fee tools must remain Accounts-owned and Management approvals must use a Management-owned route");
}
if (
  !/DEAN:\s*\{[^}]*"\/notices": "\/dean\/notices"/.test(shellSource) ||
  !/HOD:\s*\{[^}]*"\/notices": "\/hod\/notices"/.test(shellSource) ||
  !shellSource.includes("uniqueDestinations.has(destination)")
) {
  failures.push("src/components/dashboard/DashboardShell.tsx: Dean/HOD shared-notice links must resolve to one workspace-owned destination");
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

if (failures.length) {
  console.error("Source validation failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(`Source validation passed: scanned ${walk(root).length} frontend source files.`);
