import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const frontendRoot = path.resolve(process.cwd());
const appRoot = path.join(frontendRoot, "src/app");
const shell = fs.readFileSync(path.join(frontendRoot, "src/components/dashboard/DashboardShell.tsx"), "utf8");
const navigation = fs.readFileSync(path.join(frontendRoot, "src/lib/navigation.ts"), "utf8");
const overrideBlock = navigation.match(/export const ROLE_ROUTE_OVERRIDES:[\s\S]*?=\s*\{([\s\S]*?)\n\};/)?.[1];

assert.ok(overrideBlock, "ROLE_ROUTE_OVERRIDES must remain a declared policy table");

function pageForRoute(route) {
  const segments = route.split("/").filter(Boolean);
  return path.join(appRoot, ...segments, "page.tsx");
}

const overrides = [];
for (const roleEntry of overrideBlock.matchAll(/([A-Z_]+):\s*\{([^}]*)\}/g)) {
  const [, role, body] = roleEntry;
  for (const pair of body.matchAll(/"([^"]+)"\s*:\s*"([^"]+)"/g)) {
    const [, source, destination] = pair;
    overrides.push({ role, source, destination });
  }
}

test("every role-specific route override resolves to an existing app page", () => {
  assert.ok(overrides.length > 0, "Expected role-specific route overrides to be covered");
  const missing = overrides.filter(({ destination }) => !fs.existsSync(pageForRoute(destination)));
  assert.deepEqual(
    missing.map(({ role, source, destination }) => ({ role, source, destination })),
    [],
    "Role-owned redirects must not point to missing routes",
  );
});


function roleNavigationEntries() {
  const declaration = navigation.indexOf("export const ROLE_NAVIGATION");
  const arrayStart = navigation.indexOf("= [", declaration) + 2;
  const objects = [];
  let depth = 0;
  let quote = null;
  let escaped = false;
  let current = "";

  for (let index = arrayStart; index < navigation.length; index += 1) {
    const character = navigation[index];
    if (quote) {
      if (depth > 0) current += character;
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === quote) quote = null;
      continue;
    }
    if (character === '"' || character === "'" || character === "`") {
      quote = character;
      if (depth > 0) current += character;
      continue;
    }
    if (character === "{") {
      if (depth === 0) current = "";
      depth += 1;
      current += character;
      continue;
    }
    if (character === "}" && depth > 0) {
      depth -= 1;
      current += character;
      if (depth === 0) objects.push(current);
      continue;
    }
    if (depth > 0) current += character;
    if (depth === 0 && character === "]" && index > arrayStart) break;
  }

  return objects.map((source) => ({
    href: source.match(/href:\s*"([^"]+)"/)?.[1],
    roles: (source.match(/roles:\s*\[([^\]]*)\]/)?.[1] || "")
      .match(/"([^"]+)"/g)?.map((role) => role.slice(1, -1)) || [],
  })).filter((entry) => Boolean(entry.href));
}

test("every role override source is an owned navigation entry", () => {
  const entries = roleNavigationEntries();
  const stale = overrides.filter(({ role, source }) =>
    !entries.some((entry) =>
      entry.href === source &&
      (!entry.roles.length || entry.roles.includes(role)),
    ),
  );
  assert.deepEqual(
    stale.map(({ role, source, destination }) => ({ role, source, destination })),
    [],
    "A role must not rewrite a source link it does not own in ROLE_NAVIGATION",
  );
});

test("role-owned overrides do not rewrite destinations to unscoped generic workspace routes", () => {
  const unscoped = new Set([
    "/students", "/faculty", "/admissions", "/notices", "/notifications",
    "/reports", "/examinations", "/fees", "/operations", "/intelligence",
    "/placements", "/obe", "/attendance", "/timetable", "/calendar",
  ]);
  const unsafe = overrides.filter(({ role, destination }) =>
    ["CHAIRMAN", "DIRECTOR", "DEAN", "REGISTRAR", "HOD", "MANAGEMENT"].includes(role) &&
    unscoped.has(destination),
  );
  assert.deepEqual(
    unsafe.map(({ role, source, destination }) => ({ role, source, destination })),
    [],
    "Leadership and academic overrides must use role-owned destinations",
  );
});

test("Dean and Club President dashboard actions stay inside declared scopes", () => {
  const dean = fs.readFileSync(path.join(frontendRoot, "src/components/dashboard/DeanDashboard.tsx"), "utf8");
  const club = fs.readFileSync(path.join(appRoot, "club-president/page.tsx"), "utf8");
  assert.ok(dean.includes('["Student records","/dean/students"]'));
  assert.ok(!dean.includes('["Faculty","/students"]'));
  assert.ok(club.includes('href="/events-gallery"'));
  assert.ok(!club.includes('href="/calendar"'));
});

