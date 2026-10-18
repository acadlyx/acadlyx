import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(process.cwd(), "src");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const navigation = read("lib/navigation.ts");
const shell = read("components/dashboard/DashboardShell.tsx");
const authority = read("lib/authority.ts");
const websiteCms = read("app/site-content/page.tsx");
const institutionalCms = read("app/institutionalcms/page.tsx");
const notices = read("app/notices/page.tsx");

const CANONICAL_ROLES = [
  "SUPER_ADMIN", "INSTITUTION_ADMIN", "CHAIRMAN", "MANAGEMENT", "DIRECTOR",
  "DEAN", "REGISTRAR", "HOD", "FACULTY", "ACCOUNTS", "HR", "ADMISSIONS",
  "EXAMINATION", "LIBRARIAN", "PLACEMENT", "IT", "CMS", "STUDENT", "PARENT",
  "CLUB_PRESIDENT",
];

test("all 20 canonical roles have a dashboard identity and role label", () => {
  const dashboardIds = authority.match(/export const DASHBOARD_IDS = \[([\s\S]*?)\] as const/)?.[1] ?? "";
  for (const role of CANONICAL_ROLES) {
    assert.match(dashboardIds, new RegExp('"'+role+'"'), role + " missing from DASHBOARD_IDS");
    assert.match(navigation, new RegExp("\\b"+role+":\\s*"), role + " missing from ROLE_LABELS");
  }
  assert.match(navigation, /export function workspaceHome\(roles: string\[\]\): string/);
  for (const role of CANONICAL_ROLES) assert.match(navigation, new RegExp(role + ': "\\/'), role + " missing workspace home");
});

test("platform Website CMS and institution-scoped Institutional CMS have separate owners", () => {
  assert.match(navigation, /label: "Website CMS",[\s\S]*?href: "\/site-content",[\s\S]*?roles: \["SUPER_ADMIN", "CMS"\]/);
  assert.match(navigation, /label: "Institutional CMS",[\s\S]*?href: "\/institutionalcms",[\s\S]*?roles: \["INSTITUTION_ADMIN", "MANAGEMENT", "DIRECTOR", "CMS"\]/);
  assert.match(websiteCms, /allowedRoles=\{\["SUPER_ADMIN", "CMS"\]\}/);
  assert.match(institutionalCms, /allowedRoles=\{\["INSTITUTION_ADMIN", "MANAGEMENT", "DIRECTOR", "CMS"\]\}/);
});

test("tenant CMS routes require the cms entitlement while platform Website CMS remains available to Super Admin", () => {
  assert.match(navigation, /\^\\\/(site-content\|institutionalcms)\(\\\/\|\$\)\//);
  assert.match(navigation, /platformManagedCms = activeRole === "SUPER_ADMIN" && itemPath === "\/site-content"/);
  assert.match(navigation, /platformManagedCms = activeRole === "SUPER_ADMIN" && normalizedPath === "\/site-content"/);
  assert.match(navigation, /if \(!platformManagedCms && requiredTenantFeatures\.some\(\(feature\) => !tenantFeatures\.includes\(feature\)\)\) return false;/);
  assert.match(navigation, /const featureAllowed = platformManagedCms \|\| requiredFeatures\.every/);
});

test("notices remain readable across roles but publishing is permission-gated and never granted to Student", () => {
  const readRoles = notices.match(/const READ_ROLES = \[([\s\S]*?)\];/)?.[1] ?? "";
  for (const role of CANONICAL_ROLES) assert.match(readRoles, new RegExp('"'+role+'"'), role + " missing from notice read audience");
  assert.match(notices, /const manage = !user\.roles\.includes\("STUDENT"\) && user\.permissions\.includes\("notices\.manage"\)/);
  assert.match(notices, /listNotices\(false\)/);
  assert.match(notices, /manage \? listDepartments\(\) : Promise\.resolve\(\[\]\)/);
});

test("route and final navigation ownership fail closed and do not render duplicate destinations", () => {
  assert.match(navigation, /if \(!matchingNamespace\) \{[\s\S]*?return false;/);
  assert.match(navigation, /const merged = new Map<string, NavigationItem>\(\)/);
  assert.match(navigation, /if \(!existing\) \{/);
  assert.match(shell, /const uniqueDestinations = new Map<string, typeof roleItems\[number\]>\(\)/);
  assert.match(shell, /if \(!uniqueDestinations\.has\(destination\)\) uniqueDestinations\.set\(destination, item\)/);
});
