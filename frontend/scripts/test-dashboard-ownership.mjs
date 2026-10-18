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
const noticePolicy = readFrontend("lib/noticesPolicy.ts");
const erpService = readRepo("backend/src/services/erp.service.ts");
const userService = readRepo("backend/src/services/user.service.ts");
const institutionService = readRepo("backend/src/services/institution.service.ts");
const cmsRoutes = readRepo("backend/src/routes/institutionalCms.routes.ts");
const siteContentRoutes = readRepo("backend/src/routes/siteContent.routes.ts");
const cmsService = readRepo("backend/src/services/institutionalCms.service.ts");

const CANONICAL_ROLES = authority
  .match(/export const DASHBOARD_IDS = \[([\s\S]*?)\] as const/)?.[1]
  ?.match(/"([^"]+)"/g)
  ?.map((role) => role.slice(1, -1)) ?? [];


test("all registered dashboard roles have an identity, role label, and workspace home", () => {
  const dashboardIds = authority.match(/export const DASHBOARD_IDS = \[([\s\S]*?)\] as const/)?.[1] ?? "";
  const roleLabels = navigation.match(/export const ROLE_LABELS:[\s\S]*?= \{([\s\S]*?)\};/)?.[1] ?? "";
  const homeBlock = navigation.match(/export function workspaceHome\(roles: string\[\]\): string \{([\s\S]*?)\n\}/)?.[1] ?? "";
  for (const role of CANONICAL_ROLES) {
    assert.ok(dashboardIds.includes('"'+role+'"'), role + " missing from dashboard identity");
    assert.ok(roleLabels.includes(role + ":"), role + " missing from role labels");
    assert.ok(homeBlock.includes(role + ": \"/"), role + " missing from workspace home");
  }
  assert.ok(CANONICAL_ROLES.length >= 21, "dashboard registry should include all canonical and Staff workspaces");
});

