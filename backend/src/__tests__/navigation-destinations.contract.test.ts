import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const frontend = join(process.cwd(), "../frontend/src");
const appRoot = join(frontend, "app");
const navigationSource = readFileSync(join(frontend, "lib/navigation.ts"), "utf8");
const adminNavigationSource = readFileSync(join(frontend, "lib/adminNavigation.ts"), "utf8");
const dashboardShellSource = readFileSync(join(frontend, "components/dashboard/DashboardShell.tsx"), "utf8");

function navigationObjects() {
  const declaration = navigationSource.indexOf("export const ROLE_NAVIGATION");
  const arrayStart = navigationSource.indexOf("= [", declaration) + 2;
  const objects = [];
  let braceDepth = 0;
  let quote = null;
  let escaped = false;
  let current = "";

  for (let index = arrayStart; index < navigationSource.length; index += 1) {
    const character = navigationSource[index];
    if (quote) {
      if (braceDepth > 0) current += character;
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === quote) quote = null;
      continue;
    }
    if (character === '"' || character === "'" || character === String.fromCharCode(96)) {
      quote = character;
      if (braceDepth > 0) current += character;
      continue;
    }
    if (character === "{") {
      if (braceDepth === 0) current = "";
      braceDepth += 1;
      current += character;
      continue;
    }
    if (character === "}" && braceDepth > 0) {
      braceDepth -= 1;
      current += character;
      if (braceDepth === 0) objects.push(current);
      continue;
    }
    if (braceDepth > 0) current += character;
    if (braceDepth === 0 && character === "]" && index > arrayStart) break;
  }

  return objects.map((source) => ({
    label: source.match(/label:\s*"([^"]+)"/)?.[1],
    href: source.match(/href:\s*"([^"]+)"/)?.[1],
    roles: (source.match(/roles:\s*\[([^\]]*)\]/)?.[1] || "")
      .match(/"([^"]+)"/g)?.map((role) => role.slice(1, -1)) || [],
  })).filter((item): item is { label: string; href: string; roles: string[] } => Boolean(item.href && item.label));
}

function routeExists(href: string) {
  const route = href.split(/[?#]/)[0].replace(/\/$/, "");
  if (!route.startsWith("/")) return true;
  const parts = route.split("/").filter(Boolean);
  const direct = join(appRoot, ...parts, "page.tsx");
  if (existsSync(direct)) return true;
  for (let index = 0; index < parts.length; index += 1) {
    const dynamicParts = [...parts];
    dynamicParts[index] = "[id]";
    if (existsSync(join(appRoot, ...dynamicParts, "page.tsx"))) return true;
  }
  return false;
}

test("every literal ROLE_NAVIGATION destination resolves to an App Router page", () => {
  const items = navigationObjects();
  assert.ok(items.length > 100, "navigation parser should inspect the real role navigation inventory");
  const adminHrefs = [...adminNavigationSource.matchAll(/href:\s*"([^"]+)"/g)].map((match) => match[1]);
  const overridesStart = navigationSource.indexOf("const ROLE_ROUTE_OVERRIDES");
  const overridesEnd = navigationSource.indexOf("\n};", overridesStart);
  const overridesSource = navigationSource.slice(overridesStart, overridesEnd);
  const roleOwnedHrefs = [...overridesSource.matchAll(/:\s*"([^"]+)"/g)].map((match) => match[1]);
  const allDestinations = [...new Set([
    ...items.map((item) => item.href),
    ...adminHrefs,
    ...roleOwnedHrefs,
    "/account-security",
  ])];
  const missing = allDestinations.filter((href) => !routeExists(href));
  assert.deepEqual(missing, [], "sidebar and role-owned hrefs must not point to missing pages");
});

test("a role never receives two sidebar entries for the same destination", () => {
  const items = navigationObjects();
  const roles = [...new Set(items.flatMap((item) => item.roles))];
  const duplicates = [];
  for (const role of roles) {
    const seen = new Map();
    for (const item of items.filter((candidate) => !candidate.roles.length || candidate.roles.includes(role))) {
      if (seen.has(item.href)) {
        duplicates.push({ role, href: item.href, labels: [seen.get(item.href), item.label] });
      } else {
        seen.set(item.href, item.label);
      }
    }
  }
  assert.deepEqual(duplicates, [], "duplicate destinations create confusing or incorrect sidebar navigation");
});
