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