test("platform Website CMS and institution-scoped CMS approval workflow have different ownership", () => {
  assert.match(navigation, /label: "Website CMS",[\s\S]*?href: "\/site-content",[\s\S]*?roles: \["SUPER_ADMIN", "CMS"\]/);
  assert.match(websiteCms, /allowedRoles=\{\["SUPER_ADMIN", "CMS"\]\}/);
  assert.match(navigation, /label: "Website CMS",[\s\S]*?href: "\/site-content",[\s\S]*?activeMatch: "exact"/);
  assert.match(navigation, /label: "Institutional CMS",[\s\S]*?href: "\/admin\/institutional-cms",[\s\S]*?activeMatch: "exact"/);
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
  assert.match(navigation, /if \(!platformManagedCms\) \{[\s\S]*?if \(requiredTenantFeatures\.some\(\(feature\) => !tenantFeatures\.includes\(feature\)\)\) return false;/);
  assert.match(navigation, /const featureAllowed = platformManagedCms \|\| requiredFeatures\.every/);
});

test("institutional CMS permissions remain separate from platform site.manage", () => {
  assert.ok(cmsRoutes.includes('router.use(requireFeature("cms"));'), "Institutional CMS API must reject disabled tenant entitlements");
  assert.ok(siteContentRoutes.includes('router.use(requireFeature("cms"));'), "Website CMS API must enforce CMS tenant entitlement except platform bypass in middleware");
  assert.ok(siteContentRoutes.includes('authorize("site.manage")'), "Website CMS API must retain platform website-editing authorization");
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
  for (const role of CANONICAL_ROLES.filter((role) => role !== "SUPER_ADMIN")) assert.ok(readRoles.includes('"'+role+'"'), role + " missing from notice read audience");
  assert.ok(!readRoles.includes('"SUPER_ADMIN"'), "platform Super Admin has no tenant notice reader scope");
  assert.ok(notices.includes("const manage = canManageNotices(user.roles, user.permissions);"));
  assert.match(notices, /listNotices\(false\)/);
  assert.match(notices, /allowDepartmentTargeting \? listDepartments\(\) : Promise\.resolve\(\[\]\)/);
});

test("route ownership fails closed and final destinations are de-duplicated", () => {
  assert.match(navigation, /if \(!matchingNamespace\) \{[\s\S]*?return false;/);
  assert.match(navigation, /item\.activeMatch === "exact" \|\| Boolean\(itemQuery\) \|\| !normalizedPath\.startsWith\(href \+ "\/"\)/);
  assert.match(navigation, /const merged = new Map<string, NavigationItem>\(\)/);
  assert.match(shell, /const uniqueDestinations = new Map<string, typeof roleItems\[number\]>\(\)/);
  assert.match(shell, /if \(!uniqueDestinations\.has\(destination\)\) uniqueDestinations\.set\(destination, item\)/);
});


test("persisted role grants and user permission lookup use the canonical notice policy", () => {
  const permissionLookupStart = userService.indexOf("export function getSystemRolePermissionKeys(");
  const permissionLookupEnd = userService.indexOf("\n}", permissionLookupStart);
  assert.ok(permissionLookupStart >= 0 && permissionLookupEnd > permissionLookupStart);
  const permissionLookup = userService.slice(permissionLookupStart, permissionLookupEnd);
  assert.ok(permissionLookup.includes("return getRolePermissions(roleName);"),
    "role permission API must not bypass computed writer/read policy");

  assert.ok(institutionService.includes("const desiredPermissionIds = getRolePermissions(roleName)"),
    "institution role provisioning must persist effective canonical permissions rather than the base array");
  assert.doesNotMatch(institutionService, /ROLE_PERMISSIONS\[roleName\]/,
    "institution sync must not bypass the notice policy helper");
  assert.ok(rbac.includes("const canReadTenantNotices = normalized !== \"SUPER_ADMIN\";"),
    "platform-only role remains outside tenant notice access");
});

test("legacy redirect aliases pass the route boundary only through explicit role and permission policy", () => {
  const accessStart = navigation.indexOf("export function canAccessRoute");
  const homeStart = navigation.indexOf("export function workspaceHome", accessStart);
  const source = navigation.slice(accessStart, homeStart);
  const aliasCheck = source.indexOf("const redirectOnlyRoles = REDIRECT_ONLY_ROUTE_ROLES[normalizedPath]");
  const namespaceLookup = source.indexOf("const matchingNamespace");
  const failClosed = source.indexOf("if (!matchingNamespace)");
  const aliasPermissions = source.indexOf("const requiredAliasPermissions", aliasCheck);
  assert.ok(aliasCheck >= 0 && namespaceLookup > aliasCheck && failClosed > namespaceLookup,
    "explicit redirect-only routes must be resolved before the generic namespace fail-closed check");
  assert.ok(aliasPermissions > aliasCheck && source.indexOf("requiredAliasPermissions.every", aliasPermissions) > aliasPermissions,
    "legacy aliases must still enforce their declared permission requirements");
  for (const alias of [
    '"/payments"', '"/fees/receipts"', '"/club"', '"/cms"',
    '"/enrollment"', '"/forms"', '"/institution-settings"',
  ]) {
    assert.ok(navigation.includes(alias), alias + " must remain explicitly declared");
  }
  assert.ok(source.includes('normalizedPath === "/cms"'),
    "the platform CMS alias must preserve the Super Admin platform exception without granting tenant CMS access");
});

test("role-owned notice and notification URLs require read permissions before page access", () => {
  const accessStart = navigation.indexOf("export function canAccessRoute");
  const homeStart = navigation.indexOf("export function workspaceHome", accessStart);
  const accessSource = navigation.slice(accessStart, homeStart);
  const permissionPolicyStart = accessSource.indexOf("const ROLE_OWNED_COMMUNICATION_PREFIXES");
  const permissionPolicyEnd = accessSource.indexOf("const requiredPermission", permissionPolicyStart);
  const permissionPolicy = accessSource.slice(permissionPolicyStart, permissionPolicyEnd);
  const permissionGate = accessSource.indexOf("if (requiredPermission && !permissionSet.has(requiredPermission)) return false;");
  assert.ok(permissionPolicyStart >= 0 && permissionPolicyEnd > permissionPolicyStart);
  for (const root of [
    "/admin", "/chairman", "/management", "/director", "/dean", "/registrar",
    "/hod", "/faculty", "/accounts", "/hr", "/admissions", "/examination",
    "/library", "/placements", "/it", "/student", "/parent", "/club-president",
    "/staff", "/site-content",
  ]) {
    assert.ok(permissionPolicy.includes(`"${root}"`), root + " notice aliases must have an explicit read gate");
  }
  assert.ok(permissionPolicy.includes('`${prefix}/notices`, "notices.read"'),
    "each role-owned notice URL must require notices.read");
  assert.ok(permissionPolicy.includes('`${prefix}/notifications`, "notifications.read"'),
    "each role-owned notification URL must require notifications.read");
  assert.ok(permissionPolicy.includes('["/notices", "notices.read"]'));
  assert.ok(permissionPolicy.includes('["/notifications", "notifications.read"]'));
  assert.ok(permissionGate > permissionPolicyEnd,
    "resolved communication permissions must be enforced before navigation fallback");
});

test("student detail routes require students.read before dynamic namespace fallback", () => {
  const accessStart = navigation.indexOf("export function canAccessRoute");
  const homeStart = navigation.indexOf("export function workspaceHome", accessStart);
  const accessSource = navigation.slice(accessStart, homeStart);
  const permissionStart = accessSource.indexOf("const namespacePermission");
  const permissionEnd = accessSource.indexOf("const requiredPermission", permissionStart);
  const permissionBlock = accessSource.slice(permissionStart, permissionEnd);
  const permissionGate = accessSource.indexOf("if (requiredPermission && !permissionSet.has(requiredPermission)) return false;");
  const dynamicFallback = accessSource.indexOf("matchingNamespace[0].split(");
  assert.ok(permissionBlock.includes('["/students", "students.read"]'),
    "student detail routes must not rely on their dynamic namespace for read permission");
  assert.ok(permissionGate > permissionEnd, "specific module permissions must be enforced after resolution");
  assert.ok(dynamicFallback > permissionGate, "dynamic detail routes must not return early before permission enforcement");
  assert.ok(navigation.includes('["/students/[id]", ["INSTITUTION_ADMIN", "CHAIRMAN", "MANAGEMENT", "DIRECTOR", "DEAN", "REGISTRAR", "HOD", "FACULTY", "ACCOUNTS", "ADMISSIONS", "EXAMINATION", "PLACEMENT"]]'),
    "student detail route roles must stay explicitly declared");
});

test("notice writer policy is explicit, shared by API/UI, and excludes unsupported roles", () => {
  function policyRoles(source, marker, endMarker) {
    const start = source.indexOf(marker);
    const end = source.indexOf(endMarker, start);
    assert.ok(start >= 0 && end > start, "expected a declared notice writer policy");
    return [...source.slice(start, end).matchAll(/"([A-Z_]+)"/g)].map((match) => match[1]);
  }

  const backendRoles = policyRoles(rbac, "export const NOTICE_MANAGEMENT_ROLES = [", "] as const");
  const frontendRoles = policyRoles(noticePolicy, "export const NOTICE_MANAGEMENT_ROLES = [", "] as const");
  const departmentTargetRoles = policyRoles(noticePolicy, "export const NOTICE_DEPARTMENT_TARGET_ROLES = [", "] as const");
  const departmentRequiredRoles = policyRoles(noticePolicy, "export const NOTICE_DEPARTMENT_REQUIRED_ROLES = [", "] as const");
  assert.deepEqual(frontendRoles, backendRoles, "the publisher UI and backend must use the same writer roles");
  assert.deepEqual(backendRoles, [
    "INSTITUTION_ADMIN", "CHAIRMAN", "DIRECTOR", "MANAGEMENT",
    "DEAN", "REGISTRAR", "HOD", "CMS",
  ]);
  assert.deepEqual(departmentTargetRoles, [
    "INSTITUTION_ADMIN", "CHAIRMAN", "DIRECTOR", "DEAN", "MANAGEMENT", "REGISTRAR", "HOD",
  ]);
  assert.deepEqual(departmentRequiredRoles, ["DIRECTOR", "DEAN", "HOD"]);
  assert.ok(rbac.includes("const canReadTenantNotices = normalized !== \"SUPER_ADMIN\";"),
    "platform-only Super Admin must not inherit tenant notice reads");
  assert.ok(rbac.includes('permission !== "notices.manage"') && rbac.includes('permission !== "notices.read"'),
    "non-writer roles and platform-only roles must not inherit notice access from shared permission bundles");
  assert.equal(erpService.split("assertRole(actor, [...NOTICE_MANAGEMENT_ROLES]);").length - 1, 3,
    "create, update and delete must use the same canonical writer allowlist");
  assert.ok(erpService.includes("assertNoticeDepartmentScope(institutionId, actor, input.departmentId)"),
    "notice creation must enforce the writer's server-derived scope");
  assert.ok(erpService.includes("assertNoticeDepartmentScope(institutionId, actor, existing.departmentId)"),
    "notice mutations must validate the existing notice scope");
  assert.ok(erpService.includes('if (activeRole === "DIRECTOR" && isDirectorScoped(actor))') &&
    erpService.includes('if (activeRole === "DEAN" || activeRole === "HOD")'),
    "Director, Dean, and HOD writers must be constrained to assigned departments");
  assert.ok(erpService.includes('throw new AppError("CMS notices must be institution-wide", 403)'),
    "CMS cannot target department records without department authority");
  assert.ok(notices.includes("requiresDepartmentScope && !form.departmentId") &&
    notices.includes("disabled={!canSelectDepartment}"),
    "notice form must prevent publishing outside the effective role scope");
  assert.ok(noticePolicy.includes('permissions.includes("notices.manage")'),
    "the UI must still require the actual permission, not role ownership alone");
});

test("legacy operational aliases redirect to their canonical role-owned page", () => {
  const accountsFees = readFrontend("app/accounts/fees/page.tsx");
  const hodStudents = readFrontend("app/hod/students/page.tsx");
  const libraryCirculation = readFrontend("app/library/circulation/page.tsx");
  const chairmanFeeApprovals = readFrontend("app/chairman/fee-approvals/page.tsx");
  const chairmanOperations = readFrontend("app/chairman/operations/page.tsx");
  const directorOperations = readFrontend("app/director/operations/page.tsx");
  const superadminNotices = readFrontend("app/superadmin/notices/page.tsx");

  assert.match(accountsFees, /redirect\("\/fees"\)/, "Accounts fees alias should resolve to the shared protected fees destination");
  assert.match(hodStudents, /redirect\("\/hod"\)/, "HOD students must not duplicate the HOD home page");
  assert.match(libraryCirculation, /redirect\("\/library\?tab=circulation"\)/, "Library circulation should use the canonical circulation tab");
  assert.match(chairmanFeeApprovals, /redirect\("\/chairman\/fees\/structures"\)/);
  assert.match(chairmanOperations, /redirect\("\/chairman"\)/);
  assert.match(directorOperations, /router\.replace\("\/director"\)|window\.location\.replace\("\/director"\)/);
  assert.match(superadminNotices, /redirect\("\/superadmin"\)/, "platform notice alias must not expose tenant notices");
  assert.doesNotMatch(navigation, /href: "\/superadmin\/notices"/, "platform sidebar must not link to tenant notices");
});