test("every final role-owned navigation destination resolves to an app page", () => {
  const entries = roleNavigationEntries();
  const declaredRoles = [...new Set(entries.flatMap((entry) => entry.roles))];
  const missing = [];

  for (const entry of entries) {
    const roles = entry.roles.length ? entry.roles : declaredRoles;
    for (const role of roles) {
      const destination = overrides.find((override) =>
        override.role === role && override.source === entry.href,
      )?.destination ?? entry.href;
      const pathname = destination.split("?")[0].split("#")[0] || "/";
      if (pathname.startsWith("http://") || pathname.startsWith("https://")) continue;
      if (!fs.existsSync(pageForRoute(pathname))) {
        missing.push({ role, source: entry.href, destination: pathname });
      }
    }
  }

  assert.deepEqual(missing, [], "Every visible final navigation destination must resolve to a real app page");
});

function routeNamespaceEntries() {
  const declaration = navigation.indexOf("const NAMESPACE_OWNERS");
  const equals = navigation.indexOf("=", declaration);
  const arrayStart = navigation.indexOf("[", equals);
  const entries = [];
  let depth = 0;
  let quote = null;
  let escaped = false;
  let pairStart = -1;

  for (let index = arrayStart; index < navigation.length; index += 1) {
    const character = navigation[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (character === String.fromCharCode(92)) escaped = true;
      else if (character === quote) quote = null;
      continue;
    }
    if (character === '"' || character === "'" || character === "`") {
      quote = character;
      continue;
    }
    if (character === "[") {
      if (depth === 1) pairStart = index;
      depth += 1;
      continue;
    }
    if (character === "]") {
      depth -= 1;
      if (depth === 1 && pairStart >= 0) {
        const source = navigation.slice(pairStart, index + 1);
        const firstQuote = source.indexOf('"');
        const prefixEnd = source.indexOf('"', firstQuote + 1);
        const prefix = firstQuote >= 0 && prefixEnd > firstQuote ? source.slice(firstQuote + 1, prefixEnd) : "";
        const secondArrayStart = source.indexOf("[", source.indexOf(","));
        const rolesEnd = source.lastIndexOf("]");
        const roles = secondArrayStart >= 0 && rolesEnd > secondArrayStart
          ? [...source.slice(secondArrayStart + 1, rolesEnd).matchAll(/"([^"]+)"/g)].map((match) => match[1])
          : [];
        if (prefix && roles.length) entries.push({ prefix, roles });
        pairStart = -1;
      }
      if (depth === 0) break;
    }
  }

  return entries;
}

function routeMatches(pathname, prefix) {
  const pathSegments = pathname.split("/").filter(Boolean);
  const prefixSegments = prefix.split("/").filter(Boolean);
  const dynamic = prefixSegments.some((segment) => segment.startsWith("[") && segment.endsWith("]"));
  if (dynamic) {
    return pathSegments.length === prefixSegments.length && prefixSegments.every((segment, index) =>
      segment.startsWith("[") && segment.endsWith("]")
        ? Boolean(pathSegments[index])
        : segment === pathSegments[index],
    );
  }
  return pathname === prefix || pathname.startsWith(prefix + "/");
}

test("every role-owned navigation destination matches its route-guard owner", () => {
  const entries = roleNavigationEntries();
  const namespaces = routeNamespaceEntries();
  assert.ok(entries.length > 100, "Expected the real navigation registry to be inspected");
  assert.ok(namespaces.length > 50, "Expected the declared route-owner table to be inspected");

  const declaredRoles = [...new Set(entries.flatMap((entry) => entry.roles))];
  const violations = [];

  for (const entry of entries) {
    const roles = entry.roles.length ? entry.roles : declaredRoles;
    for (const role of roles) {
      const destination = overrides.find((override) => override.role === role && override.source === entry.href)?.destination ?? entry.href;
      let pathname = destination.split("?")[0].split("#")[0] || "/";
      while (pathname.length > 1 && pathname.endsWith("/")) pathname = pathname.slice(0, -1);
      const namespace = namespaces
        .filter((candidate) => routeMatches(pathname, candidate.prefix))
        .sort((left, right) => right.prefix.length - left.prefix.length)[0];

      if (!namespace || !namespace.roles.includes(role)) {
        violations.push({ role, source: entry.href, destination, matchedNamespace: namespace?.prefix, allowedRoles: namespace?.roles ?? [] });
      }
    }
  }

  assert.deepEqual(violations, [], "Sidebar destinations must be owned by the same canonical role as the direct-route guard");
});
