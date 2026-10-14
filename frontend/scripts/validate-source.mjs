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
if (navigationSource.includes("tenantFeatures.length === 0") && navigationSource.includes("featureAllowed")) {
  failures.push("src/lib/navigation.ts: empty tenant feature list must not imply every module is enabled");
}
if (!navigationSource.includes("!feature || tenantFeatures.includes(feature)") || !navigationSource.includes("if (tenantFeature && !tenantFeatures.includes(tenantFeature)) return false;")) {
  failures.push("src/lib/navigation.ts: navigation and direct-route guards must fail closed for disabled tenant features");
}
if (!adminNavigationSource.includes("isTenantFeatureEnabled") || !adminNavigationSource.includes("unique.has(destination)")) {
  failures.push("src/lib/adminNavigation.ts: institution-admin navigation must enforce tenant features and deduplicate destinations");
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
