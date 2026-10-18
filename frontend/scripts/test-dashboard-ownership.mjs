import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const frontendRoot = path.resolve(process.cwd(), "src");
const repoRoot = path.resolve(process.cwd(), "..");
const readFrontend = (relative) => fs.readFileSync(path.join(frontendRoot, relative), "utf8");
const readRepo = (relative) => fs.readFileSync(path.join(repoRoot, relative), "utf8");
const navigation = readFrontend("lib/navigation.ts");
const adminNavigation = readFrontend("lib/adminNavigation.ts");
const shell = readFrontend("components/dashboard/DashboardShell.tsx");
const authority = readFrontend("lib/authority.ts");
const websiteCms = readFrontend("app/site-content/page.tsx");
const legacyInstitutionalCms = readFrontend("app/institutionalcms/page.tsx");
const institutionalCms = readFrontend("app/admin/institutional-cms/page.tsx");
const notices = readFrontend("app/notices/page.tsx");
const rbac = readRepo("backend/src/config/rbac.ts");
const cmsRoutes = readRepo("backend/src/routes/institutionalCms.routes.ts");
const cmsService = readRepo("backend/src/services/institutionalCms.service.ts");

const CANONICAL_ROLES = [
  "SUPER_ADMIN", "INSTITUTION_ADMIN", "CHAIRMAN", "MANAGEMENT", "DIRECTOR",
  "DEAN", "REGISTRAR", "HOD", "FACULTY", "ACCOUNTS", "HR", "ADMISSIONS",
  "EXAMINATION", "LIBRARIAN", "PLACEMENT", "IT", "CMS", "STUDENT", "PARENT",
  "CLUB_PRESIDENT",
];

test("all 20 canonical roles have an identity and distinct workspace home", () => {
  const dashboardIds = authority.match(/export const DASHBOARD_IDS = \[([\s\S]*?)\] as const/)?.[1] ?? "";
  const roleLabels = navigation.match(/export const ROLE_LABELS:[\s\S]*?= \{([\s\S]*?)\};/)?.[1] ?? "";
  const homeBlock = navigation.match(/export function workspaceHome\(roles: string\[\]\): string \{([\s\S]*?)\n\}/)?.[1] ?? "";
  for (const role of CANONICAL_ROLES) {
    assert.ok(dashboardIds.includes('"'+role+'"'), role + " missing from dashboard identity");
    assert.ok(roleLabels.includes(role + ":"), role + " missing from role labels");
    assert.ok(homeBlock.includes(role + ": \"/"), role + " missing from workspace home");
  }
  assert.ok(new Set(CANONICAL_ROLES.map(role => role)).size === 20);
});

test("platform Website CMS and institution-scoped CMS approval workflow have different ownership", () => {
  assert.match(navigation, /label: "Website CMS",[\s\S]*?href: "\/site-content",[\s\S]*?roles: \["SUPER_ADMIN", "CMS"\]/);
  assert.match(websiteCms, /allowedRoles=\{\["SUPER_ADMIN", "CMS"\]\}/);
  assert.match(navigation, /label: "Institutional CMS",[\s\S]*?href: "\/admin\/institutional-cms",[\s\S]*?roles: \["INSTITUTION_ADMIN", "CHAIRMAN", "MANAGEMENT", "DIRECTOR"\],[\s\S]*?permissions: \["institutional-cms.read"\]/);
  assert.match(adminNavigation, /label: "Institutional CMS",[\s\S]*?href: "\/admin\/institutional-cms",[\s\S]*?read: \["institutional-cms.read"\]/);
  assert.match(institutionalCms, /Save draft/);
  assert.match(institutionalCms, /Submit for approval/);
  assert.match(institutionalCms, /Approve & publish/);
  assert.match(legacyInstitutionalCms, /RoleRedirect/);
  assert.match(legacyInstitutionalCms, /INSTITUTION_ADMIN: "\/admin\/institutional-cms"/);
});

test("tenant CMS routes use the cms entitlement but Super Admin website editing is platform-owned", () => {
  assert.ok(navigation.includes("site-content|institutionalcms"));
  assert.ok(navigation.includes('^\\/admin\\/institutional-cms'));
  assert.match(navigation, /platformManagedCms = activeRole === "SUPER_ADMIN" && itemPath === "\/site-content"/);
  assert.match(navigation, /platformManagedCms = activeRole === "SUPER_ADMIN" && normalizedPath === "\/site-content"/);
  assert.match(navigation, /if \(!platformManagedCms && requiredTenantFeatures\.some\(\(feature\) => !tenantFeatures\.includes\(feature\)\)\) return false;/);
  assert.match(navigation, /const featureAllowed = platformManagedCms \|\| requiredFeatures\.every/);
});

test("institutional CMS permissions remain separate from platform site.manage", () => {
  for (const key of ["institutional-cms.read", "institutional-cms.manage", "institutional-cms.approve"]) {
    assert.ok(rbac.includes('key: "'+key+'"'), "missing catalog permission "+key);
    assert.ok(cmsRoutes.includes('"'+key+'"'), "backend route does not enforce "+key);
  }
  const roleBlock = (role) => rbac.match(new RegExp('(?:^|\\n)\\s*'+role+': \\[[\\s\\S]*?\\n  \\],'))?.[0] ?? "";
  const ia = roleBlock("INSTITUTION_ADMIN");
  const chairman = roleBlock("CHAIRMAN");
  const management = roleBlock("MANAGEMENT");
  const director = roleBlock("DIRECTOR");
  const platform = roleBlock("SUPER_ADMIN");
  assert.ok(ia.includes('"institutional-cms.read"') && ia.includes('"institutional-cms.manage"'));
  assert.ok(!ia.includes('"institutional-cms.approve"'));
  for (const block of [chairman, management, director]) {
    assert.ok(block.includes('"institutional-cms.read"') && block.includes('"institutional-cms.approve"'));
    assert.ok(!block.includes('"institutional-cms.manage"'));
  }
  assert.ok(platform.includes('"site.manage"'));
  assert.ok(!platform.includes('"institutional-cms.manage"'));
  assert.match(cmsService, /actor\.roles\.includes\("SUPER_ADMIN"\)[\s\S]*?throw new AppError/);
  assert.match(cmsService, /institutional-cms\.manage/);
  assert.match(cmsService, /institutional-cms\.approve/);
  assert.doesNotMatch(cmsService, /actor\.permissions\.includes\("site\.manage"\)/);
});

test("notices are readable across the canonical roles but student publishing stays disabled", () => {
  const readRoles = notices.match(/const READ_ROLES = \[([\s\S]*?)\];/)?.[1] ?? "";
  for (const role of CANONICAL_ROLES) assert.ok(readRoles.includes('"'+role+'"'), role + " missing from notice read audience");
  assert.match(notices, /const manage = !user\.roles\.includes\("STUDENT"\) && user\.permissions\.includes\("notices\.manage"\)/);
  assert.match(notices, /listNotices\(false\)/);
  assert.match(notices, /manage \? listDepartments\(\) : Promise\.resolve\(\[\]\)/);
});

test("route ownership fails closed and final destinations are de-duplicated", () => {
  assert.match(navigation, /if \(!matchingNamespace\) \{[\s\S]*?return false;/);
  assert.match(navigation, /const merged = new Map<string, NavigationItem>\(\)/);
  assert.match(shell, /const uniqueDestinations = new Map<string, typeof roleItems\[number\]>\(\)/);
  assert.match(shell, /if \(!uniqueDestinations\.has\(destination\)\) uniqueDestinations\.set\(destination, item\)/);
});
